"""Device configuration synchronization service.

Handles resolving device configuration (including the paired patient's emergency
phone number for SIM800L cellular SMS), and broadcasting configuration changes
to listening microcontrollers via MQTT and WebSockets.
"""
from typing import Any, Callable
from sqlalchemy.orm import Session

from models import Device, DevicePairing, DeviceStatus

ConfigPublisher = Callable[[str, dict[str, Any]], None]

_publishers: list[ConfigPublisher] = []


def register_config_publisher(callback: ConfigPublisher) -> None:
    """Register a callback (e.g. MQTT or WebSocket dispatcher) to receive config updates."""
    if callback not in _publishers:
        _publishers.append(callback)


def unregister_config_publisher(callback: ConfigPublisher) -> None:
    """Unregister a previously registered callback."""
    if callback in _publishers:
        _publishers.remove(callback)


def broadcast_device_config(device_identifier: str, config: dict[str, Any]) -> None:
    """Publish device configuration to all registered handlers (MQTT, WebSockets, etc.)."""
    for publisher in list(_publishers):
        try:
            publisher(device_identifier, config)
        except Exception as e:
            print(f"[DeviceSync Error] Publisher failed for device '{device_identifier}': {e}")


def get_device_config_payload(device_identifier: str, db: Session) -> dict[str, Any]:
    """
    Look up a device by its identifier and construct the configuration payload.
    If the device is paired with an active patient, includes the patient's emergency
    contact phone number (used by the wearable SIM800L module), name, and room number.
    """
    device = db.query(Device).filter(Device.device_identifier == device_identifier).first()
    if not device:
        return {
            "device_id": device_identifier,
            "paired": False,
            "device_type": None,
            "patient_id": None,
            "patient_name": None,
            "room_number": None,
            "emergency_phone": None,
            "emergency_name": None,
            "emergency_email": None,
            "updated_at": None,
            "message": "Device not registered in system",
        }

    active_pairing = (
        db.query(DevicePairing)
        .filter(DevicePairing.device_id == device.id, DevicePairing.is_active.is_(True))
        .first()
    )

    if not active_pairing or not active_pairing.patient or not active_pairing.patient.is_active:
        return {
            "device_id": device_identifier,
            "paired": False,
            "device_type": device.device_type,
            "patient_id": None,
            "patient_name": None,
            "room_number": None,
            "emergency_phone": None,
            "emergency_name": None,
            "emergency_email": None,
            "updated_at": None,
            "message": "Device is not currently paired to an active patient",
        }

    patient = active_pairing.patient
    updated_dt = patient.updated_at or patient.created_at
    updated_at_str = updated_dt.isoformat() if updated_dt else None

    return {
        "device_id": device_identifier,
        "paired": True,
        "device_type": device.device_type,
        "patient_id": str(patient.id),
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "room_number": patient.room_number,
        "emergency_phone": patient.emergency_contact_phone,
        "emergency_name": patient.emergency_contact_name,
        "emergency_email": patient.emergency_contact_email,
        "updated_at": updated_at_str,
        "message": "OK",
    }
