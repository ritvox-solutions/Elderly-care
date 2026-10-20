from datetime import date, datetime, timezone

from models import Device, DevicePairing, DeviceStatus, DeviceType, Patient, Reading


def test_latest_readings_hydrates_paired_room_and_wearable_only(client, db_session):
    patient = Patient(
        first_name="Asha",
        last_name="Rao",
        date_of_birth=date(1948, 6, 15),
        room_number="Room 410",
        emergency_contact_name="Mira Rao",
        emergency_contact_phone="+91 98765 43210",
        emergency_contact_email="mira.rao@example.com",
    )
    room = Device(
        device_identifier="room-hydration",
        device_type=DeviceType.ROOM_KIT.value,
        status=DeviceStatus.ONLINE.value,
    )
    wearable = Device(
        device_identifier="wearable-hydration",
        device_type=DeviceType.WEARABLE.value,
        status=DeviceStatus.ONLINE.value,
    )
    db_session.add_all([patient, room, wearable])
    db_session.flush()
    db_session.add_all([
        DevicePairing(device_id=room.id, patient_id=patient.id, is_active=True),
        DevicePairing(device_id=wearable.id, patient_id=patient.id, is_active=True),
        Reading(device_id=room.device_identifier, patient_id=patient.id, sensor_type="room", metric="room_temp", value=24.2, unit="celsius", timestamp=datetime(2026, 10, 20, 10, 0, tzinfo=timezone.utc)),
        Reading(device_id=room.device_identifier, patient_id=patient.id, sensor_type="room", metric="humidity", value=51, unit="%", timestamp=datetime(2026, 10, 20, 10, 0, tzinfo=timezone.utc)),
        Reading(device_id=wearable.device_identifier, patient_id=patient.id, sensor_type="wearable", metric="heart_rate", value=74, unit="bpm", timestamp=datetime(2026, 10, 20, 10, 1, tzinfo=timezone.utc)),
        Reading(device_id=wearable.device_identifier, patient_id=patient.id, sensor_type="wearable", metric="spo2", value=97, unit="%", timestamp=datetime(2026, 10, 20, 10, 1, tzinfo=timezone.utc)),
        Reading(device_id=wearable.device_identifier, patient_id=patient.id, sensor_type="wearable", metric="body_temp", value=36.8, unit="celsius", timestamp=datetime(2026, 10, 20, 10, 1, tzinfo=timezone.utc)),
        # Wearable data accidentally labelled with the room ID must not refresh the room timestamp.
        Reading(device_id=room.device_identifier, patient_id=patient.id, sensor_type="wearable", metric="heart_rate", value=80, unit="bpm", timestamp=datetime(2026, 10, 20, 10, 3, tzinfo=timezone.utc)),
        # A newer reading from another patient/device must never leak into this response.
        Reading(device_id="other-wearable", sensor_type="wearable", metric="heart_rate", value=155, unit="bpm", timestamp=datetime(2026, 10, 20, 10, 2, tzinfo=timezone.utc)),
    ])
    db_session.commit()

    response = client.get("/readings/latest?device_id=room-hydration")

    assert response.status_code == 200
    data = response.json()
    assert data["wearable_device_id"] == "wearable-hydration"
    assert data["temperature"]["value"] == 24.2
    assert data["humidity"]["value"] == 51
    assert data["heart_rate"]["value"] == 74
    assert data["spo2"]["value"] == 97
    assert data["cardio_temp"]["value"] == 36.8
    assert data["last_seen"] == "2026-10-20T10:00:00"
