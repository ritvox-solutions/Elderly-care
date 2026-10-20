from models import CaregiverAssignment, Device, DevicePairing, Patient


def _caregiver_token(client) -> str:
    registration = {
        "email": "onboarding.nurse@caretrack.org",
        "password": "StrongPassword123!",
        "full_name": "Onboarding Nurse",
        "role": "CAREGIVER",
    }
    assert client.post("/api/v1/auth/register", json=registration).status_code == 201
    response = client.post(
        "/api/v1/auth/login",
        json={"email": registration["email"], "password": registration["password"]},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _patient_payload() -> dict:
    return {
        "first_name": "Asha",
        "last_name": "Rao",
        "date_of_birth": "1948-06-15",
        "gender": "Female",
        "room_number": "Room 410",
        "medical_notes": "Hypertension and elevated fall risk",
        "emergency_contact_name": "Mira Rao",
        "emergency_contact_phone": "+91 98765 43210",
        "emergency_contact_email": "mira.rao@example.com",
        "room_device_id": "room-unit-410",
        "wearable_device_id": "wearable-410",
    }


def test_caregiver_can_onboard_patient_and_pair_devices(client, db_session):
    token = _caregiver_token(client)
    response = client.post(
        "/api/v1/patients",
        json=_patient_payload(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    assert response.json()["room_device_id"] == "room-unit-410"
    patient = db_session.query(Patient).filter(Patient.room_number == "Room 410").one()
    assert patient.emergency_contact_email == "mira.rao@example.com"
    assert db_session.query(CaregiverAssignment).filter_by(patient_id=patient.id).count() == 1
    assert db_session.query(DevicePairing).filter_by(patient_id=patient.id, is_active=True).count() == 2
    assert {device.device_identifier for device in db_session.query(Device).all()} == {
        "room-unit-410",
        "wearable-410",
    }


def test_patient_onboarding_requires_real_caregiver_login(client):
    client.cookies.clear()
    response = client.post("/api/v1/patients", json=_patient_payload())
    assert response.status_code == 401


def test_patient_onboarding_rejects_duplicate_room(client):
    token = _caregiver_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/v1/patients", json=_patient_payload(), headers=headers).status_code == 201
    duplicate = _patient_payload() | {
        "room_device_id": "room-unit-411",
        "wearable_device_id": "wearable-411",
    }
    response = client.post("/api/v1/patients", json=duplicate, headers=headers)
    assert response.status_code == 409
