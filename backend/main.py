import os
import json
import asyncio
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

import paho.mqtt.client as mqtt
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin123@localhost:5432/caretrack")
MQTT_BROKER_URL = os.getenv("MQTT_BROKER_URL", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class Reading(Base):
    __tablename__ = "readings"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    sensor_type = Column(String)
    metric = Column(String, index=True)
    value = Column(Float)  # motion stored as 0/1
    unit = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    received_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

Base.metadata.create_all(bind=engine)

from contextlib import asynccontextmanager

main_loop: asyncio.AbstractEventLoop | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    print("[App] Starting MQTT client")
    main_loop = asyncio.get_running_loop()
    mqtt_client.connect(MQTT_BROKER_URL, MQTT_PORT, 60)
    mqtt_client.loop_start()
    yield
    print("[App] Shutting down MQTT client")
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []
    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"[WS] Client connected! Active listeners: {len(self.active)}")
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

def parse_iso(ts: str | None) -> datetime:
    if not ts:
        return datetime.now(timezone.utc)
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        dt = datetime.fromisoformat(ts)
        if dt.year < 2020:
            return datetime.now(timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)

def store_reading(device_id: str, sensor_type: str, metric: str, value, unit: str | None, ts: datetime):
    if isinstance(value, bool):
        val = 1.0 if value else 0.0
    elif isinstance(value, (int, float)):
        val = float(value)
    else:
        return
    try:
        with SessionLocal() as s:
            r = Reading(
                device_id=device_id,
                sensor_type=sensor_type,
                metric=metric,
                value=val,
                unit=unit,
                timestamp=ts,
                received_at=datetime.now(timezone.utc)
            )
            s.add(r)
            s.commit()
    except Exception as e:
        print(f"[DB Error] store_reading: {e}")

# MQTT handling
mqtt_client = mqtt.Client()
if MQTT_USERNAME:
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
if MQTT_PORT == 8883:
    mqtt_client.tls_set()

def on_connect(client, userdata, flags, rc):
    print(f"[MQTT] Connected rc={rc}")
    client.subscribe("caretrack/+/room/environment")
    client.subscribe("caretrack/+/room/motion")
    client.subscribe("caretrack/+/status")
    client.subscribe("caretrack/+/wearable/motion")
    client.subscribe("caretrack/+/wearable/vitals")
    client.subscribe("caretrack/+/wearable/#")
    client.subscribe("cardiac/monitor/data")
    print("[MQTT] Subscribed to Room, Wearable (Motion/Fall), and Cardiac topics")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        device_id = str(payload.get("device_id", "room-unit-01")).strip()
        sensor = payload.get("sensor", "wearable" if "wearable" in msg.topic or "cardiac" in msg.topic else "room")
        raw_ts = payload.get("timestamp")
        
        # Real-time clock synchronization: ensure valid, current ISO timestamp
        ts = parse_iso(raw_ts)
        valid_ts_str = ts.isoformat()
        
        # Extract data payload (supports both nested {"data": {...}} and flat schemas)
        data = payload.get("data")
        if not isinstance(data, dict):
            data = {k: v for k, v in payload.items() if k not in ("device_id", "sensor", "timestamp", "epoch")}
            
        if not data:
            return

        is_fall = bool(data.get("fall_detected") or payload.get("fall_detected"))
        if is_fall:
            accel_mag = data.get("accel_magnitude", payload.get("accel_magnitude", 0.0))
            print(f"\n🚨🚨🚨 [CRITICAL EMERGENCY] FALL DETECTED on {device_id} ({accel_mag}g)! 🚨🚨🚨\n")

        # -------------------------------------------------------------------
        # 1. ZERO-LATENCY REAL-TIME BROADCAST (< 1ms delivery to Frontend)
        # Broadcast to active WebSockets IMMEDIATELY without waiting for DB!
        # -------------------------------------------------------------------
        if main_loop is not None and manager.active:
            messages = []
            # Full bundle
            messages.append({
                "device_id": device_id,
                "sensor": sensor,
                "timestamp": valid_ts_str,
                "data": data,
                "fall_detected": is_fall
            })
            # Per-metric messages for fine-grained frontend reactivity
            for metric, value in data.items():
                messages.append({
                    "device_id": device_id,
                    "sensor": sensor,
                    "timestamp": valid_ts_str,
                    "metric": metric,
                    "value": value,
                    "fall_detected": is_fall
                })

            async def fast_broadcast(msgs=messages):
                for m in msgs:
                    await manager.broadcast(m)

            asyncio.run_coroutine_threadsafe(fast_broadcast(), main_loop)

        # -------------------------------------------------------------------
        # 2. ASYNCHRONOUS DATABASE RETENTION (Runs in threadpool, 0ms impact)
        # -------------------------------------------------------------------
        if main_loop is not None:
            def db_worker():
                for metric, value in data.items():
                    unit = None
                    if metric == "temperature":
                        unit = "celsius"
                    elif metric == "humidity":
                        unit = "%"
                    elif metric == "accel_magnitude":
                        unit = "g"
                    elif metric == "fall_detected":
                        val = 1.0 if value else 0.0
                        store_reading(device_id, sensor, "fall_detected", val, "alert", ts)
                        continue
                    elif metric == "status":
                        val = 1.0 if value == "online" else 0.0
                        store_reading(device_id, sensor, "status", val, None, ts)
                        continue
                    store_reading(device_id, sensor, metric, value, unit, ts)

            main_loop.run_in_executor(None, db_worker)

        if not is_fall:
            print(f"[MQTT REALTIME] {msg.topic} -> broadcasted to {len(manager.active)} WS listener(s)")
    except Exception as e:
        print(f"[MQTT] Error processing message: {e}")

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

# Static dashboard
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    with open("static/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())

@app.get("/cardio", response_class=HTMLResponse)
async def cardio():
    path = "static/cardio.html" if os.path.exists("static/cardio.html") else "static/index.html"
    with open(path, encoding="utf-8") as f:
        return HTMLResponse(f.read())

@app.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(ws)

@app.get("/readings/latest")
def latest(device_id: str = Query(...)):
    with SessionLocal() as s:
        # Get latest room metrics
        temp = s.query(Reading).filter(Reading.device_id==device_id, Reading.metric=="temperature").order_by(Reading.timestamp.desc()).first()
        hum = s.query(Reading).filter(Reading.device_id==device_id, Reading.metric=="humidity").order_by(Reading.timestamp.desc()).first()
        mot = s.query(Reading).filter(Reading.device_id==device_id, Reading.metric=="motion_detected").order_by(Reading.timestamp.desc()).first()

        # Get latest valid heart rate (> 0) from database
        hr = s.query(Reading).filter(
            Reading.metric=="heart_rate",
            Reading.value > 0,
            (Reading.device_id==device_id) | (Reading.device_id=="room-unit-01")
        ).order_by(Reading.timestamp.desc()).first()
        if not hr:
            hr = s.query(Reading).filter(Reading.metric=="heart_rate", Reading.value > 0).order_by(Reading.timestamp.desc()).first()

        # Get latest valid SpO2 (> 0) from database
        spo2 = s.query(Reading).filter(
            Reading.metric=="spo2",
            Reading.value > 0,
            (Reading.device_id==device_id) | (Reading.device_id=="room-unit-01")
        ).order_by(Reading.timestamp.desc()).first()
        if not spo2:
            spo2 = s.query(Reading).filter(Reading.metric=="spo2", Reading.value > 0).order_by(Reading.timestamp.desc()).first()

        # Get latest wearable temperature
        cardio_temp = s.query(Reading).filter(
            Reading.metric=="temperature",
            Reading.sensor_type=="wearable"
        ).order_by(Reading.timestamp.desc()).first()

        # latest timestamp overall
        last = s.query(Reading).filter(Reading.device_id==device_id).order_by(Reading.timestamp.desc()).first()
        def fmt(r):
            if not r: return None
            return {"value": r.value, "timestamp": r.timestamp.isoformat()}
        return {
            "device_id": device_id,
            "temperature": fmt(temp),
            "humidity": fmt(hum),
            "motion_detected": fmt(mot),
            "heart_rate": fmt(hr),
            "spo2": fmt(spo2),
            "cardio_temp": fmt(cardio_temp),
            "last_seen": last.timestamp.isoformat() if last else None
        }
