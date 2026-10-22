from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
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
from schemas.patient import PatientCreateRequest, PatientDirectoryResponse, PatientUpdateRequest


router = APIRouter(prefix="/api/v1/patients", tags=["Patients Directory"])

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
        "email": patient.email,
        "date_of_birth": patient.date_of_birth,
        "age": _age(patient.date_of_birth),
        "gender": patient.gender or "Not specified",
        "room_number": patient.room_number or "Unassigned",
        "condition": patient.medical_notes or "No medical notes provided",
        "medical_notes": patient.medical_notes,
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
        "emergency_contact_email": patient.emergency_contact_email,
        "status": "STABLE",
        "room_device_id": devices.get(DeviceType.ROOM_KIT.value, "Unassigned"),
        "wearable_device_id": devices.get(DeviceType.WEARABLE.value, "Unassigned"),
        "vitals": {"hr": 0, "spo2": 0, "temp": 0},
        "room_env": {"temp": 0, "humidity": 0},
    }


@router.get("", response_model=list[PatientDirectoryResponse])
def list_patients(
    db: Session = Depends(get_db),
    caregiver: User = Depends(require_role(UserRole.CAREGIVER)),
):
    return [
        _patient_directory_row(patient)
        for patient in db.query(Patient)
        .join(CaregiverAssignment, CaregiverAssignment.patient_id == Patient.id)
        .filter(
            Patient.is_active.is_(True),
            CaregiverAssignment.caregiver_id == caregiver.id,
        )
        .all()
    ]


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
                if active_pairing.patient.is_active:
                    raise HTTPException(status_code=409, detail=f"Device {identifier} is already paired")
                # Repair pairings left active by deployments that predate patient deletion support.
                active_pairing.is_active = False
                active_pairing.unpaired_at = datetime.now(timezone.utc)
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
        email=str(request.email).lower() if request.email else None,
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


@router.patch("/{patient_id}", response_model=PatientDirectoryResponse)
def update_patient(
    patient_id: str,
    request: PatientUpdateRequest,
    db: Session = Depends(get_db),
    caregiver: User = Depends(require_role(UserRole.CAREGIVER)),
):
    """Partially update a patient assigned to the authenticated caregiver."""
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.is_active.is_(True)).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    assigned = db.query(CaregiverAssignment).filter_by(
        caregiver_id=caregiver.id,
        patient_id=patient.id,
    ).first()
    if assigned is None:
        raise HTTPException(status_code=403, detail="Patient is not assigned to this caregiver")

    changes = request.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No patient fields supplied")
    if "room_number" in changes:
        duplicate = db.query(Patient).filter(
            Patient.room_number == changes["room_number"],
            Patient.id != patient.id,
            Patient.is_active.is_(True),
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="An active patient already uses this room number")
    for field, value in changes.items():
        if field in {"email", "emergency_contact_email"} and value is not None:
            value = str(value).lower()
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return _patient_directory_row(patient)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    caregiver: User = Depends(require_role(UserRole.CAREGIVER)),
):
    """Deactivate an assigned patient and release their paired devices."""
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.is_active.is_(True)).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    assigned = db.query(CaregiverAssignment).filter_by(
        caregiver_id=caregiver.id,
        patient_id=patient.id,
    ).first()
    if assigned is None:
        raise HTTPException(status_code=403, detail="Patient is not assigned to this caregiver")

    patient.is_active = False
    for pairing in patient.device_pairings:
        pairing.is_active = False
        pairing.unpaired_at = datetime.now(timezone.utc)
        pairing.device.status = DeviceStatus.UNPAIRED.value
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
