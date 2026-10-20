from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.dependencies import require_role
from database import get_db
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
from schemas.patient import PatientCreateRequest, PatientDirectoryResponse


router = APIRouter(prefix="/api/v1/patients", tags=["Patients Directory"])

PATIENTS_DATA = [
    {
        "id": "p-001",
        "first_name": "Margaret",
        "last_name": "Thatcher",
        "age": 84,
        "gender": "Female",
        "room_number": "Room 204",
        "condition": "Post-cardiac stent, mobility risk, mild hypertension",
        "status": "STABLE",
        "room_device_id": "room-unit-01",
        "wearable_device_id": "ESP32-CardiacMonitor",
        "vitals": {"hr": 76, "spo2": 98, "temp": 36.6},
        "room_env": {"temp": 23.5, "humidity": 48},
    },
    {
        "id": "p-002",
        "first_name": "Arthur",
        "last_name": "Pendleton",
        "age": 79,
        "gender": "Male",
        "room_number": "Room 108",
        "condition": "Arrhythmia history, pacemaker, type 2 diabetes",
        "status": "ATTENTION",
        "room_device_id": "room-unit-02",
        "wearable_device_id": "ESP32-CardiacMonitor-02",
        "vitals": {"hr": 88, "spo2": 94, "temp": 36.8},
        "room_env": {"temp": 24.1, "humidity": 52},
    },
    {
        "id": "p-003",
        "first_name": "Eleanor",
        "last_name": "Vance",
        "age": 91,
        "gender": "Female",
        "room_number": "Room 312",
        "condition": "Severe osteoporosis, chronic COPD, high fall risk",
        "status": "CRITICAL",
        "room_device_id": "room-unit-03",
        "wearable_device_id": "ESP32-CardiacMonitor-03",
        "vitals": {"hr": 64, "spo2": 91, "temp": 36.4},
        "room_env": {"temp": 22.8, "humidity": 45},
    },
]


def _age(date_of_birth: date) -> int:
    today = date.today()
    return today.year - date_of_birth.year - (
        (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
    )


def _patient_directory_row(patient: Patient) -> dict:
    devices = {
        pairing.device.device_type: pairing.device.device_identifier
        for pairing in patient.device_pairings
        if pairing.is_active
    }
    return {
        "id": patient.id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "age": _age(patient.date_of_birth),
        "gender": patient.gender or "Not specified",
        "room_number": patient.room_number or "Unassigned",
        "condition": patient.medical_notes or "No medical notes provided",
        "status": "STABLE",
        "room_device_id": devices.get(DeviceType.ROOM_KIT.value, "Unassigned"),
        "wearable_device_id": devices.get(DeviceType.WEARABLE.value, "Unassigned"),
        "vitals": {"hr": 0, "spo2": 0, "temp": 0},
        "room_env": {"temp": 0, "humidity": 0},
    }


@router.get("", response_model=list[PatientDirectoryResponse])
def list_patients(db: Session = Depends(get_db)):
    # Keep the original demo cards while replacing matching rooms with saved records.
    rows = [dict(row) for row in PATIENTS_DATA]
    room_indexes = {row["room_number"].lower(): index for index, row in enumerate(rows)}
    for patient in db.query(Patient).filter(Patient.is_active.is_(True)).all():
        row = _patient_directory_row(patient)
        index = room_indexes.get(row["room_number"].lower())
        if index is None:
            rows.append(row)
        else:
            rows[index] = row
    return rows


@router.post("", response_model=PatientDirectoryResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    request: PatientCreateRequest,
    db: Session = Depends(get_db),
    caregiver: User = Depends(require_role(UserRole.CAREGIVER)),
):
    """Create a patient, pair both devices, and subscribe the caregiver to alerts."""
    if request.room_device_id.lower() == request.wearable_device_id.lower():
        raise HTTPException(status_code=400, detail="Room and wearable device IDs must be different")

    existing_room = (
        db.query(Patient)
        .filter(Patient.room_number == request.room_number, Patient.is_active.is_(True))
        .first()
    )
    if existing_room:
        raise HTTPException(status_code=409, detail="An active patient already uses this room number")

    device_specs = (
        (request.room_device_id, DeviceType.ROOM_KIT.value),
        (request.wearable_device_id, DeviceType.WEARABLE.value),
    )
    devices: list[Device] = []
    for identifier, device_type in device_specs:
        device = db.query(Device).filter(Device.device_identifier == identifier).first()
        if device:
            active_pairing = (
                db.query(DevicePairing)
                .filter(DevicePairing.device_id == device.id, DevicePairing.is_active.is_(True))
                .first()
            )
            if active_pairing:
                raise HTTPException(status_code=409, detail=f"Device {identifier} is already paired")
            if device.device_type != device_type:
                raise HTTPException(status_code=409, detail=f"Device {identifier} has the wrong device type")
        else:
            device = Device(
                device_identifier=identifier,
                device_type=device_type,
                status=DeviceStatus.OFFLINE.value,
            )
            db.add(device)
            db.flush()
        devices.append(device)

    patient = Patient(
        first_name=request.first_name,
        last_name=request.last_name,
        date_of_birth=request.date_of_birth,
        gender=request.gender,
        room_number=request.room_number,
        medical_notes=request.medical_notes,
        emergency_contact_name=request.emergency_contact_name,
        emergency_contact_phone=request.emergency_contact_phone,
        emergency_contact_email=str(request.emergency_contact_email).lower(),
        created_by_id=caregiver.id,
    )
    db.add(patient)
    db.flush()
    db.add(CaregiverAssignment(caregiver_id=caregiver.id, patient_id=patient.id, is_primary=True))
    for device in devices:
        db.add(DevicePairing(device_id=device.id, patient_id=patient.id, is_active=True))
    db.commit()
    db.refresh(patient)
    return _patient_directory_row(patient)
