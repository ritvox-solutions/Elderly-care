import os
import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List

import paho.mqtt.client as mqtt
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal, get_db
from models import Alert, Device, DevicePairing, DeviceType, Patient, Reading
from core.alerting import process_emergency
from routers.auth import router as auth_router
from routers.thresholds import router as thresholds_router
from routers.patients import router as patients_router
from settings import get_settings
from telemetry import TelemetryEvent, parse_telemetry

settings = get_settings()
IS_VERCEL = bool(os.getenv("VERCEL"))

# Ensure tables exist (Alembic handles structured migrations in production)
def init_db_with_retry(max_retries: int = 3, delay_sec: float = 2.0):
    import time
    for attempt in range(1, max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            print("[Database] Schema verified and connected successfully.")
            return True
        except Exception as e:
            print(f"[Database] Connection attempt {attempt}/{max_retries} (Neon waking up): {e}")
            if attempt < max_retries:
                time.sleep(delay_sec)
    print("[Database Warning] Could not verify schema on initial boot. Server running with runtime reconnects.")
    return False

init_db_with_retry()

main_loop: asyncio.AbstractEventLoop | None = None


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"[WS] Client connected. Active listeners: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
            print(f"[WS] Client disconnected. Remaining: {len(self.active)}")

    async def broadcast(self, message: dict):
        dead = []
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


def store_event(event: TelemetryEvent):
    with SessionLocal() as s:
        for reading in event.readings:
            value = reading.value
            val = 1.0 if isinstance(value, bool) and value else 0.0 if isinstance(value, bool) else float(value)
            s.add(
                Reading(
                    device_id=event.device_id,
                    sensor_type=event.sensor,
                    metric=reading.metric,
                    value=val,
                    unit=reading.unit,
                    timestamp=event.timestamp,
                    received_at=datetime.now(timezone.utc),
                )
            )
        s.commit()


def alert_worker(event: TelemetryEvent):
    """Evaluate a telemetry event for emergencies and email caregivers.

    Runs in a thread-pool worker so SMTP/DB latency never blocks the MQTT
    loop or the HTTP ingest endpoint. Ordinary telemetry returns from
    detect_emergencies() before any database or network work happens.
    """
    try:
        alerts = process_emergency(event)
        if alerts and main_loop is not None and manager.active:
            messages = [alert_message(event, alert) for alert in alerts]

            async def fast_broadcast(msgs=messages):
                for message in msgs:
                    await manager.broadcast(message)

            asyncio.run_coroutine_threadsafe(fast_broadcast(), main_loop)
    except Exception as e:
        print(f"[ALERT Error] process_emergency: {e}")


def alert_message(event: TelemetryEvent, alert: Alert) -> dict:
    """Convert a persisted backend alert to the browser WebSocket contract."""
    return alert_record_message(alert, event.device_id)


def alert_record_message(alert: Alert, device_id: str | None = None) -> dict:
    """Convert a persisted alert to the shared web/mobile contract."""
    patient_name = None
    room_number = None
    if alert.patient_id:
        with SessionLocal() as session:
            patient = session.query(Patient).filter(Patient.id == alert.patient_id).first()
            if patient:
                patient_name = f"{patient.first_name} {patient.last_name}"
                room_number = patient.room_number
    created_at = alert.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {
        "type": "alert",
        "alert_id": str(alert.id),
        "device_id": device_id or alert.device_id,
        "timestamp": created_at.isoformat(),
        "category": alert.category,
        "severity": alert.severity,
        "metric": alert.triggering_metric,
        "value": alert.triggering_value,
        "message": alert.message,
        "patient_name": patient_name,
        "room_number": room_number,
    }


def broadcast_messages(event: TelemetryEvent) -> list[dict]:
    bundle = {
        "device_id": event.device_id,
        "sensor": event.sensor,
        "timestamp": event.timestamp.isoformat(),
        "data": event.data,
        "fall_detected": event.fall_detected,
    }
    per_metric = []
    for reading in event.readings:
        per_metric.append({
            "device_id": event.device_id,
            "sensor": event.sensor,
            "timestamp": event.timestamp.isoformat(),
            "metric": reading.metric,
            "value": reading.value,
            "unit": reading.unit,
            "fall_detected": event.fall_detected,
        })
        if reading.metric == "motion":
            per_metric.append({
                "device_id": event.device_id,
                "sensor": event.sensor,
                "timestamp": event.timestamp.isoformat(),
                "metric": "motion_detected",
                "value": reading.value,
                "unit": reading.unit,
                "fall_detected": event.fall_detected,
            })
    return [bundle, *per_metric]


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
if settings.mqtt_username:
    mqtt_client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
if settings.mqtt_tls_enabled:
    mqtt_client.tls_set()


def on_connect(client, userdata, flags, rc, properties=None):
    print(f"[MQTT] Connected rc={rc}")
    client.subscribe("caretrack/wearable/+")
    client.subscribe("caretrack/room/+")
    client.subscribe("caretrack/+/room/+")
    client.subscribe("caretrack/+/wearable/+")
    client.subscribe("cardiac/monitor/data")
    print("[MQTT] Subscribed to room and wearable telemetry topics")


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        event = parse_telemetry(msg.topic, payload)
        if event is None:
            return

        if event.fall_detected:
            accel_mag = event.data.get("accel_magnitude", 0.0)
            print(f"\n[CRITICAL EMERGENCY] FALL DETECTED on {event.device_id} ({accel_mag}g)!\n")

        if main_loop is not None:
            main_loop.run_in_executor(None, alert_worker, event)

        if main_loop is not None and manager.active:
            messages = broadcast_messages(event)

            async def fast_broadcast(msgs=messages):
                for m in msgs:
                    await manager.broadcast(m)

            asyncio.run_coroutine_threadsafe(fast_broadcast(), main_loop)

        if main_loop is not None:
            def db_worker():
                try:
                    store_event(event)
                except Exception as e:
                    print(f"[DB Error] store_event: {e}")

            main_loop.run_in_executor(None, db_worker)

        if not event.fall_detected:
            print(f"[MQTT] {msg.topic} -> {len(event.readings)} reading(s), {len(manager.active)} WS listener(s)")
    except Exception as e:
        print(f"[MQTT] Error processing message: {e}")


mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message


@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    if IS_VERCEL:
        print("[App] Running in Vercel Serverless environment: Skipping persistent MQTT background loop")
    else:
        print("[App] Starting MQTT client")
        try:
            mqtt_client.connect(settings.mqtt_broker_url, settings.mqtt_port, 60)
            mqtt_client.loop_start()
        except Exception as e:
            print(f"[App Warning] Could not connect to MQTT broker ({settings.mqtt_broker_url}:{settings.mqtt_port}): {e}")
    yield
    if not IS_VERCEL:
        print("[App] Shutting down MQTT client")
        try:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        except Exception:
            pass


app = FastAPI(
    title="CareTrack IoT Healthcare API",
    version="2.0.0",
    description="CareTrack Remote Healthcare, Patient Telemetry, and Alerting Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Authentication Router
app.include_router(auth_router)
app.include_router(thresholds_router)
app.include_router(patients_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/")
async def root():
    """Service index — the legacy HTML dashboards were removed with backend/static."""
    return {
        "service": "CareTrack API",
        "version": "2.0.0",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
        "api_prefix": "/api/v1",
        "websocket": "/ws/live",
    }


@app.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    token = ws.query_params.get("token") or ws.headers.get("x-caretrack-ws-token")
    if settings.ws_auth_token and token != settings.ws_auth_token:
        await ws.close(code=1008)
        return
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.get("/readings/latest")
def latest(
    device_id: str = Query(...),
    wearable_device_id: str | None = Query(None),
    s: Session = Depends(get_db),
):
    if not wearable_device_id:
        room_device = s.query(Device).filter(Device.device_identifier == device_id).first()
        room_pairing = (
            s.query(DevicePairing)
            .filter(DevicePairing.device_id == room_device.id, DevicePairing.is_active.is_(True))
            .first()
            if room_device
            else None
        )
        if room_pairing:
            wearable_device_id = (
                s.query(Device.device_identifier)
                .join(DevicePairing, DevicePairing.device_id == Device.id)
                .filter(
                    DevicePairing.patient_id == room_pairing.patient_id,
                    DevicePairing.is_active.is_(True),
                    Device.device_type == DeviceType.WEARABLE.value,
                )
                .scalar()
            )

    def wearable_reading(metric: str, *, positive: bool = False):
        if not wearable_device_id:
            return None
        query = s.query(Reading).filter(
            Reading.device_id == wearable_device_id,
            Reading.sensor_type == "wearable",
            Reading.metric == metric,
        )
        if positive:
            query = query.filter(Reading.value > 0)
        return query.order_by(Reading.timestamp.desc()).first()

    temp = (
        s.query(Reading)
        .filter(
            Reading.device_id == device_id,
            Reading.sensor_type == "room",
            Reading.metric.in_(["room_temp", "temperature"]),
        )
        .order_by(Reading.timestamp.desc())
        .first()
    )
    hum = (
        s.query(Reading)
        .filter(
            Reading.device_id == device_id,
            Reading.sensor_type == "room",
            Reading.metric == "humidity",
        )
        .order_by(Reading.timestamp.desc())
        .first()
    )
    mot = (
        s.query(Reading)
        .filter(
            Reading.device_id == device_id,
            Reading.sensor_type == "room",
            Reading.metric.in_(["motion", "motion_detected"]),
        )
        .order_by(Reading.timestamp.desc())
        .first()
    )

    hr = wearable_reading("heart_rate", positive=True)
    spo2 = wearable_reading("spo2", positive=True)
    cardio_temp = wearable_reading("body_temp", positive=True)
    room_last_seen = max((reading.timestamp for reading in (temp, hum, mot) if reading), default=None)

    def fmt(reading):
        if not reading:
            return None
        return {"value": reading.value, "timestamp": reading.timestamp.isoformat()}

    return {
        "device_id": device_id,
        "wearable_device_id": wearable_device_id,
        "temperature": fmt(temp),
        "humidity": fmt(hum),
        "motion_detected": fmt(mot),
        "motion": fmt(mot),
        "heart_rate": fmt(hr),
        "spo2": fmt(spo2),
        "cardio_temp": fmt(cardio_temp),
        "last_seen": room_last_seen.isoformat() if room_last_seen else None,
    }

@app.post("/api/v1/telemetry/ingest")
async def ingest_telemetry_http(
    payload: dict,
    x_telemetry_key: str | None = Header(default=None),
):
    """
    HTTP Telemetry Ingestion Webhook.
    Allows microcontrollers or cloud relays to push telemetry directly over HTTP to Vercel.
    """
    if settings.telemetry_ingest_key and x_telemetry_key != settings.telemetry_ingest_key:
        raise HTTPException(status_code=401, detail="Invalid telemetry key")

    topic = payload.get("topic", "caretrack/http_ingest")
    event = parse_telemetry(topic, payload)
    if event is None:
        return {"status": "error", "message": "Invalid or unparseable telemetry payload"}

    store_event(event)
    # Vercel may freeze the function after responding, so notification delivery
    # must finish before this request completes.
    alerts = await asyncio.to_thread(process_emergency, event)
    for alert in alerts:
        await manager.broadcast(alert_message(event, alert))
    return {
        "status": "success",
        "device_id": event.device_id,
        "readings_stored": len(event.readings),
        "alerts_created": len(alerts),
        "timestamp": event.timestamp.isoformat(),
    }


@app.get("/api/v1/alerts/latest")
def latest_alerts(
    device_ids: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Polling fallback for serverless deployments where WebSockets are not shared."""
    query = db.query(Alert)
    if device_ids:
        ids = [value.strip() for value in device_ids.split(",") if value.strip()]
        if ids:
            query = query.filter(Alert.device_id.in_(ids))
    if since:
        query = query.filter(Alert.created_at > since)
    rows = query.order_by(Alert.created_at.desc()).limit(limit).all()
    return [alert_record_message(alert) for alert in rows]
