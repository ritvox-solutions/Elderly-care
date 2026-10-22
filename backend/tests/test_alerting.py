from datetime import date, datetime, timezone
import uuid

import pytest

from core import email as email_transport
from core.alerting import (
    detect_emergencies,
    process_emergency,
    reset_cooldowns,
    resolve_recipients,
)
from core.ampv import evaluate_ampv
from core.security import hash_password
from main import alert_message
from models import (
    AlertCategory,
    AlertSeverity,
    AlertStatus,
    CaregiverAssignment,
    Device,
    DevicePairing,
    DeviceStatus,
    DeviceType,
    Notification,
    NotificationChannel,
    NotificationStatus,
    Patient,
    PatientThreshold,
    Reading,
    User,
    UserRole,
)
from settings import Settings
from telemetry import parse_telemetry
from routers.thresholds import get_patient_threshold_dict, PATIENT_THRESHOLDS_CACHE


@pytest.fixture(autouse=True)
def clean_cooldowns():
    reset_cooldowns()
    yield
    reset_cooldowns()


def test_threshold_lookup_accepts_uuid_patient_id(db_session):
    patient_id = uuid.uuid4()
    db_session.add(PatientThreshold(patient_id=str(patient_id), hr_min=61, hr_max=99))
    db_session.commit()
    PATIENT_THRESHOLDS_CACHE.pop(str(patient_id), None)

    assert get_patient_threshold_dict(patient_id, db_session)["hr_min"] == 61


def fall_event(device_id: str = "wearable-test-01"):
    event = parse_telemetry(
        "caretrack/wearable/fall",
        {
            "device_id": device_id,
            "sensor": "wearable",
            "timestamp": "2026-10-14T10:00:00Z",
            "readings": {"fall_detected": True, "accel_magnitude": 3.85},
        },
    )
    assert event is not None
    return event


def vitals_event(**overrides):
    readings = {"heart_rate": 78, "spo2": 98, "body_temp": 36.6}
    readings.update(overrides)
    event = parse_telemetry(
        "caretrack/wearable/vitals",
        {
            "device_id": "wearable-test-01",
            "sensor": "wearable",
            "timestamp": "2026-10-14T10:00:05Z",
            "readings": readings,
        },
    )
    assert event is not None
    return event


@pytest.fixture
def scenario(db_session):
    """Caregiver assigned to a patient whose wearable device is paired."""
    caregiver = User(
        email="nurse.jane@caretrack.org",
        hashed_password=hash_password("NursePass123!"),
        full_name="Jane Ortega, RN",
        role=UserRole.CAREGIVER.value,
    )
    patient = Patient(
        first_name="Eleanor",
        last_name="Vance",
        email="eleanor.vance@example.com",
        date_of_birth=date(1935, 4, 2),
        gender="Female",
        room_number="Room 312",
        medical_notes="Severe osteoporosis and high fall risk",
        emergency_contact_name="Sam Vance",
        emergency_contact_phone="+1-555-0142",
        emergency_contact_email="sam.vance@example.com",
    )
    device = Device(
        device_identifier="wearable-test-01",
        device_type=DeviceType.WEARABLE.value,
        status=DeviceStatus.ONLINE.value,
    )
    db_session.add_all([caregiver, patient, device])
    db_session.commit()

    db_session.add(CaregiverAssignment(caregiver_id=caregiver.id, patient_id=patient.id, is_primary=True))
    db_session.add(DevicePairing(device_id=device.id, patient_id=patient.id, is_active=True))
    db_session.commit()
    return {"caregiver": caregiver, "patient": patient, "device": device}


# --- detection -----------------------------------------------------------

def test_fall_detection_is_critical_emergency():
    emergencies = detect_emergencies(fall_event())
    assert len(emergencies) == 1
    em = emergencies[0]
    assert em.category is AlertCategory.FALL
    assert em.severity is AlertSeverity.CRITICAL
    assert em.metric == "fall_detected"
    assert "Fall detected" in em.message


def test_normal_vitals_trigger_no_emergency():
    assert detect_emergencies(vitals_event()) == []


@pytest.mark.parametrize(
    ("data", "rule"),
    [
        ({"fall_detected": True, "heart_rate": 125, "spo2": 98}, "fall_with_abnormal_vitals"),
        ({"fall_detected": True, "heart_rate": 78, "spo2": 88}, "fall_with_abnormal_vitals"),
        ({"heart_rate": 125, "body_temp": 38.5}, "abnormal_heart_rate_with_fever"),
        ({"fall_detected": True, "motion": False}, "fall_with_no_motion"),
    ],
)
def test_ampv_verifies_multi_sensor_emergencies(data, rule):
    decision = evaluate_ampv(data, {"hr_min": 50, "hr_max": 110, "spo2_min": 92})
    assert decision.alert is True
    assert decision.rule == rule


def test_ampv_rejects_single_ambiguous_signal():
    thresholds = {"hr_min": 50, "hr_max": 110, "spo2_min": 92}
    assert evaluate_ampv({"heart_rate": 125}, thresholds).alert is False
    assert evaluate_ampv({"spo2": 88}, thresholds).alert is False
    assert evaluate_ampv({"fall_detected": True, "motion": True}, thresholds).alert is False


def test_detect_emergencies_consolidates_verified_ampv_event():
    emergencies = detect_emergencies(vitals_event(heart_rate=125, body_temp=38.5))
    assert len(emergencies) == 1
    assert emergencies[0].metric == "ampv_verified"
    assert emergencies[0].severity is AlertSeverity.CRITICAL


def test_vital_breaches_use_configured_thresholds():
    # tachycardia (120 bpm > 110 max, but below the 150 critical cut-off)
    emergencies = detect_emergencies(vitals_event(heart_rate=120))
    assert [(e.category, e.severity) for e in emergencies] == [(AlertCategory.CARDIAC, AlertSeverity.WARNING)]

    # dangerous bradycardia escalates to CRITICAL
    emergencies = detect_emergencies(vitals_event(heart_rate=35))
    assert emergencies[0].severity is AlertSeverity.CRITICAL

    # hypoxia and febrile body temperature are CRITICAL
    emergencies = detect_emergencies(vitals_event(spo2=88, body_temp=39.5))
    assert len(emergencies) == 2
    assert all(e.severity is AlertSeverity.CRITICAL for e in emergencies)
    assert {e.metric for e in emergencies} == {"spo2", "body_temp"}


def test_room_temperature_breach_is_environment_warning():
    event = parse_telemetry(
        "caretrack/room/environment",
        {
            "device_id": "room-test-01",
            "sensor": "room",
            "timestamp": "2026-10-14T10:00:00Z",
            "readings": {"room_temp": 31.5, "humidity": 55},
        },
    )
    emergencies = detect_emergencies(event)
    assert len(emergencies) == 1
    assert emergencies[0].category is AlertCategory.ENVIRONMENT
    assert emergencies[0].severity is AlertSeverity.WARNING


# --- persistence + email fan-out ----------------------------------------

def test_process_emergency_persists_alert_and_delivers_email(db_session, scenario, monkeypatch):
    sent = {}

    def fake_send(*, recipients, subject, body, **kwargs):
        sent.update(recipients=recipients, subject=subject, body=body)
        return True, "sent"

    monkeypatch.setattr(email_transport, "send_smtp_mail", fake_send)

    alerts = process_emergency(fall_event(), db=db_session)

    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.category == AlertCategory.FALL.value
    assert alert.severity == AlertSeverity.CRITICAL.value
    assert alert.status == AlertStatus.ACTIVE.value
    assert alert.patient_id == scenario["patient"].id
    assert alert.triggering_metric == "fall_detected"

    notifications = db_session.query(Notification).all()
    assert len(notifications) == 1
    note = notifications[0]
    assert note.alert_id == alert.id
    assert note.user_id == scenario["caregiver"].id
    assert note.channel == NotificationChannel.EMAIL.value
    assert note.status == NotificationStatus.DELIVERED.value
    assert note.delivered_at is not None
    assert note.error_message is None

    assert sent["recipients"] == ["nurse.jane@caretrack.org", "sam.vance@example.com"]
    assert sent["subject"] == "URGENT: Possible fall involving Eleanor Vance - Room 312"
    assert "Dear family member" in sent["body"]
    assert "listed as an emergency contact" in sent["body"]
    assert "contact the care facility or the assigned caregiver" in sent["body"]
    assert "Name: Eleanor Vance" in sent["body"]
    assert "Age: 91" in sent["body"]
    assert "Gender: Female" in sent["body"]
    assert "Room: Room 312" in sent["body"]
    assert "Patient email: eleanor.vance@example.com" in sent["body"]
    assert "Medical information: Severe osteoporosis and high fall risk" in sent["body"]
    assert "Detected: 14 October 2026 at 10:00:00 UTC" in sent["body"]
    assert "Wearable device: wearable-test-01" in sent["body"]
    assert "Impact: 3.85 g" in sent["body"]
    assert "Name: Sam Vance" in sent["body"]
    assert "Phone: +1-555-0142" in sent["body"]
    assert "Email: sam.vance@example.com" in sent["body"]
    assert "Fall detected" in sent["body"]

    ws_message = alert_message(fall_event(), alert)
    assert ws_message["type"] == "alert"
    assert ws_message["severity"] == "CRITICAL"
    assert ws_message["metric"] == "fall_detected"
    assert ws_message["timestamp"].endswith("+00:00")


def test_process_emergency_correlates_recent_room_motion(db_session, scenario, monkeypatch):
    room_device = Device(
        device_identifier="room-test-01",
        device_type=DeviceType.ROOM_KIT.value,
        status=DeviceStatus.ONLINE.value,
    )
    db_session.add(room_device)
    db_session.commit()
    db_session.add(
        DevicePairing(device_id=room_device.id, patient_id=scenario["patient"].id, is_active=True)
    )
    db_session.add(
        Reading(
            device_id=room_device.device_identifier,
            patient_id=scenario["patient"].id,
            sensor_type="room",
            metric="motion",
            value=0.0,
            unit="boolean",
            timestamp=datetime(2026, 10, 14, 9, 59, 45, tzinfo=timezone.utc),
        )
    )
    db_session.commit()
    monkeypatch.setattr(email_transport, "send_smtp_mail", lambda **kwargs: (True, "sent"))

    alerts = process_emergency(fall_event(), db=db_session)

    assert len(alerts) == 1
    assert alerts[0].triggering_metric == "ampv_verified"
    assert "fall with no motion" in alerts[0].message.replace("_", " ")


def test_smtp_failure_marks_notification_failed(db_session, scenario, monkeypatch):
    monkeypatch.setattr(
        email_transport, "send_smtp_mail",
        lambda **kwargs: (False, "SMTPConnectError: connection refused"),
    )

    process_emergency(fall_event(), db=db_session)

    note = db_session.query(Notification).one()
    assert note.status == NotificationStatus.FAILED.value
    assert note.delivered_at is None
    assert "connection refused" in note.error_message


def test_fall_sends_push_to_registered_caregiver(db_session, scenario, monkeypatch):
    token = "ExponentPushToken[caregiver_device_123]"
    scenario["caregiver"].expo_push_token = token
    db_session.commit()
    sent = {}
    monkeypatch.setattr(email_transport, "send_smtp_mail", lambda **kwargs: (True, "sent"))
    monkeypatch.setattr(
        "core.alerting.send_expo_push",
        lambda tokens, **kwargs: sent.update(tokens=tokens, **kwargs) or {token: (True, "ticket-1")},
    )

    alerts = process_emergency(fall_event(), db=db_session)

    assert sent["tokens"] == [token]
    assert sent["data"]["type"] == "fall_alert"
    assert sent["data"]["room_number"] == "Room 312"
    push_note = db_session.query(Notification).filter(Notification.channel == NotificationChannel.PUSH.value).one()
    assert push_note.alert_id == alerts[0].id
    assert push_note.status == NotificationStatus.DELIVERED.value


def test_cooldown_suppresses_repeat_falls(db_session, scenario, monkeypatch):
    sends = []
    monkeypatch.setattr(
        email_transport, "send_smtp_mail",
        lambda **kwargs: sends.append(kwargs) or (True, "sent"),
    )

    first = process_emergency(fall_event(), db=db_session)
    second = process_emergency(fall_event(), db=db_session)

    assert len(first) == 1
    assert second == []
    assert len(sends) == 1
    assert db_session.query(Notification).count() == 1


def test_distinct_fall_after_short_cooldown_is_delivered(db_session, scenario, monkeypatch):
    monkeypatch.setattr(email_transport, "send_smtp_mail", lambda **kwargs: (True, "sent"))
    ticks = iter((100.0, 111.0))
    monkeypatch.setattr("core.alerting.time.time", lambda: next(ticks))

    first = process_emergency(fall_event(), db=db_session)
    second = process_emergency(fall_event(), db=db_session)

    assert len(first) == len(second) == 1


def test_unpaired_device_falls_back_to_all_caregivers(db_session, monkeypatch):
    caregiver = User(
        email="fallback@caretrack.org",
        hashed_password=hash_password("Pass123!"),
        full_name="Fallback Caregiver",
        role=UserRole.CAREGIVER.value,
    )
    db_session.add(caregiver)
    db_session.commit()

    sent = {}
    monkeypatch.setattr(
        email_transport, "send_smtp_mail",
        lambda **kwargs: sent.update(kwargs) or (True, "sent"),
    )

    alerts = process_emergency(fall_event(device_id="unknown-device-99"), db=db_session)

    assert len(alerts) == 1
    assert alerts[0].patient_id is None  # device not linked to a patient
    assert sent["recipients"] == ["fallback@caretrack.org"]

    users, extras = resolve_recipients(db_session, "unknown-device-99")
    assert [u.email for u in users] == ["fallback@caretrack.org"]
    assert extras == []


def test_multiple_breaches_batch_into_one_email(db_session, scenario, monkeypatch):
    sends = []
    monkeypatch.setattr(
        email_transport, "send_smtp_mail",
        lambda **kwargs: sends.append(kwargs) or (True, "sent"),
    )

    alerts = process_emergency(vitals_event(heart_rate=160, spo2=85), db=db_session)

    # one Alert row per breach, but a single email per telemetry event
    assert len(alerts) == 2
    assert len(sends) == 1
    assert sends[0]["subject"] == "CareTrack health alert for your family member, Eleanor Vance"
    assert sends[0]["body"].count("Details:") == 2
    assert db_session.query(Notification).count() == 2


# --- transport -----------------------------------------------------------

class FakeSMTP:
    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.started_tls = False
        self.logged_in = None
        self.message = None
        FakeSMTP.last = self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.started_tls = True

    def login(self, username, password):
        self.logged_in = (username, password)

    def send_message(self, msg):
        self.message = msg


def test_send_smtp_mail_builds_and_delivers_message(monkeypatch):
    monkeypatch.setattr(email_transport.smtplib, "SMTP", FakeSMTP)

    ok, detail = email_transport.send_smtp_mail(
        recipients=["a@x.org", "b@x.org"],
        subject="Fall detected",
        body="Help required in Room 312",
        host="smtp.example.com",
        port=587,
        username="alerts@example.com",
        password="secret",
        use_tls=True,
        from_addr="alerts@example.com",
    )

    assert (ok, detail) == (True, "sent")
    smtp = FakeSMTP.last
    assert smtp.started_tls is True
    assert smtp.logged_in == ("alerts@example.com", "secret")
    assert smtp.message["Subject"] == "Fall detected"
    assert smtp.message["To"] == "a@x.org, b@x.org"
    assert "Room 312" in smtp.message.get_content()


def test_send_smtp_mail_reports_connection_errors(monkeypatch):
    def boom(*args, **kwargs):
        raise ConnectionRefusedError("no route to host")

    monkeypatch.setattr(email_transport.smtplib, "SMTP", boom)

    ok, detail = email_transport.send_smtp_mail(
        recipients=["a@x.org"],
        subject="s",
        body="b",
        host="smtp.example.com",
        port=587,
    )

    assert ok is False
    assert "ConnectionRefusedError" in detail


def test_send_alert_email_requires_smtp_host(monkeypatch):
    monkeypatch.setattr(email_transport, "get_settings", lambda: Settings(smtp_host=""))
    ok, detail = email_transport.send_alert_email(["a@x.org"], "s", "b")
    assert ok is False
    assert "SMTP not configured" in detail


def test_send_alert_email_respects_disable_flag(monkeypatch):
    monkeypatch.setattr(
        email_transport, "get_settings",
        lambda: Settings(email_alerts_enabled=False, smtp_host="smtp.example.com"),
    )
    ok, detail = email_transport.send_alert_email(["a@x.org"], "s", "b")
    assert ok is False
    assert "disabled" in detail
