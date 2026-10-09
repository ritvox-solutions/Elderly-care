# Technical Requirements Document (TRD)
## CareTrack — IoT Based Elderly Health Monitoring Companion App

---

## 1. System Architecture Overview

```
[Wearable: ESP32 + MAX30102 + MPU6050]  ---\
                                             \
[Room Unit: NodeMCU + PIR + DHT11]      -----> WiFi ---> MQTT Broker (HiveMQ Cloud)
                                             /
                                        (Topics per device_id)
                                             |
                                             v
                              MQTT Subscriber Service (FastAPI background worker)
                                             |
                                             v
                              Rule Engine (threshold + multi-signal alert logic)
                                             |
                        -----------------------------------------
                        |                                       |
                        v                                       v
                MongoDB (readings, alerts,                Push Notification Service
                devices, users, profiles)                  (Expo Push / FCM)
                        |                                       |
                        v                                       v
                 FastAPI REST + WebSocket API  <----------------
                        |
                        v
              React Native (Expo) Mobile App
              (Caregiver-facing UI)
```

**Communication pattern:**
- Devices → MQTT (lightweight, designed for constrained IoT devices, handles intermittent connectivity well).
- Backend subscribes to MQTT, persists to MongoDB, runs alert rules, and pushes to app via WebSocket (for live dashboard) + push notification (for alerts when app is backgrounded/closed).
- Mobile app → REST API for historical data, profile/device management; WebSocket for live vitals; push notifications for alerts.

---

## 2. Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Wearable firmware | Arduino C++ on ESP32 | Standard for MAX30102/MPU6050 libraries; matches synopsis hardware. |
| Room unit firmware | Arduino C++ on NodeMCU (ESP8266) | Standard for PIR/DHT11; matches synopsis hardware. |
| Device-to-cloud transport | MQTT (HiveMQ Cloud free tier or Mosquitto self-hosted) | Lightweight pub/sub, built for IoT, handles reconnects gracefully. |
| Backend framework | FastAPI (Python 3.11+) | Async support (good for MQTT + WebSocket concurrency), fast to build, matches your existing project notes. |
| MQTT client (backend) | `paho-mqtt` (Python) running as an async background task inside FastAPI (via `asyncio` + thread executor, or `gmqtt` for native async) | Reliable, widely used, integrates cleanly with FastAPI lifecycle. |
| Database | MongoDB (Atlas free tier) | Flexible schema good for varied sensor payloads; matches your existing project notes. Mongo's TTL indexes are useful for auto-expiring raw readings later if storage becomes a concern. |
| Real-time push to app (while app open) | WebSocket endpoint in FastAPI (`fastapi.WebSocket`) | Simple, no extra infra needed beyond FastAPI itself. |
| Push notifications (app closed/backgrounded) | Expo Push Notification Service | Free, integrates directly with Expo-managed React Native apps, no native Firebase setup needed for v1. |
| Mobile app framework | React Native + Expo (managed workflow) | Matches your standard stack; fastest path to a working demo on real devices via Expo Go. |
| State management (app) | React Context + `@tanstack/react-query` for server state | Simple enough for a 4-6 screen app; react-query handles caching/refetching of REST data cleanly. |
| Charts (app) | `react-native-gifted-charts` or `victory-native` | Both support line charts on RN/Expo without native linking headaches. |
| Auth | JWT (access + refresh token), issued by FastAPI, stored in Expo `SecureStore` on device | Standard, stateless, no extra auth infra needed for a project-scale app. |
| Backend hosting | Render.com / Railway (free tier) | Simple FastAPI deploy, WebSocket support included. |
| Device provisioning | Static device ID burned into firmware + printed QR code on device housing | Simple pairing UX without needing BLE provisioning flow. |

---

## 3. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Alert latency (sensor event → push notification) | < 5 seconds under normal WiFi conditions |
| Dashboard data refresh | ≤ 10 seconds staleness while app is open and device online |
| Backend uptime (demo period) | Best-effort; free-tier hosting acceptable, no SLA needed |
| Data retention | Raw sensor readings retained 30 days (via MongoDB TTL index); aggregated hourly/daily summaries retained indefinitely |
| Concurrent devices supported (v1) | 1–20 (project/demo scale, not production scale) |
| Security | JWT auth on all API endpoints; MQTT broker secured with per-device username/password or TLS client cert; no PII beyond name/age/emergency contact stored |
| Offline resilience (device side) | Device buffers up to 50 readings in local RAM/flash if MQTT publish fails, retries on reconnect; drops oldest if buffer full |
| Platform support (app) | Android + iOS via Expo Go for demo; installable APK/IPA build optional |

---

## 4. Device-to-Cloud Data Contract

### MQTT Topics

| Topic | Publisher | Payload |
|---|---|---|
| `caretrack/{device_id}/wearable/vitals` | ESP32 wearable | Heart rate, SpO₂, timestamp |
| `caretrack/{device_id}/wearable/motion` | ESP32 wearable | Fall-detected boolean, accelerometer raw values, timestamp |
| `caretrack/{device_id}/room/environment` | NodeMCU room unit | Temperature, humidity, timestamp |
| `caretrack/{device_id}/room/motion` | NodeMCU room unit | Motion-detected boolean, timestamp |
| `caretrack/{device_id}/status` | Both | Online/offline heartbeat (published every 60s) |

### Payload Schema (JSON, all topics)

```json
{
  "device_id": "CT-0001",
  "sensor": "wearable",
  "timestamp": "2026-08-18T10:32:00Z",
  "data": {
    "heart_rate": 78,
    "spo2": 97
  }
}
```

Fall event example:
```json
{
  "device_id": "CT-0001",
  "sensor": "wearable",
  "timestamp": "2026-08-18T10:32:05Z",
  "data": {
    "fall_detected": true,
    "accel_magnitude": 3.8
  }
}
```

Room unit example:
```json
{
  "device_id": "CT-0001",
  "sensor": "room",
  "timestamp": "2026-08-18T10:32:00Z",
  "data": {
    "temperature": 29.4,
    "humidity": 55,
    "motion_detected": false
  }
}
```

**Rule for AI coding agent:** Keep every MQTT payload flat and small (ESP32/NodeMCU have limited RAM/serialization capability). Do not nest more than 2 levels deep.

---

## 5. Alert Rule Engine Logic (multi-parameter verification)

This is the core "reduce false alarms" requirement from the synopsis. Implement as a rules module the backend runs on every incoming reading.

**Alert severities:**
- `WATCH` — one signal out of range, logged, shown in app with a yellow badge, no push notification.
- `CRITICAL` — push notification sent immediately, red badge, requires acknowledgment.

**Rules (v1):**

1. **Fall detected** → always `CRITICAL` immediately (single signal is sufficient — a fall is unambiguous and time-critical).
2. **Heart rate out of range** (default safe range 50–120 bpm, configurable per profile) → `WATCH` on first occurrence. Escalate to `CRITICAL` if still out of range on the next reading within 60 seconds (i.e., 2 consecutive abnormal readings).
3. **SpO₂ below threshold** (default < 92%) → same escalation pattern as heart rate (2 consecutive readings within 60s → `CRITICAL`).
4. **Combined signal** — if heart rate abnormal AND SpO₂ abnormal at the same time → `CRITICAL` immediately (don't wait for 2nd reading; two independent abnormal vitals together is already strong evidence).
5. **Inactivity** — if room unit reports zero motion for a configurable window (default: 4 continuous hours during 6am–10pm "waking hours") → `WATCH`. If it extends past 6 hours → `CRITICAL`.
6. **Temperature/environment** — room temperature is informational only in v1 (not used for alerting) unless it crosses an extreme threshold (< 10°C or > 40°C ambient), which raises a `WATCH` (possible AC/heating failure, indirect risk factor).

**Rule engine should be a standalone Python module** (e.g., `alert_rules.py`) with pure functions taking recent readings + profile thresholds and returning an alert decision — this makes it independently unit-testable and easy for an AI agent to modify later.

---

## 6. API Surface (high-level; full detail in Backend Schema doc)

- `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`
- `POST /devices/pair` — link a device ID to an elderly profile
- `GET /profiles/{profile_id}` — elderly profile + linked device + linked caregivers
- `POST /profiles/{profile_id}/caregivers/invite` — generate invite code
- `POST /caregivers/join` — join via invite code
- `GET /profiles/{profile_id}/readings/latest` — current vitals snapshot
- `GET /profiles/{profile_id}/readings/history?range=24h|7d|30d&metric=heart_rate|spo2|...`
- `GET /profiles/{profile_id}/alerts` — alert history
- `POST /alerts/{alert_id}/acknowledge`
- `WS /ws/profiles/{profile_id}` — live vitals + live alert stream

---

## 7. Environment & Config

- `.env` variables needed: `MONGODB_URI`, `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `JWT_SECRET`, `EXPO_ACCESS_TOKEN` (for push), `ENV` (dev/prod).
- Firmware-side config: WiFi SSID/password, MQTT broker host, device_id — stored in a `config.h` per device, not hardcoded inline (so the AI agent generates one config template, not per-device duplication).

---

## 8. Testing Requirements

- Unit tests for the alert rule engine (this is the most logic-heavy, highest-value part to test — cover all 6 rules above with edge cases).
- API endpoint tests using FastAPI's `TestClient` for auth, pairing, and alert acknowledgment flows.
- Manual test plan for hardware: simulate fall (shake sensor), simulate low SpO₂ reading (finger removal from MAX30102), simulate room inactivity (leave PIR unit alone) — document expected app behavior for each in a test checklist (see Implementation Plan doc).

---

## 9. Known Technical Risks

| Risk | Mitigation |
|---|---|
| MAX30102 readings are noisy with hand movement | Apply a simple moving-average filter (5-sample window) in firmware before publishing |
| MQTT broker free tier connection limits | Use one shared connection per device (not per-sensor), reuse for all 4 topics |
| Expo push notifications require physical device testing (don't work fully in simulator) | Plan device testing time explicitly in the implementation schedule |
| WiFi dropouts common in real elderly homes | Firmware buffers last 50 readings and retries publish on reconnect (already specified above) |
