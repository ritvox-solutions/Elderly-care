# CareTrack Project Summary

## Overview

CareTrack is an IoT-based elderly health and cardiac risk monitoring system. It combines wearable biometric sensing, room environment monitoring, MQTT telemetry, a FastAPI backend, PostgreSQL persistence, and a live React web dashboard.

The project is currently best described as a working web-dashboard demo for real-time telemetry monitoring, with documentation that also outlines a larger future companion-app product.

## Repository Structure

- `firmware/` contains Arduino sketches for the hardware units.
  - `Room-Kit/firmware.ino` runs on a NodeMCU ESP8266 with DHT11 and PIR sensors.
  - `wearbale/firmware/firmware.ino` runs on an ESP32 wearable with MAX30102, MPU6050, OLED, and fall detection.
- `backend/` contains the FastAPI server.
  - Subscribes to MQTT topics.
  - Stores readings in PostgreSQL.
  - Broadcasts live readings over WebSocket.
  - Serves static dashboard HTML pages.
- `frontend/` contains the Vite + React + TypeScript dashboard.
  - Displays room telemetry, cardiac vitals, fall alerts, history, and settings.
  - Uses backend REST/WebSocket APIs for room data.
  - Currently connects directly to HiveMQ for cardiac telemetry.
- `web_dashboard/` contains a standalone HTML dashboard.
- `docs/` contains product, technical, flow, UI/UX, schema, and implementation planning documents.
- Root-level PDFs and sketches contain academic/project reference material and standalone firmware.

## Architecture

The intended data flow is:

1. ESP32 wearable and ESP8266 room unit collect sensor readings.
2. Devices publish JSON telemetry to HiveMQ Cloud over MQTT.
3. FastAPI backend subscribes to MQTT topics.
4. Backend stores readings in PostgreSQL.
5. Backend broadcasts live readings to browser clients through `/ws/live`.
6. React frontend visualizes the live stream and recent data.

Core telemetry includes:

- Heart rate
- SpO2
- Wearable/body temperature
- Room temperature
- Room humidity
- Motion detection
- Fall detection
- Device status

## Current Implementation Status

Working pieces:

- React frontend builds successfully.
- Backend imports successfully when run through the project-managed Python environment.
- MQTT ingestion, database writes, REST latest-reading lookup, and WebSocket broadcasting are implemented.
- Firmware publishes room, cardiac, and fall telemetry.
- A sensor simulator exists for hardware-free MQTT testing.

Not yet fully implemented:

- User authentication
- Caregiver accounts
- Device pairing workflow
- Backend alert rule engine
- Push notifications
- Multi-caregiver alert synchronization
- Persistent history API for 24h/7d/30d charts
- Production-grade security hardening

## Setup Summary

Backend:

```powershell
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Simulator:

```powershell
cd backend
uv run python simulate_sensors.py
```

The frontend development server runs on `http://localhost:5173` and proxies backend REST/WebSocket calls to `http://localhost:8000`.

## Verification Performed

- `npm run build` in `frontend` completed successfully.
- `npm run lint` in `frontend` completed with warnings only.
- `uv run python -c "import main"` in `backend` completed successfully with a test database URL.

## Key Risks And Issues

1. Secrets are currently exposed in source-controlled or hardcoded locations.
   - MQTT credentials are hardcoded in firmware, simulator, static HTML, and React source.
   - `backend/.env` is tracked by git.
   - `.gitignore` does not currently exclude `.env` files.

2. Documentation and implementation are not fully aligned.
   - Docs describe MongoDB, JWT auth, Expo mobile app, push notifications, and multi-caregiver workflows.
   - Current implementation uses PostgreSQL, a web dashboard, localStorage alerts, and no authentication.

3. Backend security is demo-oriented.
   - CORS is open to all origins.
   - WebSocket endpoint has no authentication.
   - Static file paths are relative to the launch directory.

4. Alert handling is mostly frontend-local.
   - Alerts are stored in browser localStorage.
   - Acknowledgement and resolution are not persisted or shared across caregivers.
   - The documented multi-parameter backend rule engine is not implemented yet.

5. Browser-side MQTT exposes broker access.
   - The frontend directly connects to HiveMQ for cardiac telemetry.
   - A production version should relay MQTT data through the backend instead.

## Recommended Next Steps

1. Rotate exposed MQTT and WiFi credentials.
2. Remove `backend/.env` from git and add `.env` patterns to `.gitignore`.
3. Move frontend cardiac telemetry to backend WebSocket events instead of direct browser MQTT.
4. Implement a backend alert rule module with unit tests.
5. Add persistent history endpoints for dashboard charts.
6. Update documentation to clearly separate current implementation from planned product scope.
7. Harden backend configuration, CORS, WebSocket access, and static file path handling.

## Project Positioning

CareTrack is currently strong as a student/demo IoT health monitoring project. It demonstrates end-to-end sensor telemetry from hardware or simulator through MQTT, backend persistence, live WebSocket delivery, and a polished browser dashboard.

To become a deployable caregiver product, the next major milestone is moving alerting, authentication, history, and caregiver coordination into the backend instead of relying on local browser state.
