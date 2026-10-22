from datetime import datetime, timezone

import main
from models import Alert, AlertCategory, AlertSeverity, AlertStatus


FALL_PAYLOAD = {
    "topic": "caretrack/room-unit-01/wearable/motion",
    "device_id": "ESP32-CardiacMonitor",
    "sensor": "wearable",
    "timestamp": "2026-10-21T10:00:00Z",
    "data": {"fall_detected": True, "accel_magnitude": 3.85},
}


def test_http_ingest_finishes_alert_work_before_responding(client, monkeypatch):
    processed = []
    monkeypatch.setattr(main, "store_event", lambda event: None)
    monkeypatch.setattr(main, "process_emergency", lambda event: processed.append(event) or [])

    response = client.post("/api/v1/telemetry/ingest", json=FALL_PAYLOAD)

    assert response.status_code == 200
    assert response.json()["alerts_created"] == 0
    assert processed[0].fall_detected is True


def test_http_ingest_rejects_wrong_key(client, monkeypatch):
    monkeypatch.setattr(main.settings, "telemetry_ingest_key", "device-secret")
    response = client.post("/api/v1/telemetry/ingest", json=FALL_PAYLOAD)
    assert response.status_code == 401


def test_latest_alerts_filters_by_device_and_time(client, db_session):
    alert = Alert(
        device_id="ESP32-CardiacMonitor",
        category=AlertCategory.FALL.value,
        severity=AlertSeverity.CRITICAL.value,
        triggering_metric="fall_detected",
        triggering_value=3.85,
        message="Fall detected",
        status=AlertStatus.ACTIVE.value,
        created_at=datetime(2026, 10, 21, 10, 0, tzinfo=timezone.utc),
    )
    db_session.add(alert)
    db_session.commit()

    response = client.get(
        "/api/v1/alerts/latest",
        params={
            "device_ids": "ESP32-CardiacMonitor,room-unit-01",
            "since": "2026-10-21T09:59:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json()[0]["alert_id"] == str(alert.id)
    assert response.json()[0]["metric"] == "fall_detected"
