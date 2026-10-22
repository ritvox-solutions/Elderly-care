from telemetry import parse_telemetry

def test_room_telemetry_parsing():
    payload = {
        "device_id": "room-unit-01",
        "sensor": "room",
        "timestamp": "2026-10-14T10:00:00Z",
        "data": {
            "temperature": 23.5,
            "humidity": 45.0,
            "motion_detected": True,
        }
    }
    event = parse_telemetry("caretrack/room-unit-01/room/environment", payload)
    assert event is not None
    assert event.device_id == "room-unit-01"
    assert event.sensor == "room"
    
    metrics = {r.metric: r.value for r in event.readings}
    assert metrics["room_temp"] == 23.5
    assert metrics["humidity"] == 45.0
    assert metrics["motion"] is True

def test_wearable_cardiac_telemetry():
    payload = {
        "device_id": "ESP32-CardiacMonitor",
        "sensor": "wearable",
        "timestamp": "2026-10-14T10:00:05Z",
        "data": {
            "heart_rate": 78,
            "spo2": 98.5,
            "accel_magnitude": 1.05,
            "fall_detected": False,
        }
    }
    event = parse_telemetry("cardiac/monitor/data", payload)
    assert event is not None
    assert event.fall_detected is False
    
    metrics = {r.metric: r.value for r in event.readings}
    assert metrics["heart_rate"] == 78.0
    assert metrics["spo2"] == 98.5
    assert metrics["accel_magnitude"] == 1.05


def test_invalid_wearable_temperature_is_not_body_temperature():
    event = parse_telemetry(
        "cardiac/monitor/data",
        {
            "device_id": "ESP32-CardiacMonitor",
            "sensor": "wearable",
            "data": {
                "heart_rate": 78,
                "temperature": 27.3,
                "temp_valid": False,
            },
        },
    )

    assert event is not None
    metrics = {reading.metric: reading.value for reading in event.readings}
    assert metrics == {"heart_rate": 78.0}

def test_fall_detection_event():
    payload = {
        "device_id": "wearable-01",
        "sensor": "wearable",
        "timestamp": "2026-10-14T10:01:00Z",
        "data": {
            "accel_magnitude": 3.85,
            "fall_detected": True,
        }
    }
    event = parse_telemetry("caretrack/wearable-01/wearable/motion", payload)
    assert event is not None
    assert event.fall_detected is True
