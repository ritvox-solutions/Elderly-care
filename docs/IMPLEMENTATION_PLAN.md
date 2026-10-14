# CareTrack: Production-Grade IoT Healthcare Platform
## Master Implementation Plan & System Architecture

**Document Version:** 2.0.0  
**Date:** October 2026  
**Status:** Approved for Implementation (Phase 1 In Progress)  
**Target Environment:** Local Docker Compose + Cloud Production (PostgreSQL + HiveMQ Cloud TLS)

---

## 1. Executive Summary & System Overview

**CareTrack** is a mission-critical, healthcare-grade IoT telemonitoring and caregiver coordination platform designed for elderly individuals, cardiac patients, and post-fall recovery care. The system integrates ambient non-invasive environmental sensing (temperature, humidity, presence/motion) with wearable physiological monitoring (heart rate, SpO2, skin temperature, 3-axis acceleration, and instantaneous fall shocks).

Telemetry flows from edge devices via encrypted TLS MQTT (port 8883) to an asynchronous FastAPI backend service, persists into a normalized PostgreSQL database, triggers a deterministic clinical alert engine, and streams in real-time (<1ms) to authenticated web dashboards via WebSockets.

This document establishes the architecture, migration path, and implementation phases to transition CareTrack from a research prototype into a **hardened, secure, role-based medical-IoT software platform**.

---

## 2. Current Architecture & Inspection Findings

A thorough audit of the existing codebase (`firmware/`, `backend/`, `frontend/`, `web_dashboard/`, and `docs/`) revealed the following baseline:

### 2.1 Working Features
- **Room Kit Firmware (`firmware/Room-Kit/firmware.ino`)**:
  - NodeMCU (ESP8266) firmware integrating DHT11 (temperature and humidity on D5) and PIR motion sensor (on D2).
  - Secure TLS connection (`WiFiClientSecure`, port 8883) to HiveMQ Cloud with offline RAM buffer ring (`addBuf`/`flushBuf`).
  - Zero-delay instant motion dispatch on change, plus 2-second periodic streaming of room temperature and humidity.
- **Wearable Unit Firmware (`firmware/wearbale/firmware/firmware.ino`)**:
  - ESP32 firmware communicating with MAX30102 (pulse oximetry) and MPU6050 (6-axis IMU) over I2C with SH1106 OLED status display.
  - Publishes validated biometric packets (`cardiac/monitor/data`, `caretrack/{id}/wearable/vitals`, `caretrack/{id}/wearable/motion`) with instantaneous fall threshold shocks.
- **Backend Core Ingestion (`backend/main.py`, `backend/telemetry.py`)**:
  - Paho-MQTT client subscribed to canonical topics (`caretrack/+/room/+`, `caretrack/+/wearable/+`, `cardiac/monitor/data`).
  - Pydantic v2 telemetry parser (`telemetry.py`) supporting metric normalization and validation (heart rate 20-240 bpm, SpO2 0-100%, temperatures, motion, accelerometer magnitude).
  - Asynchronous database worker inserting records into `readings` table.
  - WebSocket hub (`ConnectionManager`) broadcasting live bundles to connected browsers.
- **Hardware-Free Telemetry Simulator (`backend/simulate_sensors.py`)**:
  - Functional simulation script generating realistic room climate cycles, cardiac waveforms, and synthetic fall shock events for local testing.

### 2.2 Broken, Fragile, or Non-Standard Components
- **Direct Database Coupling**: `main.py` directly executes `Base.metadata.create_all(bind=engine)` upon startup with a single flat table (`readings`). No migration system (Alembic) is configured.
- **Global Ingestion Without Patient Association**: Telemetry readings are stored with arbitrary `device_id` strings without verifying whether the device is registered, activated, or paired to an actual patient.
- **Frontend Architecture Disconnect**: The current `frontend/` relies on custom CSS (`caretrack.css`) and lacks a component design system (Tailwind CSS, shadcn/ui), lacks modern query state management (TanStack Query), lacks Lucide icons, and lacks Recharts for analytics.
- **In-Memory Fall Alerting**: Fall events currently trigger a temporary terminal print and a client-side audio beep; there is no backend state machine for tracking, assigning, acknowledging, or resolving emergency incidents.

### 2.3 Critical Security Vulnerabilities
1. **Unauthenticated Endpoints & WebSockets**: `/ws/live` and `/readings/latest` are public or rely on an optional static token. Anyone can inspect confidential patient biometrics.
2. **Absence of Authentication & RBAC**: No user registration, password hashing, session tokens, or caregiver/administrator role separation exists.
3. **Hardcoded Credentials & Configuration Leaks**: Firmware files and configuration templates previously contained embedded Wi-Fi and HiveMQ passwords. `.env` was committed in git history.
4. **Lack of Rate Limiting & Input Sanitization**: REST endpoints lack rate limiting and brute-force protection.
5. **No Audit Trail**: Security-sensitive actions (profile modifications, alert dismissals, device reassignments) are not logged.

### 2.4 Missing Features Required for Production
- Normalized PostgreSQL domain models: `users`, `patients`, `caregiver_assignments`, `devices`, `device_pairings`, `alert_rules`, `alerts`, `alert_events`, `notifications`, `audit_logs`.
- Backend-owned Alert Engine with configurable thresholds, cooldown windows, deduplication, and caregiver acknowledgement workflows.
- Historical data aggregation engine (24h, 7d, 30d) with min/max/average rollups, gap detection, pagination, and authenticated CSV export.
- Complete Patient CRUD & Device Inventory Management.
- Notification service abstraction (In-App, Browser Notification API, Email provider).
- Modern, accessible React frontend with Tailwind CSS, shadcn/ui, Recharts, and Lucide icons.

---

## 3. Required Target Architecture

```
+------------------------------------------------------------------------+
|                        CLIENT / FRONTEND LAYER                         |
|                                                                        |
|   React 19 / TypeScript / Vite / Tailwind CSS / shadcn/ui / Recharts   |
|   - Protected Routes (Caregiver vs Administrator)                      |
|   - TanStack Query (Server State, Caching, Polling)                    |
|   - Resilient WebSocket Client with Auto-Reconnect                     |
|   - Live Telemetry Stream, Patient CRUD, Alert Desk, Historical Visuals|
+-----------------------------------+------------------------------------+
                                    | HTTPS / WSS (HTTP-only JWT Cookies)
                                    v
+------------------------------------------------------------------------+
|                      BACKEND APPLICATION LAYER                         |
|                                                                        |
|   FastAPI (Python 3.10+)                                               |
|   - Routers: /auth, /patients, /devices, /telemetry, /alerts, /audit   |
|   - Auth: Bcrypt password hashing, Secure JWT, RBAC Middleware         |
|   - Alert Engine: Cooldown filters, Clinical Threshold Rule Evaluator  |
|   - Asynchronous Background Ingestion (Paho-MQTT TLS 8883 Subscriber)  |
|   - WebSocket Hub: Authenticated, Channel-Partitioned per Patient      |
|   - Notification Service: In-App Event Dispatcher & Email Provider     |
+-----------------------------------+------------------------------------+
                                    |
                    +---------------+---------------+
                    v                               v
+---------------------------------------+ +------------------------------+
|            PERSISTENCE LAYER          | |     MESSAGING BROKER         |
|                                       | |                              |
|   PostgreSQL 14+                      | |   HiveMQ Cloud MQTT (TLS)    |
|   - SQLAlchemy 2.0 Declarative Models | |   - Port 8883                |
|   - Alembic Migrations                | |   - Topics: caretrack/#      |
|   - B-tree Indexes on (device, ts)    | |   - Sub-millisecond IoT feed |
+---------------------------------------+ +------------------------------+
```

---

## 4. Normalized Database Schema & Migration Plan

### 4.1 Relational Entity Model
The database is structured to support multi-tenant isolation, role-based caregiver assignments, device pairing history, and high-throughput telemetry storage.

1. **`users`**:
   - `id` (UUID, PK), `email` (unique, indexed), `hashed_password` (varchar), `full_name` (varchar), `role` (`ADMIN`, `CAREGIVER`), `phone_number` (varchar, nullable), `is_active` (bool), `created_at` (timestamptz), `updated_at` (timestamptz).
2. **`patients`**:
   - `id` (UUID, PK), `first_name` (varchar), `last_name` (varchar), `date_of_birth` (date), `gender` (varchar), `room_number` (varchar, nullable), `medical_notes` (text, nullable), `emergency_contact_name` (varchar), `emergency_contact_phone` (varchar), `created_by` (FK -> users.id), `created_at`, `updated_at`.
3. **`caregiver_assignments`**:
   - `id` (UUID, PK), `caregiver_id` (FK -> users.id), `patient_id` (FK -> patients.id), `is_primary` (bool), `assigned_at` (timestamptz). Unique index on `(caregiver_id, patient_id)`.
4. **`devices`**:
   - `id` (UUID, PK), `device_identifier` (varchar, unique, e.g., `room-unit-01`, `ESP32-CardiacMonitor`), `device_type` (`WEARABLE`, `ROOM_KIT`), `mac_address` (varchar, nullable), `firmware_version` (varchar, nullable), `status` (`ONLINE`, `OFFLINE`, `UNPAIRED`), `last_seen_at` (timestamptz, nullable), `created_at`.
5. **`device_pairings`**:
   - `id` (UUID, PK), `device_id` (FK -> devices.id), `patient_id` (FK -> patients.id), `paired_at` (timestamptz), `unpaired_at` (timestamptz, nullable), `is_active` (bool).
6. **`readings` (Telemetry Storage)**:
   - Preserves compatibility with existing physical sensors:
   - `id` (BigSerial / BigInt PK), `device_id` (varchar, indexed), `patient_id` (UUID, FK -> patients.id, nullable, indexed), `sensor_type` (varchar: `room`, `wearable`), `metric` (varchar: `heart_rate`, `spo2`, `body_temp`, `room_temp`, `humidity`, `motion`, `accel_magnitude`), `value` (double precision), `unit` (varchar, nullable), `timestamp` (timestamptz, indexed), `received_at` (timestamptz).
   - Composite indexes: `(device_id, metric, timestamp DESC)`, `(patient_id, metric, timestamp DESC)`.
7. **`alert_rules`**:
   - `id` (UUID, PK), `patient_id` (FK -> patients.id, nullable for global defaults), `metric` (varchar), `condition` (`GT`, `LT`, `EQUALS`), `warning_threshold` (double precision), `critical_threshold` (double precision), `cooldown_seconds` (int, default 300), `is_enabled` (bool).
8. **`alerts`**:
   - `id` (UUID, PK), `patient_id` (FK -> patients.id), `device_id` (varchar), `category` (`FALL`, `CARDIAC`, `ENVIRONMENT`, `DEVICE_OFFLINE`), `severity` (`INFO`, `WARNING`, `CRITICAL`), `triggering_metric` (varchar), `triggering_value` (double precision), `message` (text), `status` (`ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`), `created_at` (timestamptz), `acknowledged_at` (timestamptz, nullable), `acknowledged_by` (FK -> users.id, nullable), `resolved_at` (timestamptz, nullable), `resolved_by` (FK -> users.id, nullable), `resolution_notes` (text, nullable).
9. **`notifications`**:
   - `id` (UUID, PK), `alert_id` (FK -> alerts.id), `user_id` (FK -> users.id), `channel` (`IN_APP`, `EMAIL`, `BROWSER`), `status` (`PENDING`, `DELIVERED`, `FAILED`), `delivered_at` (timestamptz, nullable), `error_message` (text, nullable).
10. **`audit_logs`**:
    - `id` (UUID, PK), `user_id` (FK -> users.id, nullable for system actions), `action` (varchar, e.g., `PATIENT_UPDATED`, `ALERT_RESOLVED`, `DEVICE_PAIRED`), `resource_type` (varchar), `resource_id` (varchar), `details` (jsonb), `ip_address` (varchar, nullable), `created_at` (timestamptz).

### 4.2 Alembic Migration Strategy
1. **Zero Data Loss**: Existing `readings` rows are preserved without column deletion or destruction.
2. **Phase 1 Baseline Migration**:
   - Initialize Alembic environment in `backend/alembic`.
   - Migration `001_initial_core_schema.py`: Generates the core normalized tables while linking safely to existing `readings`.
   - Seed script creates initial administrative account and standard clinical alert rules.

---

## 5. API & Interface Contracts

### 5.1 Authentication (`/api/v1/auth`)
- `POST /login` -> Validates credentials; sets secure HTTP-only session cookie (or Bearer token) + user metadata.
- `POST /register` -> Caregiver/Administrator onboarding.
- `POST /logout` -> Clears HTTP-only cookie and revokes session.
- `GET /me` -> Returns current authenticated user and assigned patient IDs.
- `POST /forgot-password` & `POST /reset-password` -> Secure token-based credential recovery.

### 5.2 Patient Management (`/api/v1/patients`)
- `GET /` -> List all patients accessible to the authenticated caregiver (or all for Admin).
- `POST /` -> Create a new patient profile.
- `GET /{id}` -> Retrieve detailed patient profile, care notes, linked devices, and active alerts.
- `PUT /{id}` -> Update patient profile and threshold preferences.
- `DELETE /{id}` -> Soft-delete or archive patient profile (Admin only).
- `POST /{id}/caregivers` -> Assign caregiver to patient.

### 5.3 Device Inventory & Pairing (`/api/v1/devices`)
- `GET /` -> List registered devices, hardware types, and online status.
- `POST /` -> Register new hardware identifier (`device_identifier`, `device_type`).
- `POST /{id}/pair` -> Pair device to a specific patient.
- `POST /{id}/unpair` -> Unlink device from patient.
- `GET /{id}/diagnostics` -> Returns signal strength (RSSI), battery, and packet reception rates.

### 5.4 Telemetry & Analytics (`/api/v1/telemetry`)
- `GET /latest?patient_id={id}` -> Returns most recent readings for all metrics associated with patient.
- `GET /history?patient_id={id}&metric={m}&range={24h|7d|30d}` -> Returns aggregated time-series buckets (min, max, average, count) with missing-gap flags.
- `GET /export?patient_id={id}&format=csv` -> Authorized CSV export of sensor telemetry.

### 5.5 Alert Desk (`/api/v1/alerts`)
- `GET /` -> Query active or historical alerts with severity/status filters.
- `POST /{id}/acknowledge` -> Marks alert as acknowledged by current caregiver.
- `POST /{id}/resolve` -> Resolves alert with mandatory resolution notes.
- `GET /rules` & `PUT /rules/{id}` -> Configure warning and critical thresholds.

### 5.6 WebSocket Live Telemetry (`/api/v1/ws/live`)
- **Connection**: `ws://<host>/api/v1/ws/live?token=<jwt>` (or via authenticated cookie).
- **Protocol**:
  - Client can send subscription filters: `{"action": "subscribe", "patient_id": "uuid"}`.
  - Server streams live validated metrics, connection heartbeats, and emergency fall alerts with sub-millisecond dispatch.

---

## 6. Implementation Phases

### Phase 1: Foundation, Data Models, Alembic Migrations, Auth Core & Test Harness
- Complete repository audit and publish `docs/IMPLEMENTATION_PLAN.md`.
- Implement SQLAlchemy 2.0 declarative models for `User`, `Patient`, `CaregiverAssignment`, `Device`, `DevicePairing`, `Reading`, `AlertRule`, `Alert`, `Notification`, and `AuditLog`.
- Configure Alembic and create initial baseline migration script (`001_initial_core_schema.py`).
- Implement password hashing (bcrypt), JWT token manager, and authentication endpoints (`/api/v1/auth/register`, `/login`, `/me`, `/logout`).
- Preserve existing sensor payload ingestion backward compatibility.
- Build comprehensive Pytest suite validating models, migrations, auth, and telemetry parsing.

### Phase 2: Patient & Device CRUD, Pairing Engine & Audit Trail
- Implement Patient CRUD REST routers with caregiver authorization filters.
- Implement Device management, registration, and active pairing/unpairing workflows.
- Update telemetry ingestion worker to dynamically map device telemetry to active paired patients.
- Implement security audit logging decorator.

### Phase 3: Alert Engine, Rule Evaluator & Notification Dispatcher
- Implement backend-owned alert engine evaluating incoming telemetry against clinical thresholds.
- Configure cooldown windows and deduplication to prevent alert storms.
- Implement Alert Desk REST endpoints (`/api/v1/alerts`, `/{id}/acknowledge`, `/{id}/resolve`).
- Build notification service abstraction (in-app events + browser notifications + email placeholder).

### Phase 4: Historical Analytics, Rollup Aggregation & Export Engine
- Implement time-series bucket aggregation endpoints for 24 hours, 7 days, and 30 days.
- Calculate minimum, maximum, and average summaries with missing-data gap detection.
- Implement authenticated CSV export endpoint for patient telemetry history.

### Phase 5: Modern Frontend Redesign (Vite + React + Tailwind + shadcn/ui)
- Overhaul `frontend/` with Tailwind CSS, shadcn/ui component system, Lucide icons, and Recharts.
- Set up TanStack Query for server state caching and optimistic updates.
- Build responsive layout with persistent navigation, sidebar, and breadcrumbs.
- Implement all 17 required pages: Login, Register, Forgot Password, Patient CRUD/Detail, Live Monitor, Historical Analytics, Alert Desk, Device Inventory/Pairing, Settings, and Access-Denied.

### Phase 6: Production Hardening, Docker Compose & Verification
- Build Docker Compose multi-container setup (FastAPI backend, PostgreSQL, React frontend).
- Security hardening (strict CORS, rate limiting, secure HTTP-only cookies, sanitized error responses).
- End-to-end verification running sensor simulation and validating live telemetry pipeline.

---

## 7. Testing Strategy

1. **Unit Tests (`tests/unit/`)**:
   - Password hashing and JWT verification.
   - Pydantic telemetry parsing and clinical range validation (valid, out-of-range, and malformed payloads).
   - Alert threshold evaluation and cooldown timing logic.
2. **Database & Migration Tests (`tests/integration/test_db.py`)**:
   - Alembic upgrade/downgrade verification.
   - Foreign key constraints, cascade behaviors, and indexes.
   - Backward-compatibility verification with legacy `readings`.
3. **API Integration Tests (`tests/integration/test_api.py`)**:
   - Full authentication flows (Register, Login, Invalid credentials, Role restrictions).
   - Patient CRUD and authorization barriers (caregiver cannot access unassigned patient).
   - Device pairing and unpairing workflows.
   - Alert acknowledgement and resolution transitions.
4. **WebSocket & Ingestion Tests (`tests/integration/test_telemetry.py`)**:
   - Simulated MQTT ingestion inserting to database and broadcasting to authenticated WebSocket subscribers.
   - Unauthorized WebSocket rejection.
5. **Frontend Testing**:
   - Typechecking (`tsc --noEmit`), linting (`oxlint`), and component rendering verification.

---
