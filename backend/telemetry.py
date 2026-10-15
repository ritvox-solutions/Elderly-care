from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError


class HeartRate(BaseModel):
    metric: Literal["heart_rate"] = "heart_rate"
    value: float = Field(ge=0, le=240)
    unit: Literal["bpm"] = "bpm"


class SpO2(BaseModel):
    metric: Literal["spo2"] = "spo2"
    value: float = Field(ge=0, le=100)
    unit: Literal["%"] = "%"


class BodyTemp(BaseModel):
    metric: Literal["body_temp"] = "body_temp"
    value: float = Field(ge=20, le=50)
    unit: Literal["celsius"] = "celsius"


class Motion(BaseModel):
    metric: Literal["motion"] = "motion"
    value: bool
    unit: Literal["boolean"] = "boolean"


class FallDetected(BaseModel):
    metric: Literal["fall_detected"] = "fall_detected"
    value: bool
    unit: Literal["alert"] = "alert"


class RoomTemp(BaseModel):
    metric: Literal["room_temp"] = "room_temp"
    value: float = Field(ge=-10, le=60)
    unit: Literal["celsius"] = "celsius"


class Humidity(BaseModel):
    metric: Literal["humidity"] = "humidity"
    value: float = Field(ge=0, le=100)
    unit: Literal["%"] = "%"


class AccelMagnitude(BaseModel):
    metric: Literal["accel_magnitude"] = "accel_magnitude"
    value: float = Field(ge=0, le=32)
    unit: Literal["g"] = "g"


class DeviceStatus(BaseModel):
    metric: Literal["status"] = "status"
    value: float
    unit: str | None = None


ValidatedReading = HeartRate | SpO2 | BodyTemp | Motion | FallDetected | RoomTemp | Humidity | AccelMagnitude | DeviceStatus


class TelemetryEvent(BaseModel):
    topic: str
    device_id: str
    sensor: Literal["room", "wearable"]
    timestamp: datetime
    readings: list[ValidatedReading]

    @property
    def data(self) -> dict[str, float | bool]:
        res = {reading.metric: reading.value for reading in self.readings}
        if "motion" in res:
            res["motion_detected"] = res["motion"]
            res["motion_detection"] = res["motion"]
        return res

    @property
    def fall_detected(self) -> bool:
        return bool(self.data.get("fall_detected"))


def parse_timestamp(value: Any) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if isinstance(value, (int, float)):
        if value > 1_700_000_000:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        return datetime.now(timezone.utc)
    if isinstance(value, str):
        try:
            normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
            parsed = datetime.fromisoformat(normalized)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            if parsed.year >= 2020:
                return parsed
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def sensor_from_topic(topic: str, payload: dict[str, Any]) -> Literal["room", "wearable"]:
    raw = str(payload.get("sensor", "")).lower()
    if raw in ("room", "wearable"):
        return raw  # type: ignore[return-value]
    parts = topic.split("/")
    if "room" in parts:
        return "room"
    return "wearable"


def device_id_from_topic(topic: str, payload: dict[str, Any], sensor: str) -> str:
    raw = payload.get("device_id")
    if raw:
        return str(raw).strip()
    parts = topic.split("/")
    if len(parts) >= 4 and parts[0] == "caretrack":
        return parts[1]
    if topic == "cardiac/monitor/data":
        return "ESP32-CardiacMonitor"
    return "room-unit-01" if sensor == "room" else "wearable-01"


def payload_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if isinstance(data, dict):
        return data
    readings = payload.get("readings")
    if isinstance(readings, dict):
        return readings
    return {
        key: value
        for key, value in payload.items()
        if key not in {"device_id", "sensor", "timestamp", "epoch", "topic"}
    }


def normalized_items(topic: str, sensor: str, data: dict[str, Any]) -> list[tuple[str, Any]]:
    aliases = {
        "heart_rate": "heart_rate",
        "hr": "heart_rate",
        "spo2": "spo2",
        "body_temp": "body_temp",
        "body_temperature": "body_temp",
        "fall_detected": "fall_detected",
        "accel_magnitude": "accel_magnitude",
        "humidity": "humidity",
        "motion": "motion",
        "motion_detected": "motion",
        "motion_detection": "motion",
        "motion_presence": "motion",
        "pir": "motion",
        "status": "status",
    }
    items: list[tuple[str, Any]] = []
    for key, value in data.items():
        metric = aliases.get(key)
        if key == "temperature":
            metric = "room_temp" if sensor == "room" or "/room/" in topic else "body_temp"
        elif key == "room_temp":
            metric = "room_temp"
        elif metric is None and key == "value" and "motion" in topic:
            metric = "motion"
        if metric:
            items.append((metric, value))
    return items


def validate_reading(metric: str, value: Any) -> ValidatedReading | None:
    try:
        if metric == "heart_rate":
            return HeartRate(value=value)
        if metric == "spo2":
            return SpO2(value=value)
        if metric == "body_temp":
            return BodyTemp(value=value)
        if metric == "motion":
            if isinstance(value, str):
                v_clean = value.strip().lower()
                if v_clean in ("yes", "y", "true", "1", "detected", "motion", "on"):
                    value = True
                elif v_clean in ("no", "n", "false", "0", "clear", "idle", "off"):
                    value = False
            elif isinstance(value, (int, float)):
                value = bool(value > 0.5)
            return Motion(value=bool(value))
        if metric == "fall_detected":
            return FallDetected(value=value)
        if metric == "room_temp":
            return RoomTemp(value=value)
        if metric == "humidity":
            return Humidity(value=value)
        if metric == "accel_magnitude":
            return AccelMagnitude(value=value)
        if metric == "status":
            status = 1.0 if str(value).lower() == "online" else 0.0
            return DeviceStatus(value=status)
    except ValidationError as exc:
        print(f"[Telemetry] Invalid {metric}: {exc}")
    return None


def parse_telemetry(topic: str, payload: dict[str, Any]) -> TelemetryEvent | None:
    sensor = sensor_from_topic(topic, payload)
    device_id = device_id_from_topic(topic, payload, sensor)
    timestamp = parse_timestamp(payload.get("timestamp") or payload.get("epoch"))
    data = payload_data(payload)
    readings = [
        reading
        for metric, value in normalized_items(topic, sensor, data)
        if (reading := validate_reading(metric, value)) is not None
    ]
    if not readings:
        return None
    return TelemetryEvent(
        topic=topic,
        device_id=device_id,
        sensor=sensor,
        timestamp=timestamp,
        readings=readings,
    )
