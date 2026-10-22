"""Emergency detection and caregiver email notification fan-out.

Pipeline (documented in docs/emergency-email-notifications.pdf):

    telemetry event (MQTT / HTTP ingest)
        -> detect_emergencies()        evaluate the event against thresholds
        -> resolve_recipients()        device -> patient -> assigned caregivers
        -> Alert + Notification rows   persisted for audit / in-app display
        -> send_alert_email()          one SMTP send, outcome stored per user

``process_emergency`` is the single entry point. It is called from a
thread-pool worker (see ``alert_worker`` in ``main.py``) so SMTP or DB
latency never blocks the MQTT loop or the HTTP ingest endpoint. A
per-device/category cooldown stops a burst of telemetry from flooding
caregivers' inboxes.
"""
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from core import email as email_transport
from core.push import send_expo_push
from core.ampv import AMPV_WINDOW_SECONDS, evaluate_ampv
from database import SessionLocal
from models import (
    Alert,
    AlertCategory,
    AlertSeverity,
    AlertStatus,
    CaregiverAssignment,
    Device,
    DevicePairing,
    Notification,
    NotificationChannel,
    NotificationStatus,
    Patient,
    Reading,
    User,
    UserRole,
)
from routers.thresholds import ACTIVE_THRESHOLDS, get_patient_threshold_dict
from settings import get_settings
from telemetry import TelemetryEvent

# Severity cut-offs for vital signs (outside these -> CRITICAL email).
CRITICAL_HR_LOW = 40.0
CRITICAL_HR_HIGH = 150.0
CRITICAL_BODY_TEMP_LOW = 35.0   # hypothermia risk (deg C)
CRITICAL_BODY_TEMP_HIGH = 39.0  # febrile threshold (deg C)

# (device_id, category, metric) -> unix timestamp of the last emitted alert
_last_emitted: dict[tuple[str, str, str], float] = {}


def reset_cooldowns() -> None:
    """Clear the in-memory cooldown state (used by tests)."""
    _last_emitted.clear()


@dataclass(frozen=True)
class Emergency:
    category: AlertCategory
    severity: AlertSeverity
    metric: str
    value: float
    message: str


def detect_emergencies(
    event: TelemetryEvent,
    thresholds: dict | None = None,
    context: dict[str, float | bool] | None = None,
) -> list[Emergency]:
    """Evaluate one telemetry event; return every emergency it triggers.

    Falls are always CRITICAL. Vital-sign breaches use the caregiver
    configurable thresholds from ``/api/v1/thresholds`` and escalate to
    CRITICAL when physiologically dangerous.
    """
    th = thresholds if thresholds is not None else ACTIVE_THRESHOLDS
    data = {**(context or {}), **event.data}
    found: list[Emergency] = []

    ampv = evaluate_ampv(data, th)
    if ampv.alert:
        label = ", ".join(signal.replace("_", " ") for signal in ampv.signals)
        return [
            Emergency(
                category=AlertCategory.FALL if data.get("fall_detected") else AlertCategory.CARDIAC,
                severity=AlertSeverity.CRITICAL,
                metric="ampv_verified",
                value=1.0,
                message=(
                    f"AMPV verified an emergency on device {event.device_id}: {label} "
                    f"({ampv.rule})."
                ),
            )
        ]

    if event.fall_detected:
        accel = float(data.get("accel_magnitude") or 0.0)
        found.append(
            Emergency(
                category=AlertCategory.FALL,
                severity=AlertSeverity.CRITICAL,
                metric="fall_detected",
                value=accel,
                message=(
                    f"Fall detected on device {event.device_id} "
                    f"(impact {accel:g} g). Immediate assistance may be required."
                ),
            )
        )

    hr = data.get("heart_rate")
    # Only alert if hr >= 30 (ignore 0 bpm finger-off / sensor idle state)
    if hr is not None and hr >= 30 and (hr < th["hr_min"] or hr > th["hr_max"]):
        critical = hr < CRITICAL_HR_LOW or hr > CRITICAL_HR_HIGH
        found.append(
            Emergency(
                category=AlertCategory.CARDIAC,
                severity=AlertSeverity.CRITICAL if critical else AlertSeverity.WARNING,
                metric="heart_rate",
                value=float(hr),
                message=(
                    f"Heart rate {hr:.0f} bpm is outside the configured range "
                    f"{th['hr_min']:.0f}-{th['hr_max']:.0f} bpm on device {event.device_id}."
                ),
            )
        )

    spo2 = data.get("spo2")
    # Only alert if spo2 >= 50.0 (ignore 0% finger-off / optical calibration state)
    if spo2 is not None and 50.0 <= spo2 < th["spo2_min"]:
        found.append(
            Emergency(
                category=AlertCategory.CARDIAC,
                severity=AlertSeverity.CRITICAL,
                metric="spo2",
                value=float(spo2),
                message=(
                    f"Blood oxygen SpO2 {spo2:.0f}% is below the configured floor "
                    f"{th['spo2_min']:.0f}% on device {event.device_id}."
                ),
            )
        )

    body_temp = data.get("body_temp")
    # Only alert if body_temp >= 25.0 (ignore 0.0 or room ambient unworn sensor readings)
    if body_temp is not None and body_temp >= 25.0 and (
        body_temp <= CRITICAL_BODY_TEMP_LOW or body_temp >= CRITICAL_BODY_TEMP_HIGH
    ):
        found.append(
            Emergency(
                category=AlertCategory.CARDIAC,
                severity=AlertSeverity.CRITICAL,
                metric="body_temp",
                value=float(body_temp),
                message=(
                    f"Body temperature {body_temp:.1f} C is outside the safe range "
                    f"{CRITICAL_BODY_TEMP_LOW:.0f}-{CRITICAL_BODY_TEMP_HIGH:.0f} C "
                    f"on device {event.device_id}."
                ),
            )
        )

    room_temp = data.get("room_temp")
    if room_temp is not None and (
        room_temp < th["room_temp_min"] or room_temp > th["room_temp_max"]
    ):
        found.append(
            Emergency(
                category=AlertCategory.ENVIRONMENT,
                severity=AlertSeverity.WARNING,
                metric="room_temp",
                value=float(room_temp),
                message=(
                    f"Room temperature {room_temp:.1f} C is outside the configured range "
                    f"{th['room_temp_min']:.0f}-{th['room_temp_max']:.0f} C "
                    f"on device {event.device_id}."
                ),
            )
        )

    return found


def resolve_recipients(db: Session, device_id: str) -> tuple[list[User], list[str]]:
    """Map a device to the users who should be emailed.

    Primary path: device -> active pairing -> patient -> assigned caregivers.
    Fallback: every active caregiver/admin (so an unpaired device still
    raises a signal). Configured ``ALERT_FALLBACK_RECIPIENTS`` are always
    appended; they receive the email but get no Notification row because
    they are not registered users.
    """
    settings = get_settings()
    caregivers: list[User] = []
    family_email: str | None = None

    device = db.query(Device).filter(Device.device_identifier == device_id).first()
    if device:
        pairing = (
            db.query(DevicePairing)
            .filter(DevicePairing.device_id == device.id, DevicePairing.is_active.is_(True))
            .order_by(DevicePairing.paired_at.desc())
            .first()
        )
        if pairing:
            family_email = pairing.patient.emergency_contact_email if pairing.patient else None
            caregivers = (
                db.query(User)
                .join(CaregiverAssignment, CaregiverAssignment.caregiver_id == User.id)
                .filter(
                    CaregiverAssignment.patient_id == pairing.patient_id,
                    User.is_active.is_(True),
                )
                .all()
            )

    if not caregivers:
        caregivers = (
            db.query(User)
            .filter(
                User.is_active.is_(True),
                User.role.in_([UserRole.CAREGIVER.value, UserRole.ADMIN.value]),
            )
            .all()
        )

    registered = {user.email.lower() for user in caregivers}
    extras = []
    for address in [family_email, *settings.alert_fallback_emails]:
        if address and address.lower() not in registered and address.lower() not in {
            item.lower() for item in extras
        }:
            extras.append(address)
    return caregivers, extras


def build_alert_email(
    emergencies: list[Emergency],
    event: TelemetryEvent,
    patient: Patient | None,
) -> tuple[str, str]:
    """Render a family-friendly email for one telemetry event.

    All emergencies detected on the same event are batched into a single
    email so caregivers get one message per incident, not one per metric.
    """
    top = max(emergencies, key=lambda em: em.severity.value == AlertSeverity.CRITICAL.value)
    patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Unknown patient"
    room = patient.room_number or "Not assigned" if patient else "Not assigned"
    is_fall = any(em.category is AlertCategory.FALL for em in emergencies)
    subject = (
        f"URGENT: Possible fall involving {patient_name} - {room}"
        if is_fall
        else f"CareTrack health alert for your family member, {patient_name}"
    )

    age = None
    if patient:
        detected_on = event.timestamp.date()
        born = patient.date_of_birth
        age = detected_on.year - born.year - ((detected_on.month, detected_on.day) < (born.month, born.day))
    impact = event.data.get("accel_magnitude")

    lines = [
        "CARETRACK FAMILY EMERGENCY ALERT",
        "",
        "Dear family member,",
        "",
        f"CareTrack has detected a possible {'fall' if is_fall else 'health emergency'} involving your family member, {patient_name}.",
        "You are receiving this message because you are listed as an emergency contact.",
        "Please contact the care facility or the assigned caregiver immediately to confirm their safety.",
        "",
        "PATIENT DETAILS",
        f"Name: {patient_name}",
        f"Age: {age if age is not None else 'Not available'}",
        f"Gender: {patient.gender or 'Not provided' if patient else 'Not provided'}",
        f"Room: {room}",
        f"Patient email: {patient.email or 'Not provided' if patient else 'Not available'}",
        f"Medical information: {patient.medical_notes or 'Not provided' if patient else 'Not available'}",
        "",
        "FALL INFORMATION" if is_fall else "ALERT INFORMATION",
        f"Detected: {event.timestamp.strftime('%d %B %Y at %H:%M:%S UTC')}",
        f"Severity: {top.severity.value}",
        f"Wearable device: {event.device_id}",
    ]
    if is_fall and isinstance(impact, (int, float)) and not isinstance(impact, bool):
        lines.append(f"Impact: {impact:.2f} g")
    lines += [f"Details: {em.message}" for em in emergencies]
    if patient:
        lines += [
            "",
            "EMERGENCY CONTACT",
            f"Name: {patient.emergency_contact_name}",
            f"Phone: {patient.emergency_contact_phone}",
            f"Email: {patient.emergency_contact_email or 'Not provided'}",
        ]
    lines += [
        "",
        "If you cannot reach the care team and believe your family member is in immediate danger, contact local emergency services.",
        "",
        "This is an automated CareTrack alert sent to the patient's emergency contact.",
    ]
    return subject, "\n".join(lines)


def _patient_context(db: Session, device_id: str) -> Patient | None:
    """Return the patient paired with a device, when one exists."""
    device = db.query(Device).filter(Device.device_identifier == device_id).first()
    if not device:
        return None
    pairing = (
        db.query(DevicePairing)
        .filter(DevicePairing.device_id == device.id, DevicePairing.is_active.is_(True))
        .first()
    )
    if not pairing or pairing.patient is None:
        return None
    return pairing.patient


def _recent_sensor_context(
    db: Session,
    patient_id: str | None,
    event: TelemetryEvent,
) -> dict[str, float | bool]:
    """Load the patient's latest AMPV inputs from the correlation window."""
    if patient_id is None:
        return {}
    device_ids = [
        identifier
        for (identifier,) in (
            db.query(Device.device_identifier)
            .join(DevicePairing, DevicePairing.device_id == Device.id)
            .filter(DevicePairing.patient_id == patient_id, DevicePairing.is_active.is_(True))
            .all()
        )
    ]
    if not device_ids:
        return {}

    # shortcut: fixed paper-aligned correlation window; calibrate per patient after hardware trials.
    since = event.timestamp - timedelta(seconds=AMPV_WINDOW_SECONDS)
    rows = (
        db.query(Reading)
        .filter(
            Reading.device_id.in_(device_ids),
            Reading.metric.in_(["heart_rate", "spo2", "body_temp", "fall_detected", "motion"]),
            Reading.timestamp >= since,
            Reading.timestamp <= event.timestamp,
        )
        .order_by(Reading.timestamp.desc())
        .all()
    )
    context: dict[str, float | bool] = {}
    for row in rows:
        if row.metric not in context:
            context[row.metric] = bool(row.value) if row.metric in {"fall_detected", "motion"} else row.value
    return context


def process_emergency(event: TelemetryEvent, db: Session | None = None) -> list[Alert]:
    """Full pipeline for one telemetry event; returns the alerts created.

    Safe to call for ordinary telemetry: it returns immediately when the
    event triggers no emergency, before touching the database. Emergencies
    that fire again within ``ALERT_COOLDOWN_SECONDS`` (keyed per device,
    category, and metric) are suppressed so sustained breaches cannot
    flood inboxes.
    """
    own_session = db is None
    if db is None:
        db = SessionLocal()

    patient = _patient_context(db, event.device_id)
    patient_id = patient.id if patient else None
    th = get_patient_threshold_dict(patient_id, db)
    context = _recent_sensor_context(db, patient_id, event)
    emergencies = detect_emergencies(event, thresholds=th, context=context)
    if not emergencies:
        if own_session:
            db.close()
        return []

    created: list[Alert] = []
    try:
        now = time.time()
        settings = get_settings()

        pending: list[Emergency] = []
        for emergency in emergencies:
            cooldown = (
                settings.fall_alert_cooldown_seconds
                if emergency.category is AlertCategory.FALL
                else settings.alert_cooldown_seconds
            )
            key = (event.device_id, emergency.category.value, emergency.metric)
            last = _last_emitted.get(key)
            if last is not None and (now - last) < cooldown:
                print(
                    f"[ALERT] {emergency.category.value}/{emergency.metric} on "
                    f"{event.device_id} suppressed "
                    f"(cooldown {int(cooldown - (now - last))}s left)"
                )
                continue
            # Stamp the cooldown before sending so concurrent workers
            # (MQTT thread + HTTP ingest) cannot double-emit.
            _last_emitted[key] = now
            pending.append(emergency)

        if not pending:
            return created

        for emergency in pending:
            alert = Alert(
                patient_id=patient_id,
                device_id=event.device_id,
                category=emergency.category.value,
                severity=emergency.severity.value,
                triggering_metric=emergency.metric,
                triggering_value=float(emergency.value),
                message=emergency.message,
                status=AlertStatus.ACTIVE.value,
            )
            db.add(alert)
            created.append(alert)
        db.flush()

        # One SMTP transaction per telemetry event, shared by its alerts.
        caregivers, extras = resolve_recipients(db, event.device_id)
        recipients = [user.email for user in caregivers] + extras

        if not recipients:
            status = NotificationStatus.FAILED
            detail = "No recipients configured"
            print(f"[ALERT] on {event.device_id}: {detail}")
        else:
            subject, body = build_alert_email(pending, event, patient)
            ok, detail = email_transport.send_alert_email(recipients, subject, body)
            status = NotificationStatus.DELIVERED if ok else NotificationStatus.FAILED
            print(
                f"[ALERT] {len(pending)} emergency(s) on {event.device_id} -> emailed "
                f"{len(recipients)} recipient(s): "
                f"{'delivered' if ok else f'failed ({detail})'}"
            )

        delivered_at = datetime.now(timezone.utc) if status is NotificationStatus.DELIVERED else None
        for alert in created:
            for user in caregivers:
                db.add(
                    Notification(
                        alert_id=alert.id,
                        user_id=user.id,
                        channel=NotificationChannel.EMAIL.value,
                        status=status.value,
                        delivered_at=delivered_at,
                        error_message=None if status is NotificationStatus.DELIVERED else detail,
                    )
                )

        fall_alert = next((alert for alert in created if alert.category == AlertCategory.FALL.value), None)
        push_users = [user for user in caregivers if user.expo_push_token]
        if fall_alert and push_users:
            patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Patient"
            room_number = patient.room_number if patient and patient.room_number else "Unknown room"
            results = send_expo_push(
                [user.expo_push_token for user in push_users],
                title="CRITICAL: FALL DETECTED",
                body=f"{patient_name}, {room_number}. Immediate assistance required.",
                data={
                    "type": "fall_alert",
                    "alert_id": str(fall_alert.id),
                    "patient_name": patient_name,
                    "room_number": room_number,
                    "device_id": event.device_id,
                    "magnitude": fall_alert.triggering_value,
                    "timestamp": event.timestamp.isoformat(),
                },
            )
            for user in push_users:
                ok, push_detail = results[user.expo_push_token]
                db.add(
                    Notification(
                        alert_id=fall_alert.id,
                        user_id=user.id,
                        channel=NotificationChannel.PUSH.value,
                        status=(NotificationStatus.DELIVERED if ok else NotificationStatus.FAILED).value,
                        delivered_at=datetime.now(timezone.utc) if ok else None,
                        error_message=None if ok else push_detail,
                    )
                )
        db.flush()

        if own_session:
            db.commit()
            # Keep returned alerts readable after this worker-owned session closes.
            for alert in created:
                db.refresh(alert)
                db.expunge(alert)
    except Exception:
        if own_session:
            db.rollback()
        raise
    finally:
        if own_session:
            db.close()

    return created
