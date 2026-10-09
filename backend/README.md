# CareTrack Minimal Live Dashboard

FastAPI backend that subscribes to room-unit MQTT topics, stores readings in Postgres, and serves a simple live web dashboard.

## Setup

1. Copy env
```
cp .env.example .env
```
Fill `DATABASE_URL`, `MQTT_BROKER_URL`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`.

2. Create Postgres DB and table
```
psql -U user -d caretrack -f schema.sql
```
SQLAlchemy will auto-create on first run if table missing.

3. Install deps
```
pip install -r requirements.txt
```

4. Run server
```
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

Dashboard URL: http://localhost:8000/?device=CT-ROOM-001
Or open http://localhost:8000 and enter device_id then Connect.

## What it does

* MQTT subscriber subscribes to `caretrack/+/room/environment`, `caretrack/+/room/motion`, `caretrack/+/status`
* On each message parses device_id, sensor, timestamp, data and stores each metric as a row in `readings`
* WebSocket `/ws/live` broadcasts new readings to all connected browsers
* REST `GET /readings/latest?device_id=...` returns latest temp/humidity/motion for initial load

## Verify

When room-unit publishes:
```
[MQTT] Connected rc=0
[MQTT] Subscribed to caretrack/+/room/*
[MQTT] Received caretrack/CT-ROOM-001/room/environment from CT-ROOM-001
```
In browser you should see temperature, humidity cards update live, motion indicator turn green/red, and Last Seen refresh.

Logs show publish attempts and WebSocket broadcast.
