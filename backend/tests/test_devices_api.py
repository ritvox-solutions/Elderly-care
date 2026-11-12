from core.device_sync import register_config_publisher, unregister_config_publisher
from tests.test_patients_api import _caregiver_token, _patient_payload


def test_device_config_unpaired(client):
    response = client.get("/api/v1/devices/non-existent-device/config")
    assert response.status_code == 200
    data = response.json()
    assert data["device_id"] == "non-existent-device"
    assert data["paired"] is False
    assert data["emergency_phone"] is None


def test_device_config_sync_on_patient_onboard_and_update(client, db_session):
    published_events = []

    def mock_publisher(dev_id: str, cfg: dict):
        published_events.append((dev_id, cfg))

    register_config_publisher(mock_publisher)

    try:
        token = _caregiver_token(client)
        payload = _patient_payload()
        payload["wearable_device_id"] = "ESP32-CardiacMonitor-Test"
        payload["emergency_contact_phone"] = "+1234567890"

        # 1. Onboard patient
        create_res = client.post(
            "/api/v1/patients",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_res.status_code == 201
        patient_id = create_res.json()["id"]

        # Wearable should have had its config broadcasted
        assert any(dev == "ESP32-CardiacMonitor-Test" for dev, _ in published_events)

        # 2. Wearable queries GET /api/v1/devices/ESP32-CardiacMonitor-Test/config
        config_res = client.get("/api/v1/devices/ESP32-CardiacMonitor-Test/config")
        assert config_res.status_code == 200
        config_data = config_res.json()
        assert config_data["paired"] is True
        assert config_data["emergency_phone"] == "+1234567890"
        assert config_data["patient_name"] == f"{payload['first_name']} {payload['last_name']}"
        assert config_data["room_number"] == payload["room_number"]

        # 3. Caregiver updates emergency phone from Dashboard
        published_events.clear()
        update_res = client.patch(
            f"/api/v1/patients/{patient_id}",
            json={"emergency_contact_phone": "+19876543210"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["emergency_contact_phone"] == "+19876543210"

        # Verify broadcast occurred
        assert any(
            dev == "ESP32-CardiacMonitor-Test" and cfg.get("emergency_phone") == "+19876543210"
            for dev, cfg in published_events
        )

        # 4. Device fetches latest config over HTTP
        latest_cfg = client.get("/api/v1/devices/ESP32-CardiacMonitor-Test/config").json()
        assert latest_cfg["emergency_phone"] == "+19876543210"

        # 5. Direct PATCH on device endpoint
        direct_res = client.patch(
            "/api/v1/devices/ESP32-CardiacMonitor-Test/config",
            json={"emergency_phone": "+15551234567"},
        )
        assert direct_res.status_code == 200
        assert direct_res.json()["emergency_phone"] == "+15551234567"

        # Verify device queries reflect the new number
        final_cfg = client.get("/api/v1/devices/ESP32-CardiacMonitor-Test/config").json()
        assert final_cfg["emergency_phone"] == "+15551234567"

    finally:
        unregister_config_publisher(mock_publisher)
