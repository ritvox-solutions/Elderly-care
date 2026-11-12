"""Device configuration and downlink management routes."""
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from core.device_sync import get_device_config_payload, broadcast_device_config
from models import Device, DevicePairing, Patient
from settings import get_settings

router = APIRouter(prefix="/api/v1/devices", tags=["Device Configuration"])


class DeviceConfigUpdateRequest(BaseModel):
    emergency_phone: Optional[str] = Field(None, min_length=5, description="New emergency phone number (E.164)")
    emergency_name: Optional[str] = Field(None, description="Emergency contact full name")


@router.get("/{device_id}/config")
def get_device_config(
    device_id: str,
    db: Session = Depends(get_db),
    x_telemetry_key: Optional[str] = Header(default=None),
):
    """
    Retrieve live configuration for an IoT device (wearable or room unit).
    
    Used by ESP32 microcontrollers on boot or reconnect to query the paired patient's
    emergency contact phone number (for SIM800L cellular SMS), name, and room number.
    """
    settings = get_settings()
    if settings.telemetry_ingest_key and x_telemetry_key and x_telemetry_key != settings.telemetry_ingest_key:
        raise HTTPException(status_code=401, detail="Invalid telemetry key")

    return get_device_config_payload(device_id, db)


@router.patch("/{device_id}/config")
def update_device_config(
    device_id: str,
    request: DeviceConfigUpdateRequest,
    db: Session = Depends(get_db),
    x_telemetry_key: Optional[str] = Header(default=None),
):
    """
    Directly update configuration (such as the emergency phone number) for a device.
    Updates the paired active patient and broadcasts the changes to the device via MQTT.
    """
    settings = get_settings()
    if settings.telemetry_ingest_key and x_telemetry_key and x_telemetry_key != settings.telemetry_ingest_key:
        raise HTTPException(status_code=401, detail="Invalid telemetry key")

    device = db.query(Device).filter(Device.device_identifier == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    active_pairing = (
        db.query(DevicePairing)
        .filter(DevicePairing.device_id == device.id, DevicePairing.is_active.is_(True))
        .first()
    )

    if not active_pairing or not active_pairing.patient or not active_pairing.patient.is_active:
        raise HTTPException(status_code=400, detail=f"Device '{device_id}' is not paired to an active patient")

    patient = active_pairing.patient
    updated = False
    if request.emergency_phone is not None:
        patient.emergency_contact_phone = request.emergency_phone
        updated = True
    if request.emergency_name is not None:
        patient.emergency_contact_name = request.emergency_name
        updated = True

    if updated:
        db.commit()
        db.refresh(patient)

    payload = get_device_config_payload(device_id, db)
    broadcast_device_config(device_id, payload)
    return payload
