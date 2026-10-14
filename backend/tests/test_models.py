import uuid
from datetime import date, datetime, timezone
from models import (
    User,
    UserRole,
    Patient,
    CaregiverAssignment,
    Device,
    DeviceType,
    DeviceStatus,
    DevicePairing,
    Reading,
    AlertRule,
    Alert,
    AlertSeverity,
    AlertCategory,
    AlertStatus,
    AuditLog,
)
from core.security import hash_password

def test_user_and_patient_creation(db_session):
    admin = User(
        email="admin@caretrack.org",
        hashed_password=hash_password("AdminPass123!"),
        full_name="System Administrator",
        role=UserRole.ADMIN.value,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    assert admin.id is not None
    assert admin.role == "ADMIN"

    patient = Patient(
        first_name="Margaret",
        last_name="Thatcher",
        date_of_birth=date(1938, 5, 12),
        emergency_contact_name="Mark Thatcher",
        emergency_contact_phone="+1-555-0199",
        created_by_id=admin.id,
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)

    assert patient.id is not None
    assert patient.creator.email == "admin@caretrack.org"

def test_device_pairing_and_telemetry(db_session):
    device = Device(
        device_identifier="room-unit-test-01",
        device_type=DeviceType.ROOM_KIT.value,
        status=DeviceStatus.ONLINE.value,
    )
    db_session.add(device)
    db_session.commit()

    patient = Patient(
        first_name="Arthur",
        last_name="Pendleton",
        date_of_birth=date(1942, 3, 20),
        emergency_contact_name="Sarah Pendleton",
        emergency_contact_phone="+1-555-0123",
    )
    db_session.add(patient)
    db_session.commit()

    pairing = DevicePairing(
        device_id=device.id,
        patient_id=patient.id,
        is_active=True,
    )
    db_session.add(pairing)
    db_session.commit()

    reading = Reading(
        device_id=device.device_identifier,
        patient_id=patient.id,
        sensor_type="room",
        metric="room_temp",
        value=24.5,
        unit="celsius",
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(reading)
    db_session.commit()
    db_session.refresh(reading)

    assert reading.id is not None
    assert reading.patient_id == patient.id
    assert reading.patient.first_name == "Arthur"
