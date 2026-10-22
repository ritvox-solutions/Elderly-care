"""Idempotently create the demo caregiver, patients, assignments, and devices."""
from datetime import date

from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from core.security import hash_password
from models import (
    CaregiverAssignment,
    Device,
    DevicePairing,
    DeviceStatus,
    DeviceType,
    Patient,
    User,
    UserRole,
)
from settings import get_settings


DEMO_PATIENTS = (
    ("Margaret", "Thatcher", date(1942, 1, 1), "Female", "Room 204", "Post-cardiac stent, mobility risk, mild hypertension", "room-unit-01", "ESP32-CardiacMonitor"),
    ("Arthur", "Pendleton", date(1947, 3, 18), "Male", "Room 108", "Arrhythmia history, pacemaker, type 2 diabetes", "room-unit-02", "ESP32-CardiacMonitor-02"),
    ("Eleanor", "Vance", date(1935, 4, 2), "Female", "Room 312", "Severe osteoporosis, chronic COPD, high fall risk", "room-unit-03", "ESP32-CardiacMonitor-03"),
)
DEMO_DEVICES = tuple(
    device
    for patient in DEMO_PATIENTS
    for device in ((patient[6], DeviceType.ROOM_KIT.value), (patient[7], DeviceType.WEARABLE.value))
)


def setup_demo_data(db: Session) -> tuple[User, list[Patient]]:
    settings = get_settings()
    caregiver = db.query(User).filter(User.email == settings.demo_caregiver_email.lower()).first()
    if caregiver is None:
        caregiver = User(
            email=settings.demo_caregiver_email.lower(),
            hashed_password=hash_password(settings.demo_caregiver_password),
            full_name="Dr. Sarah Jenkins",
            role=UserRole.CAREGIVER.value,
            is_active=True,
        )
        db.add(caregiver)
        db.flush()

    patients: list[Patient] = []
    for first, last, birth_date, gender, room, notes, room_device, wearable_device in DEMO_PATIENTS:
        patient = db.query(Patient).filter(Patient.room_number == room).first()
        if patient is None:
            patient = Patient(
                first_name=first,
                last_name=last,
                date_of_birth=birth_date,
                gender=gender,
                room_number=room,
                medical_notes=notes,
                emergency_contact_name="Not configured",
                emergency_contact_phone="Not configured",
                created_by_id=caregiver.id,
            )
            db.add(patient)
            db.flush()
        patients.append(patient)

        # A deleted demo patient stays deleted; demo login must not reclaim their devices.
        if not patient.is_active:
            continue

        assignment = db.query(CaregiverAssignment).filter_by(
            caregiver_id=caregiver.id, patient_id=patient.id
        ).first()
        if assignment is None:
            db.add(CaregiverAssignment(caregiver_id=caregiver.id, patient_id=patient.id, is_primary=True))

        for identifier, device_type in (
            (room_device, DeviceType.ROOM_KIT.value),
            (wearable_device, DeviceType.WEARABLE.value),
        ):
            device = db.query(Device).filter(Device.device_identifier == identifier).first()
            if device is None:
                device = Device(
                    device_identifier=identifier,
                    device_type=device_type,
                    status=DeviceStatus.ONLINE.value,
                )
                db.add(device)
                db.flush()
            pairing = db.query(DevicePairing).filter(
                DevicePairing.device_id == device.id, DevicePairing.is_active.is_(True)
            ).first()
            if pairing is None:
                db.add(DevicePairing(device_id=device.id, patient_id=patient.id, is_active=True))
            elif pairing.patient_id != patient.id:
                raise RuntimeError(f"{identifier} is already paired to another patient")

    db.commit()
    return caregiver, patients


def setup_demo_devices(db: Session) -> Patient:
    """Keep the original setup entry point for scripts and existing callers."""
    return setup_demo_data(db)[1][0]


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        demo_patient = setup_demo_devices(session)
        print(f"Demo devices paired to {demo_patient.first_name} {demo_patient.last_name}.")
