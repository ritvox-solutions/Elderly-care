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


def test_assigned_caregiver_can_edit_patient_and_family_email(client, db_session):
    token = _caregiver_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/v1/patients", json=_patient_payload(), headers=headers).json()

    response = client.patch(
        f"/api/v1/patients/{created['id']}",
        json={"first_name": "Ananya", "email": "patient@example.com", "emergency_contact_email": "family@example.com"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["first_name"] == "Ananya"
    assert response.json()["email"] == "patient@example.com"
    assert db_session.query(Patient).filter_by(id=created["id"]).one().emergency_contact_email == "family@example.com"


def test_assigned_caregiver_can_delete_patient_and_release_devices(client, db_session):
    token = _caregiver_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/v1/patients", json=_patient_payload(), headers=headers).json()

    response = client.delete(f"/api/v1/patients/{created['id']}", headers=headers)

    assert response.status_code == 204
    patient = db_session.query(Patient).filter_by(id=created["id"]).one()
    assert patient.is_active is False
    assert db_session.query(DevicePairing).filter_by(patient_id=patient.id, is_active=True).count() == 0
    assert client.get("/api/v1/patients", headers=headers).json() == []


def test_deleted_patient_devices_can_be_reassigned(client, db_session):
    token = _caregiver_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/v1/patients", json=_patient_payload(), headers=headers).json()
    assert client.delete(f"/api/v1/patients/{created['id']}", headers=headers).status_code == 204

    replacement = _patient_payload() | {
        "first_name": "Leela",
        "room_number": "Room 411",
    }
    response = client.post("/api/v1/patients", json=replacement, headers=headers)

    assert response.status_code == 201
    assert response.json()["room_device_id"] == "room-unit-410"
    devices = db_session.query(Device).all()
    assert all(sum(pairing.is_active for pairing in device.pairings) == 1 for device in devices)


def test_caregiver_cannot_delete_an_unassigned_patient(client):
    owner_token = _caregiver_token(client)
    created = client.post(
        "/api/v1/patients",
        json=_patient_payload(),
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()
    registration = {
        "email": "other.nurse@caretrack.org",
        "password": "StrongPassword123!",
        "full_name": "Other Nurse",
        "role": "CAREGIVER",
    }
    assert client.post("/api/v1/auth/register", json=registration).status_code == 201
    other_token = client.post(
        "/api/v1/auth/login",
        json={"email": registration["email"], "password": registration["password"]},
    ).json()["access_token"]

    response = client.delete(
        f"/api/v1/patients/{created['id']}",
        headers={"Authorization": f"Bearer {other_token}"},
    )

    assert response.status_code == 403
