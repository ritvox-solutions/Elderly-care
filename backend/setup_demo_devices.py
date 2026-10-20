"""Idempotently pair the physical demo devices to one patient."""
from datetime import date

from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from models import Device, DevicePairing, DeviceStatus, DeviceType, Patient


DEMO_DEVICES = (
    ("room-unit-01", DeviceType.ROOM_KIT.value),
    ("ESP32-CardiacMonitor", DeviceType.WEARABLE.value),
)


def setup_demo_devices(db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.room_number == "Room 204").first()
    if patient is None:
        patient = Patient(
            first_name="Margaret",
            last_name="Thatcher",
            date_of_birth=date(1942, 1, 1),
            room_number="Room 204",
            emergency_contact_name="Demo Caregiver",
            emergency_contact_phone="demo-not-configured",
            emergency_contact_email=None,
        )
        db.add(patient)
        db.flush()

    for identifier, device_type in DEMO_DEVICES:
        device = db.query(Device).filter(Device.device_identifier == identifier).first()
        if device is None:
            device = Device(
                device_identifier=identifier,
                device_type=device_type,
                status=DeviceStatus.ONLINE.value,
            )
            db.add(device)
            db.flush()
        pairing = (
            db.query(DevicePairing)
            .filter(DevicePairing.device_id == device.id, DevicePairing.is_active.is_(True))
            .first()
        )
        if pairing is None:
            db.add(DevicePairing(device_id=device.id, patient_id=patient.id, is_active=True))
        elif pairing.patient_id != patient.id:
            raise RuntimeError(f"{identifier} is already paired to another patient")

    db.commit()
    return patient


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        demo_patient = setup_demo_devices(session)
        print(f"Demo devices paired to {demo_patient.first_name} {demo_patient.last_name}.")
