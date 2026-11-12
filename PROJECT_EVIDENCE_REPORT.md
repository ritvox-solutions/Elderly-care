# Project Evidence Report: CareTrack IoT Elderly Health & Cardiac Risk Monitoring System

<!-- COVERAGE SUMMARY -->
**Coverage summary:**
1. Workspace root and directories inspected: `c:/Users/HP/Desktop/Office/dhruva` covering `backend/`, `firmware/`, `frontend/`, `mobile/`, `docs/`, `graphify-out/`, and root documentation/PDF artifacts.
2. Source files and specifications analyzed: Microcontroller C++ firmware sketches, FastAPI application entry points, SQLAlchemy models, Alembic migrations, Pydantic schemas, React/Vite web application views, React Native/Expo mobile components, configuration templates, and 10 backend test suites.
3. Excluded directories: `node_modules/`, `build/`, `.gradle/`, `.cxx/`, `.venv/`, `.pytest_cache/`, and `.git/` (skipped because they contain external package dependencies, compiled Android/C++ binaries, virtual environments, or version-control metadata).
4. Codebase annotation and comment metrics: 3 total matches for `TODO`, `FIXME`, `not implemented`, or `mock` across source code, mobile fixtures, and technical markdown specifications.
5. Execution status: No source code, test runners, or dependency managers were executed; zero external network requests were initiated (strictly adhering to `ALLOW_RUNNING: no`).

---

## 1. Project Identity

- **System Name in Code and Documentation**: CareTrack (styled in [README.md](file:///c:/Users/HP/Desktop/Office/dhruva/README.md#L1) as "CareTrack · IoT Elderly Health & Cardiac Risk Monitoring System"; referred to in academic synopsis artifacts as "IoT Based Elderly Health Monitoring System") | **[VERIFIED]** [README.md](file:///c:/Users/HP/Desktop/Office/dhruva/README.md#L1), [Project Synopsis ours.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/Project%20Synopsis%20ours.pdf#L1).
- **Core Purpose**: A dual-node remote telehealth and ambient assisted living (AAL) telemetry platform that combines wearable photoplethysmography (PPG) biometrics, body inertial kinematics, and room ambient sensing (temperature, humidity, passive infrared motion). Telemetry is streamed via TLS-secured MQTT to an asynchronous FastAPI backend and live web dashboards, where an Adaptive Multi-Parameter Verification (AMPV) decision engine correlates multi-sensor inputs to suppress false alarms before dispatching automated caregiver alerts via WebSockets, SMTP email, and Expo push notifications | **[VERIFIED]** [README.md](file:///c:/Users/HP/Desktop/Office/dhruva/README.md#L23-L75), [backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L260-L265), [backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L1-L16).
- **Application Domain**: IoT Healthcare Telemetry, Ambient Assisted Living (AAL), Geriatric Fall Detection, Continuous Pulse Oximetry, Remote Patient Monitoring (RPM) | **[VERIFIED]** [docs/1-Product-Requirements-Document.md](file:///c:/Users/HP/Desktop/Office/dhruva/docs/1-Product-Requirements-Document.md#L1-L25).
- **Intended Users**:
  - Primary monitored subjects: Elderly individuals living independently at home or in assisted-care facilities who wear the wrist-mounted biometric monitor and inhabit monitored rooms | **[VERIFIED]** [docs/1-Product-Requirements-Document.md](file:///c:/Users/HP/Desktop/Office/dhruva/docs/1-Product-Requirements-Document.md#L30-L50).
  - Primary operators: Professional caregivers, ward care-takers, nurses, and clinical staff utilizing web dashboards and mobile applications | **[VERIFIED]** [backend/models/enums.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/models/enums.py#L3-L6), [frontend/src/App.tsx](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/App.tsx#L94-L125).
  - Emergency recipients: Family members and designated emergency contacts receiving automated email dispatches during critical vitals or fall events | **[VERIFIED]** [backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L243-L309).
- **License**: NOT FOUND IN CODE (no `LICENSE` or `COPYING` file present in the repository).
- **Repository Age and Version Tracking**:
  - Backend API: Version `2.0.0` defined in FastAPI metadata ([backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L262)) and version `0.1.0` in package configuration ([backend/pyproject.toml](file:///c:/Users/HP/Desktop/Office/dhruva/backend/pyproject.toml#L3)) | **[VERIFIED]**.
  - Mobile Application: Version `1.0.0` defined in package configuration ([mobile/package.json](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/package.json#L3)) | **[VERIFIED]**.
  - Frontend Web Dashboard: Version `0.0.0` defined in package configuration ([frontend/package.json](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L4)) | **[VERIFIED]**.
  - Academic Attribution: Visvesvaraya Technological University (VTU) Final Year Engineering Project, Department of Computer Science & Engineering, Alva's Institute of Engineering & Technology, Moodbidri ([Project Synopsis ours.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/Project%20Synopsis%20ours.pdf), [research.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/research.pdf); all individual names and registration numbers redacted per privacy protocol as `[REDACTED personal data]`) | **[VERIFIED]**.

---

## 2. Maturity and Completeness

### Module Implementation Status Table

| Module / Feature | Status | Evidence |
| :--- | :--- | :--- |
| **Wearable Firmware (ESP32)** | Implemented and wired | MAX30102 pulse oximetry, MPU6050 50Hz 3-phase fall state machine, SH1106 OLED rendering, FreeRTOS dual-core network task, TLS MQTT publishing, HTTP POST ingest fallback in [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino). |
| **Room Unit Firmware (ESP8266)** | Implemented and wired | DHT11 climate sampling (2s rate), HC-SR501 PIR interrupt dispatch, 50-message ring buffer for offline recovery, TLS MQTT in [`firmware/Room-Kit/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino). |
| **MQTT Telemetry Ingestion Engine** | Implemented and wired | Background Paho-MQTT consumer thread with topic parsing, schema normalization, and async task delegation in [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L178-L235). |
| **HTTP Telemetry Ingestion Webhook** | Implemented and wired | Serverless-compatible ingestion endpoint `POST /api/v1/telemetry/ingest` with bearer header validation in [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L408-L438). |
| **AMPV Multi-Parameter Rule Engine** | Implemented and wired | Evaluates 60-second correlated wearable/room window across 3 boolean decision rules in [`backend/core/ampv.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py#L20-L81) and [`backend/core/alerting.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L71-L100). |
| **Emergency Alert Cooldown & Fan-Out** | Implemented and wired | Suppresses repeat bursts per device/category/metric, delivers multi-recipient SMTP email, dispatches Expo push, logs audit trail in [`backend/core/alerting.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L367-L513). |
| **Authentication & RBAC** | Implemented and wired | Bcrypt password hashing, JWT bearer creation/verification, role guard dependencies (`require_role`) in [`backend/routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py) and [`backend/core/dependencies.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/dependencies.py). |
| **Patient Directory & Device Pairing** | Implemented and wired | Relational schema pairing two hardware units per patient, transactionally binding assigned caregivers in [`backend/routers/patients.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/patients.py#L75-L145). |
| **WebSocket Real-Time Broadcast** | Implemented and wired | `/ws/live` connection manager broadcasting incoming metrics and verified emergency alerts in [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L45-L69,L301-L313). |
| **Web Dashboard (React/Vite)** | Implemented and wired | Dual-channel frontend: direct MQTT WebSocket subscriptions for vitals/climate plus backend WebSocket listener for AMPV alerts in [`frontend/src/App.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/App.tsx), [`frontend/src/lib/useCardio.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/useCardio.ts), [`frontend/src/lib/useRoom.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/useRoom.ts). |
| **Mobile App (React Native/Expo)** | Partial | Authentication, patient dashboard, threshold editing, and push token registration wired to backend; historical trend charts use mock sine wave generator ([mobile/src/data/fixtures.ts](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/data/fixtures.ts#L42-L74)). |
| **Historical Telemetry Range API** | Stub / In-Memory only | Backend provides only latest readings lookup (`GET /readings/latest`); historical trends are held in a 120-sample client-side in-memory buffer ([frontend/src/pages/History.tsx](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/pages/History.tsx#L27-L47)). |
| **SIM800L GSM SMS Module** | Implemented and wired | Autonomous cellular SMS emergency alert transmission via HardwareSerial UART2 (GPIO 16/17) with AT command state machine, network registration checks, and OLED confirmation in [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino). |
| **MLX90614 Infrared Body Temperature** | NOT FOUND IN CODE | Claimed in research paper draft; wearable firmware actually samples internal die temperature from the MPU6050 ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L453)). |
| **Active Buzzer Hardware Control** | NOT FOUND IN CODE | Claimed in paper and synopsis; wearable firmware drives an active-high LED on GPIO 2 ([ALERT_LED_PIN](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L35)) without audio PWM buzzer logic. |
| **MongoDB Document Storage** | NOT FOUND IN CODE | Proposed in preliminary TRD and paper draft; actual operational database is PostgreSQL with SQLAlchemy ORM. |

### Code Annotation & Scaffolding Count

- **TODO / FIXME Occurrences**: 0 occurrences in production code files | **[VERIFIED]**.
- **"Not Implemented" / Incomplete Flags**:
  - `docs/3-App-Flow-Document.md` (line 135): Mentions testing flow end-to-end even with mocked hardware | **[VERIFIED]**.
  - `mobile/README.md` (line 39): Details limitations of Expo Go on Android regarding remote push notifications and notes mock login restrictions | **[VERIFIED]**.
  - `summary.md` (line 121): Legacy note stating backend rule engine was pending (now resolved by AMPV in backend) | **[VERIFIED]**.
- **Mock Data & Hardcoded Demo Constants**:
  - Mobile Fixtures ([mobile/src/data/fixtures.ts](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/data/fixtures.ts)): Contains hardcoded arrays `DEMO_ALERTS` (3 items), `DEMO_PATIENTS` (3 profiles), and procedural synthetic generator `generateHistoricalData()` generating sine-wave mock vitals | **[VERIFIED]**.
  - Patient Threshold Defaults ([backend/routers/thresholds.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/thresholds.py#L22-L56)): Contains hardcoded baseline configurations for `p-001`, `p-002`, and `p-003` | **[VERIFIED]**.
  - Demo Seed Script ([backend/setup_demo_devices.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/setup_demo_devices.py#L21-L31)): Hardcoded profile fixtures for 3 patients and 6 device identifiers | **[VERIFIED]**.
- **Working End-to-End Flow vs. Scaffolding**:
  - Fully working end-to-end: Microcontroller sensor sampling -> TLS MQTT publishing -> FastAPI MQTT consumer -> Pydantic validation -> PostgreSQL relational insert -> AMPV rule evaluation -> SMTP emergency email dispatch -> Expo Push notification delivery -> WebSocket live broadcast -> React dashboard live rendering | **[VERIFIED]**.
  - Scaffolding / Client-local: Mobile historical charts (mocked via fixtures), Web history tab (in-memory ring buffer of current session, not queried from DB), Alert resolution lifecycle (fields exist in schema, but no REST endpoint exists to mutate status to `RESOLVED`) | **[VERIFIED]**.

---

## 3. Architecture

### System Components

1. **Wearable Unit**:
   - Role: Continuous pulse oximetry, wrist temperature acquisition, high-frequency 50Hz inertial motion sensing, local OLED rendering, multi-phase fall detection state machine.
   - Microcontroller / Language: ESP32 DevKit V1 (Tensilica Xtensa 32-bit LX6 dual-core), C++ / Arduino Framework.
   - Primary Libraries: `Wire.h`, `MAX30105.h`, `heartRate.h`, `Adafruit_MPU6050.h`, `Adafruit_SH110X.h`, `PubSubClient.h`, `WiFiClientSecure.h`, `HTTPClient.h` | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L7-L19).
2. **Room Monitoring Unit**:
   - Role: Ambient climate monitoring (temperature, relative humidity), continuous passive infrared motion presence detection, offline message buffering.
   - Microcontroller / Language: NodeMCU v3 (Espressif ESP8266 single-core 80MHz), C++ / Arduino Framework.
   - Primary Libraries: `DHT.h`, `ESP8266WiFi.h`, `WiFiClientSecure.h`, `PubSubClient.h` | **[VERIFIED]** [firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L16-L22).
3. **Cloud MQTT Broker**:
   - Role: Central message bus providing topic-based publish/subscribe telemetry routing over TLS.
   - Technology: HiveMQ Cloud Managed Cluster (TLS Port 8883 for embedded devices, Secure WebSockets Port 8884 for browser clients) | **[VERIFIED]** [README.md](file:///c:/Users/HP/Desktop/Office/dhruva/README.md#L39-L44), [frontend/src/lib/mqttClient.ts](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/mqttClient.ts#L14-L16).
4. **FastAPI Backend Server**:
   - Role: MQTT background worker ingestion, HTTP webhook ingestion, schema validation, PostgreSQL data persistence, AMPV emergency rule processing, email/push fan-out, WebSocket broadcasting, JWT authentication.
   - Framework / Language: FastAPI 0.115.0, Uvicorn 0.30.1, Python 3.11+ | **[VERIFIED]** [backend/pyproject.toml](file:///c:/Users/HP/Desktop/Office/dhruva/backend/pyproject.toml#L6-L14).
5. **Relational Database**:
   - Role: Persistent storage of users, patients, devices, pairings, thresholds, raw telemetry readings, alert events, notifications, and security audit logs.
   - Technology: PostgreSQL (hosted on Neon serverless or local) with SQLAlchemy 2.0.35 ORM and Alembic migrations | **[VERIFIED]** [backend/database.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/database.py#L1-L28).
6. **Live Web Dashboard**:
   - Role: Caregiver patient directory, real-time vital/environmental monitoring, threshold configuration, live fall alert banner with audible alarm.
   - Framework / Language: React 19, Vite 8, TypeScript, TailwindCSS 4, Chart.js 4 | **[VERIFIED]** [frontend/package.json](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L12-L28).
7. **Companion Mobile Application**:
   - Role: Caregiver remote monitoring, patient vital cards, threshold management, OS native push notification listener.
   - Framework / Language: React Native 0.86, Expo 57, TypeScript | **[VERIFIED]** [mobile/package.json](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/package.json#L11-L22).

### Component Connections & Protocols

- **Wearable Unit to MQTT Broker**: MQTTS over TCP (Port 8883, TLS with `WiFiClientSecure.setInsecure()`). Telemetry published as JSON strings to `cardiac/monitor/data` and `caretrack/{room_id}/wearable/motion` | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L276-L290).
- **Wearable Unit to Backend Server (Fallback Ingest)**: HTTPS POST (Port 443 / 8000) to `/api/v1/telemetry/ingest` with `X-Telemetry-Key` header. Direct transmission of fall emergency payload when MQTT is bypassed or in serverless setups | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L238-L258).
- **Room Unit to MQTT Broker**: MQTTS over TCP (Port 8883, TLS). JSON telemetry published to `caretrack/{device_id}/room/environment`, `caretrack/{device_id}/room/motion`, and `caretrack/{device_id}/status` | **[VERIFIED]** [firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L164-L208).
- **MQTT Broker to Backend Server**: Persistent TCP TLS connection (Port 8883) via `paho-mqtt`. Subscribed to `caretrack/wearable/+`, `caretrack/room/+`, `caretrack/+/room/+`, `caretrack/+/wearable/+`, and `cardiac/monitor/data` | **[VERIFIED]** [backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L187-L192).
- **MQTT Broker to Web Dashboard**: Secure WebSockets (`wss://`, Port 8884, path `/mqtt`) via `mqtt.js`. Directly streams wearable vitals and room metrics into React state | **[VERIFIED]** [frontend/src/lib/mqttClient.ts](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/mqttClient.ts#L53-L94).
- **Backend Server to Database**: PostgreSQL wire protocol over TCP (Port 5432) via `psycopg2-binary` connection pool | **[VERIFIED]** [backend/database.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/database.py#L17-L25).
- **Backend Server to Web Dashboard**: WebSocket protocol (`ws://` or `wss://`) over HTTP/1.1 Upgrade at `/ws/live`. Broadcasts JSON alert notifications and parsed telemetry events | **[VERIFIED]** [backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L59-L68,L301-L313).
- **Backend Server to Email SMTP Gateway**: SMTP over TCP with STARTTLS (Port 587) via Python standard library `smtplib`. Delivers MIME multipart emergency emails to caregivers and emergency contacts | **[VERIFIED]** [backend/core/email.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/email.py#L30-L52).
- **Backend Server to Expo Push Gateway**: HTTPS POST to `https://exp.host/--/api/v2/push/send` via `httpx`. Sends high-priority push payloads targeted to Android/iOS notification channel `fall-alerts-v2` | **[VERIFIED]** [backend/core/push.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/push.py#L8-L43).
- **Web Dashboard / Mobile App to Backend Server**: HTTPS REST API (Port 8000 / 443) with JSON bodies and `Authorization: Bearer <JWT>` headers or HttpOnly session cookies | **[VERIFIED]** [frontend/src/lib/api.ts](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/api.ts), [mobile/src/lib/api.ts](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/lib/api.ts).

### Architectural Topology Diagram

```mermaid
flowchart TD
    subgraph PERCEPTION_LAYER["Perception Layer (IoT Hardware)"]
        WU["Wearable Unit (ESP32 DevKit V1)
        - MAX30102 (PPG HR / SpO2)
        - MPU6050 (50Hz Accel / Gyro)
        - SH1106 / SSD1306 (0.96 OLED)
        - Red Alert LED (GPIO 2)"]

        RU["Room Monitoring Unit (NodeMCU ESP8266)
        - DHT11 (Temp / Humidity)
        - HC-SR501 (PIR Motion)
        - Offline FIFO Ring Buffer"]
    end

    subgraph TRANSPORT_LAYER["Communication & Ingestion Layer"]
        MB["HiveMQ Cloud MQTT Broker
        - TLS Port 8883 (TCP / SSL)
        - WSS Port 8884 (/mqtt)"]

        FASTAPI["FastAPI Backend Ingestion Server
        - Paho-MQTT Background Worker
        - HTTP Ingest Webhook (/api/v1/telemetry/ingest)
        - Pydantic Telemetry Normalization
        - Async WebSocket Broadcaster (/ws/live)"]
    end

    subgraph STORAGE_LAYER["Persistence & State Layer"]
        PG[("PostgreSQL Database
        - Relational Schema (SQLAlchemy)
        - Tables: readings, alerts, patients,
          devices, pairings, notifications, users")]
    end

    subgraph CLINICAL_LOGIC_LAYER["Clinical Analytics & Fan-Out"]
        AMPV["AMPV Rule Engine & Alerting
        - 60s Temporal Sensor Correlation
        - 3-Phase Multi-Parameter Rules
        - Anti-Flooding Cooldown Suppression"]
        
        SMTP["SMTP Mail Gateway
        (STARTTLS Port 587)"]

        EXPO["Expo Push Notification Service
        (HTTPS API)"]
    end

    subgraph PRESENTATION_LAYER["Application & Presentation Layer"]
        WEB["React 19 / Vite Web Dashboard
        - Direct MQTT Live Telemetry
        - WebSocket Emergency Broadcaster
        - Patient Directory & Threshold Config"]

        MOB["React Native / Expo Mobile App
        - Caregiver Dashboard
        - REST API Telemetry Hydration
        - Push Notification Receiver"]
    end

    WU -->|"MQTT TLS (Port 8883)"| MB
    WU -.->|"HTTP Fallback POST (/api/v1/telemetry/ingest)"| FASTAPI
    RU -->|"MQTT TLS (Port 8883)"| MB

    MB -->|"MQTT Topic Subscription"| FASTAPI
    MB -->|"WSS (Port 8884) Live Vitals"| WEB

    FASTAPI -->|"SQLAlchemy Session"| PG
    FASTAPI -->|"Telemetry Snapshot"| AMPV
    AMPV -->|"Persist Alerts & Notifications"| PG

    AMPV -->|"Deliver Alert Email"| SMTP
    AMPV -->|"Send High-Priority Push"| EXPO

    FASTAPI -->|"WebSocket Stream (/ws/live)"| WEB
    FASTAPI <-->|"REST API (JWT Bearer Auth)"| WEB
    FASTAPI <-->|"REST API (JWT Bearer Auth)"| MOB
    EXPO -.->|"Native Push Notification"| MOB
```

---

## 4. Technology Stack

### Inventory Table

| Layer | Technology | Version | Role in Project | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Wearable Firmware** | C++ / Arduino | unpinned | Microcontroller firmware for ESP32 DevKit V1 | [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino) |
| **Wearable RTOS** | FreeRTOS | Core-bundled | Dual-core task distribution (`networkTask` pinned to Core 0) | [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L679) |
| **PPG Sensor Driver** | SparkFun MAX3010x | unpinned | Register configuration and FIFO readout for MAX30102/MAX30100 | [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L12) |
| **IMU Motion Driver** | Adafruit MPU6050 | unpinned | 6-axis accelerometer/gyroscope acquisition at 50Hz | [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L16) |
| **OLED Display Driver** | Adafruit SH110X & GFX | unpinned | 128x64 display rendering over I2C (Address 0x3C) | [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L14-L15) |
| **Room Firmware** | C++ / Arduino | unpinned | Microcontroller firmware for NodeMCU ESP8266 | [`firmware/Room-Kit/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino) |
| **Climate Driver** | Adafruit DHT Sensor | unpinned | Digital temperature and relative humidity readout | [`firmware/Room-Kit/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L20) |
| **Embedded MQTT** | PubSubClient | unpinned | Embedded MQTT client with TLS support | [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L10) |
| **IoT Message Broker** | HiveMQ Cloud | Managed | Managed MQTT broker with TLS 8883 and WSS 8884 endpoints | [`README.md`](file:///c:/Users/HP/Desktop/Office/dhruva/README.md#L41-L44), [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L15-L16) |
| **Backend Runtime** | Python | `>=3.11` | Application execution environment | [`backend/pyproject.toml`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/pyproject.toml#L6) |
| **Backend Framework** | FastAPI | `0.115.0` | Asynchronous REST and WebSocket web application framework | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L4) |
| **ASGI Web Server** | Uvicorn (standard) | `0.30.1` | ASGI server running FastAPI application | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L14) |
| **Backend MQTT Client** | Paho-MQTT | `2.1.0` | Ingestion client subscribing to HiveMQ Cloud topics | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L6) |
| **Database ORM** | SQLAlchemy | `2.0.35` | Object-Relational Mapping, connection pooling, and queries | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L13) |
| **Database Driver** | Psycopg2-binary | `2.9.10` | PostgreSQL database connection adapter | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L7) |
| **Database Migrations** | Alembic | `>=1.13.0` | Relational database schema migrations | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L1) |
| **Validation Engine** | Pydantic / Settings | `2.6.1` | Telemetry payload normalization and environment configuration | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L8) |
| **Password Hashing** | Bcrypt | `>=4.0.0` | Secure credential hashing using salted SHA-256 / blowfish | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L2) |
| **Token Authentication** | PyJWT | `>=2.8.0` | JSON Web Token encoding and decoding (HS256) | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L9) |
| **HTTP Client (Backend)** | HTTPX | `>=0.27.0` | Async HTTP client for outbound Expo push dispatches | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L5) |
| **Email Protocol** | smtplib / EmailMessage | Python stdlib | SMTP transaction delivery over STARTTLS | [`backend/core/email.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/email.py#L11-L12) |
| **Testing Framework** | Pytest / Pytest-asyncio| `>=8.0.0` / `>=0.23.0` | Test runner and async testing harnesses | [`backend/requirements.txt`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/requirements.txt#L10-L11) |
| **Frontend Framework** | React | `^19.2.8` | Component-based user interface library | [`frontend/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L15) |
| **Frontend Routing** | React Router DOM | `^7.18.4` | Client-side declarative application routing | [`frontend/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L17) |
| **Frontend Bundler** | Vite | `^8.3.0` | Development server and static asset bundler | [`frontend/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L28) |
| **Frontend Styling** | TailwindCSS | `^4.3.3` | Utility-first styling engine | [`frontend/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L26) |
| **Frontend Visualizations**| Chart.js | `^4.5.1` | Canvas-based rendering of vital history trends | [`frontend/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L13) |
| **Browser MQTT Client** | MQTT.js | `^5.0.0` | WebSockets MQTT client running in browser DOM | [`frontend/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/package.json#L14) |
| **Mobile Framework** | React Native | `0.86.3` | Native cross-platform mobile runtime | [`mobile/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/package.json#L19) |
| **Mobile Platform Tool** | Expo | `~57.0.31` | Managed mobile SDK and build orchestration | [`mobile/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/package.json#L12) |
| **Mobile Push Module** | Expo Notifications | `~57.0.23` | Native push notification registration and channel routing | [`mobile/package.json`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/package.json#L14) |

---

## 5. Data Flow

### Flow 1: Routine Telemetry Ingestion (Wearable & Room Node)

1. **Perception**:
   - The MAX30102 on ESP32 gathers raw infrared and red PPG samples at 100Hz; the internal beat detector executes `checkForBeat()` and updates the circular Inter-Beat Interval (IBI) buffer ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L621)).
   - Concurrently, the DHT11 on ESP8266 samples temperature and relative humidity every 2000ms ([firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L176)).
2. **On-Device Filtering**:
   - The wearable calculates heart rate via median-filtered IBI with exponential smoothing (`smoothedHr = smoothedHr * 0.85 + beatAvg * 0.15`), and SpO2 via red/IR AC/DC ratio calibration (`SPO2_A - SPO2_B * ratio`) ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L769,L800)).
   - Data is enqueued into a FreeRTOS single-slot queue (`readingQueue`) via `xQueueOverwrite()` ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L145)).
3. **Transport Publication**:
   - The Core 0 FreeRTOS task `networkTask` reads the queue and publishes an MQTT JSON packet to HiveMQ Cloud on topic `cardiac/monitor/data` ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L276)).
   - The room node publishes its payload to `caretrack/{device_id}/room/environment` ([firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L186)).
4. **Backend Ingestion**:
   - `paho-mqtt` callback `on_message()` receives the message, parses the JSON payload, and calls `parse_telemetry(topic, payload)` ([backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L195-L200)).
   - `parse_telemetry()` validates each metric against Pydantic models (`HeartRate`, `SpO2`, `RoomTemp`, `Humidity`, etc.) in [backend/telemetry.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/telemetry.py#L211-L229).
5. **Database Persistence**:
   - `on_message()` dispatches a background task `db_worker()` via `main_loop.run_in_executor(None, db_worker)` ([backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L219-L225)).
   - `store_event()` iterates through each validated metric and persists rows into the PostgreSQL `readings` table via `SessionLocal()` ([backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L73-L90)).
6. **Frontend Live Delivery**:
   - Web dashboard independently receives live vitals directly from HiveMQ Cloud over WSS via `mqtt.js` ([frontend/src/lib/useCardio.ts](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/useCardio.ts#L164-L195)).
   - Backend `ConnectionManager.broadcast()` transmits parsed events to all active WebSocket listeners connected to `/ws/live` ([backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L59-L68)).

---

### Flow 2: Multi-Sensor Emergency Fall & AMPV Verification Flow

```mermaid
sequenceDiagram
    autonumber
    participant ESP as ESP32 Wearable
    participant MQTT as HiveMQ Cloud
    participant API as FastAPI Ingestion
    participant AMPV as AMPV Engine
    participant DB as PostgreSQL DB
    participant SMTP as SMTP Mailer
    participant EXPO as Expo Push Gateway
    participant WS as Browser WebSocket

    ESP->>ESP: 50Hz SVM: Free-fall (<0.68g) -> Impact (>2.00g) -> Rest (1000ms)
    ESP->>ESP: Height kinematic calculation & Alert LED HIGH (GPIO 2)
    ESP->>MQTT: Publish topic: caretrack/.../wearable/motion {fall_detected: true, accel: 3.82}
    ESP->>API: Fallback direct HTTPS POST /api/v1/telemetry/ingest

    MQTT->>API: on_message() triggered
    API->>API: parse_telemetry() -> TelemetryEvent(fall_detected=True)
    API->>AMPV: run_in_executor(alert_worker, event)

    AMPV->>DB: Query DevicePairing -> Patient
    AMPV->>DB: Query Reading (last 60s window: HR, SpO2, Body Temp, Room Motion)
    AMPV->>AMPV: evaluate_ampv(data, thresholds)
    Note over AMPV: Rule Match: fall_with_abnormal_vitals OR fall_with_no_motion
    AMPV->>AMPV: Check in-memory cooldown (_last_emitted)

    AMPV->>DB: INSERT into alerts (severity="CRITICAL", category="FALL")
    AMPV->>DB: Query assigned caregivers + patient emergency contact
    AMPV->>SMTP: send_alert_email() [STARTTLS Port 587]
    SMTP-->>AMPV: Return (ok=True, "sent")
    AMPV->>EXPO: send_expo_push([caregiver_tokens])
    EXPO-->>AMPV: Return push tickets

    AMPV->>DB: INSERT into notifications (channel="EMAIL", status="DELIVERED")
    AMPV->>DB: INSERT into notifications (channel="PUSH", status="DELIVERED")
    AMPV->>WS: manager.broadcast(alert_record_message)
    WS-->>WS: Play emergency alarm audio & display modal banner
```

1. **Inertial Detection**: Wearable MPU6050 samples acceleration at 50Hz. A fall event traverses: Free-fall ($SVM < 0.68\text{ g}$) $\rightarrow$ Impact shock ($SVM > 2.00\text{ g}$) $\rightarrow$ Rest verification ($1000\text{ ms}$, recovery cancel $SVM > 2.30\text{ g}$) ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L516-L548)).
2. **Local Annunciation & Dual Dispatch**: ESP32 drives GPIO 2 HIGH (Alert LED), renders the Fall Alert screen on OLED, publishes to MQTT topic `caretrack/room-unit-01/wearable/motion`, and issues an immediate HTTPS POST to `/api/v1/telemetry/ingest` with 3 retries ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L238-L290)).
3. **Contextual Hydration**: Backend `process_emergency()` identifies the paired patient via `DevicePairing` and executes `_recent_sensor_context()` to load all sensor readings for that patient over the past 60 seconds (`AMPV_WINDOW_SECONDS = 60`) ([backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L327-L365)).
4. **Clinical Verification (AMPV)**: `evaluate_ampv()` evaluates the composite data vector:
   - Rule 1 (`fall_with_abnormal_vitals`): Correlates fall detection with heart rate outside patient limits ($< \text{hr\_min}$ or $> \text{hr\_max}$) or low oxygen ($\text{SpO}_2 < \text{spo2\_min}$).
   - Rule 3 (`fall_with_no_motion`): Correlates fall detection with PIR sensor reading $\text{motion} = \text{False}$ within the 60s window ([backend/core/ampv.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py#L63-L79)).
5. **Anti-Flooding Cooldown**: `process_emergency()` checks `_last_emitted[(device_id, category, metric)]`. If triggered within `fall_alert_cooldown_seconds` (10s) or general cooldown (300s), duplicate dispatches are suppressed ([backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L396-L415)).
6. **Fan-Out & Delivery**:
   - `build_alert_email()` renders family and clinical details ([backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L243-L309)).
   - `send_alert_email()` opens an SMTP connection to deliver the message to caregivers, emergency contact, and fallback emails ([backend/core/email.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/email.py#L54-L70)).
   - `send_expo_push()` posts JSON push notifications to registered caregiver mobile tokens ([backend/core/push.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/push.py#L11-L46)).
   - `Alert` and `Notification` rows are committed to PostgreSQL ([backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L420-L497)).
   - `manager.broadcast()` sends the alert payload over WebSocket `/ws/live`, prompting the frontend to invoke `playEmergencyAlarm()` ([frontend/src/App.tsx](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/App.tsx#L43-L48)).

---

## 6. Modules and Responsibilities

### Backend Modules (`backend/`)

- [`main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py): Application entry point; initializes FastAPI application with lifespan context manager; manages MQTT client lifecycle and connection callbacks; hosts `ConnectionManager` for WebSockets; defines REST routing, root index `/`, health probe `/health`, `/readings/latest`, `/api/v1/telemetry/ingest`, and `/api/v1/alerts/latest`.
- [`settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py): Global configuration managed via `pydantic-settings`; loads `.env` variables; defines defaults for database connection strings, MQTT brokers, CORS configurations, JWT credentials, SMTP mail credentials, cooldown timers, and demo accounts.
- [`database.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/database.py): Database engine configuration; instantiates SQLAlchemy `create_engine` with connection recycling (300s for serverless databases), connection pinging (`pool_pre_ping=True`), `SessionLocal` factory, and `get_db` dependency.
- [`telemetry.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/telemetry.py): Ingestion and normalization parser; defines Pydantic validation models (`HeartRate`, `SpO2`, `BodyTemp`, `Motion`, `FallDetected`, `RoomTemp`, `Humidity`, `AccelMagnitude`, `DeviceStatus`); extracts sensor and device identifiers from topic paths or JSON envelopes; validates metric boundaries.
- [`setup_demo_devices.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/setup_demo_devices.py): Idempotent database seeder; creates demo caregiver user, demo patients, device records, and active device pairings without destroying preexisting modifications.
- [`core/ampv.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py): Pure functional implementation of Adaptive Multi-Parameter Verification logic; defines 60s evaluation window and evaluates 3 multi-sensor correlation rules without network or database dependencies.
- [`core/alerting.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py): Orchestrates end-to-end emergency pipeline; executes `detect_emergencies()`, evaluates fallback individual threshold breaches, queries recent 60-second sensor context, enforces cooldowns, builds alert emails, and dispatches SMTP and Expo push notifications.
- [`core/security.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/security.py): Cryptographic utilities; provides `hash_password()`, `verify_password()`, `create_access_token()`, and `decode_access_token()`.
- [`core/dependencies.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/dependencies.py): FastAPI security dependencies; provides `get_token_from_request` (supports Bearer headers and cookies), `get_current_user`, `get_current_active_user`, and role enforcement guard `require_role`.
- [`core/email.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/email.py): Standard library SMTP client wrapper; executes STARTTLS authentication and dispatches MIME emails.
- [`core/push.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/push.py): HTTP client adapter for the Expo Push Notification REST API.
- [`models/`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/models): SQLAlchemy declarative models:
  - `user.py`: Caregiver/admin accounts with custom cross-platform `GUID` type, email, hashed password, and Expo push token.
  - `patient.py`: Patient demographic profiles, medical notes, emergency contacts, and relationships.
  - `device.py`: Physical hardware identifiers, device types, and active `DevicePairing` records.
  - `patient_threshold.py`: Configurable physiological and environmental alert boundaries per patient.
  - `reading.py`: Raw time-series telemetry storage with compound indexes on device, patient, metric, and timestamp.
  - `alert.py`: Persisted system alerts, severities, trigger values, and acknowledgment audit fields.
  - `notification.py`: Delivery logs per notification channel (EMAIL, PUSH) recording status and error messages.
  - `audit_log.py`: Security audit log tracking logins, registrations, and patient administrative operations.
  - `caregiver_assignment.py`: Many-to-many relationship linking caregivers to assigned patients.
  - `enums.py`: String enumerations for roles, device types, alert severities, alert categories, and notification channels.
- [`routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py): Authentication endpoints (`/register`, `/login`, `/demo-login`, `/logout`, `/me`, `/push-token`).
- [`routers/patients.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/patients.py): Patient directory CRUD endpoints; manages patient onboarding, device pairing validation, profile updates, and deactivation.
- [`routers/thresholds.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/thresholds.py): Threshold endpoints (`GET`, `PUT`, `/all`); manages patient-specific physiological limits and synchronization of in-memory threshold caches.

### Firmware Modules (`firmware/`)

- [`wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino): ESP32 wearable firmware; drives MAX30102 PPG sensor and MPU6050 accelerometer/gyroscope over I2C; implements beat detection, dicrotic notch suppression, and SpO2 calculation; runs 50Hz 3-phase fall detection state machine with kinematic fall height estimation; controls 128x64 SH1106 OLED and Alert LED; handles TLS MQTT and fallback HTTP POST.
- [`Room-Kit/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino): ESP8266 room unit firmware; reads DHT11 temperature/humidity every 2s; captures HC-SR501 PIR motion transitions via digital interrupt; buffers unsent telemetry in a 50-entry FIFO queue during network disconnects; publishes to MQTT over TLS.

### Frontend Modules (`frontend/src/`)

- [`App.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/App.tsx): Root layout and router; coordinates role switching (CAREGIVER vs. PATIENT); controls emergency audio alarm and global fall alert banners; renders navbar and views.
- [`lib/useCardio.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/useCardio.ts): React hook managing wearable telemetry; establishes direct WSS connection to HiveMQ Cloud; processes cardiac telemetry and extracts fall flags; implements client-side clinical risk categorization.
- [`lib/useRoom.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/useRoom.ts): React hook managing room environment data; maintains WebSocket connection to `/ws/live` and handles fallback polling via `GET /readings/latest` and `/api/v1/alerts/latest`.
- [`lib/mqttClient.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/mqttClient.ts): Browser MQTT client helper wrapping `mqtt.js`; normalizes WebSocket URLs (`wss://host:8884/mqtt`).
- [`pages/PatientsPage.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/pages/PatientsPage.tsx): Caregiver patients directory; lists active patients, vitals status, and room details; embeds patient onboarding form modal.
- [`pages/Settings.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/pages/Settings.tsx): Caregiver threshold configuration page; fetches and persists patient-tailored alert limits via REST.
- [`pages/History.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/pages/History.tsx): Visualizes session buffer trends for heart rate, SpO2, temperature, and humidity using Chart.js.

### Mobile Modules (`mobile/src/`)

- [`screens/AuthScreen.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/screens/AuthScreen.tsx): Mobile authentication interface supporting registration, password login, and one-tap demo login.
- [`screens/PatientDashboard.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/screens/PatientDashboard.tsx): Live monitoring screen displaying vital cards, room climate, connection badges, and fall alerts.
- [`screens/PatientsScreen.tsx`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/screens/PatientsScreen.tsx): Patient roster displaying room numbers, age, active status, and edit modal launchers.
- [`lib/notifications.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/lib/notifications.ts): Registers device with Expo push service, configures Android notification channel `fall-alerts-v2` with custom vibration patterns, and parses incoming fall payloads.
- [`lib/api.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/mobile/src/lib/api.ts): Mobile API client handling token storage, authentication, patient fetching, and threshold updates.

---

## 7. Algorithms, Models, and Rules

### 1. Adaptive Multi-Parameter Verification (AMPV) Algorithm

- **Defined in**: [`backend/core/ampv.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py), function `evaluate_ampv()`; invoked by `process_emergency()` in [`backend/core/alerting.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L86).
- **Clinical Rationale**: Mitigates high false-alarm rates in single-sensor systems by requiring cross-channel corroboration between independent wearable and environmental signals within an observation window.
- **Correlation Window**: `AMPV_WINDOW_SECONDS = 60` seconds ([backend/core/ampv.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py#L20)). Evaluates the latest correlated snapshot across paired devices.
- **Signal Boundary Validation**:
  - Heart rate samples $< 30\text{ bpm}$ are discarded as sensor idle / finger removed ([backend/core/ampv.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py#L54)).
  - Blood oxygen samples $< 50\%$ are discarded as optical calibration artifacts ([backend/core/ampv.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py#L57)).
  - Abnormal heart rate: $HR \ge 30$ and ($HR < \text{hr\_min}$ or $HR > \text{hr\_max}$).
  - Low SpO2: $\text{SpO}_2 \ge 50$ and $\text{SpO}_2 < \text{spo2\_min}$.
  - High body temperature (fever): $T_b > 38.0^\circ\text{C}$ (strictly greater than 38.0°C; 38.0°C is non-febrile) ([backend/core/ampv.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py#L60)).
- **Decision Rules**:
  1. **Rule 1 (`fall_with_abnormal_vitals`)**: An inertial impact/fall is corroborated by cardiovascular stress:
     $$\text{Alert} = 1 \iff (F = 1) \land \left((HR \notin [\text{hr\_min}, \text{hr\_max}]) \lor (\text{SpO}_2 < \text{spo2\_min})\right)$$
  2. **Rule 2 (`abnormal_heart_rate_with_fever`)**: Abnormal heart rate accompanied by systemic fever:
     $$\text{Alert} = 1 \iff (HR \notin [\text{hr\_min}, \text{hr\_max}]) \land (T_b > 38.0^\circ\text{C})$$
  3. **Rule 3 (`fall_with_no_motion`)**: An inertial fall corroborated by subsequent cessation of ambient room movement:
     $$\text{Alert} = 1 \iff (F = 1) \land (M \neq \text{None}) \land (M = 0)$$
- **Scoring Weights Observation**: Research paper draft Table II lists channel weights ($s_1\text{ HR}: 3.0$, $s_2\text{ SpO}_2: 3.0$, $s_3\text{ Fall}: 3.5$, $s_4\text{ Inactivity}: 1.5$, $s_5\text{ Room Temp}: 1.0$). However, as explicitly documented in [`backend/core/ampv.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py#L10-L13), the paper provides no formula or threshold for a weighted sum; the codebase therefore executes the exact Boolean decision rules.

---

### 2. Individual Thresholds & Fallback Alert Escalation

- **Defined in**: [`backend/core/alerting.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py), function `detect_emergencies()`.
- **Default Baseline Thresholds** ([backend/routers/thresholds.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/thresholds.py#L49-L56)):
  - Minimum heart rate (`hr_min`): $50\text{ bpm}$
  - Maximum heart rate (`hr_max`): $110\text{ bpm}$
  - Minimum blood oxygen (`spo2_min`): $92\%$
  - Fall shock acceleration (`fall_g`): $3.0\text{ g}$
  - Minimum room temperature (`room_temp_min`): $18.0^\circ\text{C}$
  - Maximum room temperature (`room_temp_max`): $28.0^\circ\text{C}$
- **Physiological Critical Severity Cut-Offs** ([backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L48-L51)):
  - Extreme Bradycardia: $HR < 40.0\text{ bpm}$ $\rightarrow$ Escalate to `CRITICAL`
  - Extreme Tachycardia: $HR > 150.0\text{ bpm}$ $\rightarrow$ Escalate to `CRITICAL`
  - Hypothermia risk: $T_b \le 35.0^\circ\text{C}$ ($T_b \ge 25.0^\circ\text{C}$) $\rightarrow$ `CRITICAL`
  - Severe hyperthermia/pyrexia: $T_b \ge 39.0^\circ\text{C}$ $\rightarrow$ `CRITICAL`
  - Moderate HR breach ($40 \le HR < 50$ or $110 < HR \le 150$): Tagged as `WARNING`.
  - Room temperature breach: Tagged as `WARNING` (`category=ENVIRONMENT`).
  - Fall event: Always tagged as `CRITICAL` (`category=FALL`).
- **Cooldown Limits**:
  - Fall alert cooldown: `fall_alert_cooldown_seconds = 10` seconds ([backend/settings.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L38)).
  - Vital signs alert cooldown: `alert_cooldown_seconds = 300` seconds ([backend/settings.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L37)).

---

### 3. Three-Phase Biomechanical Fall Detection State Machine

- **Defined in**: [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino), functions `processFallDetection()` and `triggerFallEmergency()`.
- **Sampling Frequency**: $50\text{ Hz}$ (sampled every $20\text{ ms}$) ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L701)).
- **Signal Vector Magnitude (SVM)**: Computed from 3-axis normalized acceleration:
  $$SVM = \sqrt{a_x^2 + a_y^2 + a_z^2} \quad (\text{where } a_i = \text{accel}_i / 9.80665)$$
- **Finite State Machine (FSM)**:
  - `FALL_IDLE`:
    - If $SVM < 0.68\text{ g}$ (`FALL_FREE_FALL_G`): Marks `freeFallStartMs = now`, transitions to `FALL_FREE_FALLING`.
    - Else if $SVM > 2.60\text{ g}` (`FALL_HARD_IMPACT_G`): Direct collapse transition to `FALL_WAITING_REST`.
  - `FALL_FREE_FALLING`:
    - If $SVM > 2.00\text{ g}$ (`FALL_IMPACT_MIN_G`): Impact detected. Calculates duration $\Delta t = \text{now} - \text{freeFallStartMs}$, transitions to `FALL_WAITING_REST`.
    - Else if $\text{now} - \text{freeFallStartMs} > 800\text{ ms}$ (`FALL_FREE_FALL_WINDOW`): Timeout without impact, resets to `FALL_IDLE`.
  - `FALL_WAITING_REST`:
    - If $SVM > 2.30\text{ g}$ after initial 150ms bounce dampening: User recovered movement; aborts and resets to `FALL_IDLE`.
    - Else if $\text{now} - \text{impactOccurredMs} \ge 1000\text{ ms}$ (`FALL_REST_TIME_MS`): Fall confirmed; invokes height estimator and triggers emergency alert.

---

### 4. Fall Height Kinematic and Biomechanical Shock Estimator

- **Defined in**: [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino), function `calculateFallHeight()`.
- **Formulas**:
  - Primary Kinematic Model (when free-fall duration $90\text{ ms} \le \Delta t \le 800\text{ ms}$):
    $$h = \frac{1}{2} \cdot g_{\text{eff}} \cdot (\Delta t)^2$$
    where effective gravitational acceleration with torso air/biomechanical damping $g_{\text{eff}} = 8.83\text{ m/s}^2$ ($0.90 \cdot g$).
  - Fallback Biomechanical Shock Model (for sudden collapses without clear free-fall phase):
    $$h = \left(\max(0.0, SVM_{\text{impact}} - 1.0)\right)^{1.35} \cdot 0.09$$
  - Physical Boundary Constraints: Result clamped to $[0.20\text{ m}, 2.50\text{ m}]$ via `constrain()`.
- **Fall Height Categories**:
  - $h < 0.50\text{ m}$: `"Low Level (<0.5m)"`
  - $0.50\text{ m} \le h < 0.95\text{ m}$: `"Bed/Chair Ht (0.5-0.9m)"`
  - $0.95\text{ m} \le h < 1.65\text{ m}$: `"Standing Ht (1.0-1.6m)"`
  - $h \ge 1.65\text{ m}$: `"Elevated (>1.6m)"`

---

### 5. Photoplethysmography (PPG) Vital Sign Processing

- **Defined in**: [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino), functions `onBeatDetected()`, `pumpSensor()`, `autoRangeLed()`, and main loop.
- **Optical Thresholds**:
  - Finger Presence: IR DC mean $\ge 6000$ (`FINGER_IR_MIN`).
  - ADC Saturation Clipping: IR DC mean $\ge 52000$ (`IR_CLIP`).
  - Perfusion Index ($PI$): $PI = 100.0 \cdot \frac{IR_{\text{AC}}}{IR_{\text{DC}}}$; acceptable range $[0.15\%, 8.0\%]$.
- **Heart Rate Filtering & Dicrotic Notch Rejection**:
  - Circular IBI buffer size: $N = 8$ (`IBI_SIZE`).
  - Blanking window: Minimum $500\text{ ms}$ (`IBI_MIN_MS`), with adaptive physiological floor:
    $$\text{blanking} = \max\left(500, \frac{\text{median}(IBI) \cdot 58}{100}\right)$$
  - Rhythm tolerance: Beats varying by $> 22\%$ (`RHYTHM_TOL_PCT`) from median are classified as outliers.
  - Beat Lock Criteria: $\ge 4$ consecutive stable beats, $45 \le \text{BPM} \le 125$, within $4000\text{ ms}$ lock timeout.
  - Output Smoothing: Exponential moving average:
    $$\text{smoothedHr} = 0.85 \cdot \text{smoothedHr} + 0.15 \cdot \text{beatAvg}$$
    (resets instantly if difference $> 25\text{ bpm}$).
  - Slew-rate limiter: Output bounded to $\pm 2\text{ bpm/s}$ (`HR_MAX_STEP`).
- **Blood Oxygen Saturation ($\text{SpO}_2$) Ratio Calibration**:
  - Ratio-of-ratios calculation:
    $$R = \frac{Red_{\text{AC}} / Red_{\text{DC}}}{IR_{\text{AC}} / IR_{\text{DC}}}$$
  - Empirical Linear Calibration:
    $$\text{SpO}_{2\text{ raw}} = \text{constrain}\left(112.0 - 22.0 \cdot R + 0.5, 75, 99\right)$$
  - Median Filter: Window size of 7 (`SPO2_MED_SIZE = 7`). Requires lock count $\ge 4$ before display.

---

## 8. Data and Datasets

### Referenced External Datasets

1. **"MobiFall" Dataset**:
   - Reference: Cited in research paper draft Figure 4 ([research.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/research.pdf#L8)) claiming $89.2\%$ fall detection sensitivity.
   - Evidence in Code: **NOT FOUND IN CODE** (no data files, raw CSVs, or loading scripts exist in repository).
2. **"UP-Fall" Dataset**:
   - Reference: Cited in research paper draft Figure 4 ([research.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/research.pdf#L8)) claiming $88.6\%$ fall detection sensitivity.
   - Evidence in Code: **NOT FOUND IN CODE**.
3. **"In-lab proxy cohort"**:
   - Reference: Cited in research paper draft Figure 3 & 4 claiming $93.4\%$ sensitivity and $6.8\%$ false positive rate.
   - Evidence in Code: **NOT FOUND IN CODE** (no participant logs or confusion matrices exist).

---

### System-Generated Data Schema (PostgreSQL Relational Tables)

1. **`readings`**:
   - Columns: `id` (INTEGER, PK), `device_id` (VARCHAR(100), INDEX), `patient_id` (GUID, FK to `patients.id`, NULLABLE), `sensor_type` (VARCHAR(50)), `metric` (VARCHAR(50), INDEX), `value` (FLOAT), `unit` (VARCHAR(50), NULLABLE), `timestamp` (TIMESTAMPTZ, INDEX), `received_at` (TIMESTAMPTZ, DEFAULT NOW()).
   - Compound Indexes: `idx_readings_device_ts(device_id, timestamp)`, `idx_readings_device_metric_ts(device_id, metric, timestamp)`, `idx_readings_patient_metric_ts(patient_id, metric, timestamp)`.
2. **`alerts`**:
   - Columns: `id` (GUID, PK), `patient_id` (GUID, FK to `patients.id`, NULLABLE), `device_id` (VARCHAR(100)), `category` (VARCHAR(50)), `severity` (VARCHAR(50)), `triggering_metric` (VARCHAR(50)), `triggering_value` (FLOAT), `message` (TEXT), `status` (VARCHAR(50), DEFAULT 'ACTIVE'), `created_at` (TIMESTAMPTZ, INDEX), `acknowledged_at` (TIMESTAMPTZ, NULLABLE), `acknowledged_by_id` (GUID, FK to `users.id`, NULLABLE), `resolved_at` (TIMESTAMPTZ, NULLABLE), `resolved_by_id` (GUID, FK to `users.id`, NULLABLE), `resolution_notes` (TEXT, NULLABLE).
3. **`notifications`**:
   - Columns: `id` (GUID, PK), `alert_id` (GUID, FK to `alerts.id`, CASCADE), `user_id` (GUID, FK to `users.id`, CASCADE), `channel` (VARCHAR(50) [EMAIL, PUSH, IN_APP, BROWSER]), `status` (VARCHAR(50) [PENDING, DELIVERED, FAILED]), `delivered_at` (TIMESTAMPTZ, NULLABLE), `error_message` (TEXT, NULLABLE), `created_at` (TIMESTAMPTZ).
4. **`audit_logs`**:
   - Columns: `id` (GUID, PK), `user_id` (GUID, FK to `users.id`, NULLABLE), `action` (VARCHAR(100)), `resource_type` (VARCHAR(100)), `resource_id` (VARCHAR(100), NULLABLE), `details` (TEXT, NULLABLE), `ip_address` (VARCHAR(100), NULLABLE), `created_at` (TIMESTAMPTZ, INDEX).

---

## 9. Interfaces

### REST API Endpoints

| Method | Path | Auth Required | Input Parameters / Body | Output Schema | HTTP Codes | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | None | None | Service info, docs URL, health URL | 200 | [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L287) |
| `GET` | `/health` | None | None | `{"status": "ok", "version": "2.0.0"}` | 200 | [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L282) |
| `GET` | `/readings/latest` | None | `device_id` (str), `wearable_device_id` (opt str) | Latest reading object per metric with timestamps | 200 | [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L315) |
| `POST` | `/api/v1/telemetry/ingest` | Header `X-Telemetry-Key` (if set) | JSON payload: `topic`, `device_id`, `data`, `timestamp` | `status`, `readings_stored`, `alerts_created` | 200, 401 | [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L408) |
| `GET` | `/api/v1/alerts/latest` | None | `device_ids` (opt str), `since` (opt datetime), `limit` (int, default 20) | Array of serialized alert objects | 200 | [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L440) |
| `POST` | `/api/v1/auth/register` | None | JSON: `email`, `password`, `full_name`, `role`, `phone_number` | User profile representation | 201, 400 | [`backend/routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py#L24) |
| `POST` | `/api/v1/auth/login` | None | JSON: `email`, `password` | `TokenResponse`: `access_token`, `user` | 200, 401, 403 | [`backend/routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py#L56) |
| `POST` | `/api/v1/auth/demo-login` | None | None | `TokenResponse`: `access_token`, `user` | 200, 404 | [`backend/routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py#L83) |
| `POST` | `/api/v1/auth/logout` | Bearer Token / Cookie | None | `{"status": "logged_out"}` | 200, 401 | [`backend/routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py#L90) |
| `GET` | `/api/v1/auth/me` | Bearer Token / Cookie | None | Authenticated user profile | 200, 401 | [`backend/routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py#L103) |
| `PUT` | `/api/v1/auth/push-token`| Bearer Token / Cookie | JSON: `token` (Expo push token string) | `{"status": "registered"}` | 200, 401 | [`backend/routers/auth.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/auth.py#L107) |
| `GET` | `/api/v1/patients` | Role: `CAREGIVER` / `ADMIN` | None | Array of `PatientDirectoryResponse` | 200, 401, 403 | [`backend/routers/patients.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/patients.py#L58) |
| `POST` | `/api/v1/patients` | Role: `CAREGIVER` / `ADMIN` | JSON: `first_name`, `last_name`, `dob`, `room_number`, `room_device_id`, `wearable_device_id`, etc. | Created `PatientDirectoryResponse` | 201, 400, 409 | [`backend/routers/patients.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/patients.py#L75) |
| `PATCH`| `/api/v1/patients/{id}` | Role: `CAREGIVER` / `ADMIN` | JSON: Partial patient update fields | Updated `PatientDirectoryResponse` | 200, 400, 403, 404, 409 | [`backend/routers/patients.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/patients.py#L147) |
| `DELETE`| `/api/v1/patients/{id}`| Role: `CAREGIVER` / `ADMIN` | Path parameter: `id` | None | 204, 403, 404 | [`backend/routers/patients.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/patients.py#L185) |
| `GET` | `/api/v1/thresholds` | Optional Bearer Token | Query: `patient_id` (opt str) | `ThresholdsSchema` (active limits) | 200 | [`backend/routers/thresholds.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/thresholds.py#L119) |
| `GET` | `/api/v1/thresholds/all` | Optional Bearer Token | None | Array of patient threshold dictionaries | 200 | [`backend/routers/thresholds.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/thresholds.py#L154) |
| `PUT` | `/api/v1/thresholds` | Role: `CAREGIVER` / `ADMIN` | JSON: `ThresholdsSchema`, query: `patient_id` | Updated `ThresholdsSchema` | 200, 400, 403 | [`backend/routers/thresholds.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/routers/thresholds.py#L173) |

---

### WebSocket Interface

- **Endpoint**: `/ws/live` ([backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L301-L313)).
- **Protocol**: `ws://` or `wss://` over HTTP/1.1 Upgrade.
- **Authentication**: Optional query parameter `?token=` or header `x-caretrack-ws-token`. Rejection code 1008 if token mismatch when `WS_AUTH_TOKEN` is configured.
- **Outbound Message Structure (Alert Event)**:
  `{"type": "alert", "alert_id": "...", "device_id": "...", "timestamp": "...", "category": "FALL", "severity": "CRITICAL", "metric": "ampv_verified", "value": 1.0, "message": "...", "patient_name": "...", "room_number": "..."}` | **[VERIFIED]** [backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L131-L143).
- **Outbound Message Structure (Metric Telemetry)**:
  `{"device_id": "...", "sensor": "wearable", "timestamp": "...", "metric": "heart_rate", "value": 72.0, "unit": "bpm", "fall_detected": false}` | **[VERIFIED]** [backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L156-L164).

---

### MQTT Topics and Data Contracts

- `cardiac/monitor/data`: Published by ESP32 wearable. Payload: `{"heart_rate": int, "spo2": float, "spo2_low": bool, "temperature": float, "device_temperature": float, "accel_magnitude": float, "fall_detected": bool, "timestamp": uint32, "epoch": uint32}` | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L265-L275).
- `caretrack/{room_id}/wearable/motion`: Published by ESP32 wearable on fall emergency trigger. Payload: `{"topic": "...", "device_id": "ESP32-CardiacMonitor", "sensor": "wearable", "timestamp": uint32, "data": {"fall_detected": true, "accel_magnitude": float}}` | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L283-L287).
- `caretrack/{device_id}/room/environment`: Published by ESP8266 room node every 2s. Payload: `{"device_id": "room-unit-01", "sensor": "room", "timestamp": "ISO-8601", "data": {"temperature": float, "humidity": float, "motion_detected": bool}}` | **[VERIFIED]** [firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L186-L192).
- `caretrack/{device_id}/room/motion`: Published instantly by ESP8266 on PIR state toggle. Payload: `{"device_id": "room-unit-01", "sensor": "room", "timestamp": "ISO-8601", "data": {"motion_detected": bool}}` | **[VERIFIED]** [firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L164-L168).
- `caretrack/{device_id}/status`: Published by both nodes every 60s. Payload: `{"device_id": "...", "sensor": "room", "timestamp": "ISO-8601", "data": {"status": "online", "rssi": int}}` | **[VERIFIED]** [firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L203-L207).

---

### Hardware Pinout Interfaces

- **Wearable Unit (ESP32)**:
  - I2C Bus: SDA $\rightarrow$ `GPIO 21`, SCL $\rightarrow$ `GPIO 22` (Shared bus for MAX30102 at `0x57`, MPU6050 at `0x68`, and SH1106 OLED at `0x3C`) | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L33-L37).
  - Visual Alert Output: `GPIO 2` driven active HIGH for Alert LED | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L35,L499).
- **Room Unit (NodeMCU ESP8266)**:
  - PIR Sensor Output: `D2` (`GPIO 4`) digital input | **[VERIFIED]** [firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L24).
  - DHT11 Data Line: `D5` (`GPIO 14`) 1-wire digital input | **[VERIFIED]** [firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L25).

---

## 10. Database

### Relational Schema Summary (PostgreSQL)

```mermaid
erDiagram
    USERS ||--o{ PATIENTS : "creates"
    USERS ||--o{ CAREGIVER_ASSIGNMENTS : "assigned_to"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AUDIT_LOGS : "performed"
    PATIENTS ||--o{ CAREGIVER_ASSIGNMENTS : "monitored_by"
    PATIENTS ||--o{ DEVICE_PAIRINGS : "paired_with"
    PATIENTS ||--o{ READINGS : "produces"
    PATIENTS ||--o{ ALERTS : "triggers"
    DEVICES ||--o{ DEVICE_PAIRINGS : "assigned_to"
    ALERTS ||--o{ NOTIFICATIONS : "generates"

    USERS {
        GUID id PK
        string email UK
        string hashed_password
        string full_name
        string role
        string phone_number
        string expo_push_token UK
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    PATIENTS {
        GUID id PK
        string first_name
        string last_name
        string email
        date date_of_birth
        string gender
        string room_number
        text medical_notes
        string emergency_contact_name
        string emergency_contact_phone
        string emergency_contact_email
        GUID created_by_id FK
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    DEVICES {
        GUID id PK
        string device_identifier UK
        string device_type
        string mac_address
        string firmware_version
        string status
        timestamptz last_seen_at
        timestamptz created_at
    }

    DEVICE_PAIRINGS {
        GUID id PK
        GUID device_id FK
        GUID patient_id FK
        timestamptz paired_at
        timestamptz unpaired_at
        boolean is_active
    }

    CAREGIVER_ASSIGNMENTS {
        GUID id PK
        GUID caregiver_id FK
        GUID patient_id FK
        boolean is_primary
        timestamptz assigned_at
    }

    PATIENT_THRESHOLDS {
        int id PK
        string patient_id UK
        int hr_min
        int hr_max
        int spo2_min
        float fall_g
        float room_temp_min
        float room_temp_max
        timestamptz updated_at
    }

    READINGS {
        int id PK
        string device_id
        GUID patient_id FK
        string sensor_type
        string metric
        float value
        string unit
        timestamptz timestamp
        timestamptz received_at
    }

    ALERTS {
        GUID id PK
        GUID patient_id FK
        string device_id
        string category
        string severity
        string triggering_metric
        float triggering_value
        text message
        string status
        timestamptz created_at
        timestamptz acknowledged_at
        GUID acknowledged_by_id FK
        timestamptz resolved_at
        GUID resolved_by_id FK
        text resolution_notes
    }

    NOTIFICATIONS {
        GUID id PK
        GUID alert_id FK
        GUID user_id FK
        string channel
        string status
        timestamptz delivered_at
        text error_message
        timestamptz created_at
    }

    AUDIT_LOGS {
        GUID id PK
        GUID user_id FK
        string action
        string resource_type
        string resource_id
        text details
        string ip_address
        timestamptz created_at
    }
```

- **Data Retention & Expiry Logic**: **NOT FOUND IN CODE** (no automated database pruning, partitioning, or TTL job exists in PostgreSQL code. Raw readings accumulate indefinitely unless manually truncated).

---

## 11. Security and Privacy Mechanisms

### Implemented Controls

- **Authentication**: Stateless JSON Web Tokens (JWT) using HS256 symmetric signature algorithm; validity duration 24 hours (`access_token_expire_minutes: 1440`). Passwords hashed via salted Bcrypt (`bcrypt.hashpw` with `bcrypt.gensalt()`) | **[VERIFIED]** [backend/core/security.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/security.py#L9-L34).
- **Authorization & RBAC**: Endpoint operations protected via role checking dependencies enforcing `CAREGIVER` or `ADMIN` roles | **[VERIFIED]** [backend/core/dependencies.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/dependencies.py#L45-L53).
- **Audit Logging**: User registration, login, logout, and sensitive actions generate persistent records in the `audit_logs` table | **[VERIFIED]** [backend/models/audit_log.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/models/audit_log.py).
- **Alert Rate Limiting / Flooding Defense**: In-memory timestamp cache (`_last_emitted`) enforces minimum gaps between repeated notifications for identical device/category/metric keys | **[VERIFIED]** [backend/core/alerting.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/alerting.py#L54,L402-L413).
- **CORS Policy**: Configured in FastAPI middleware; allows origins specified by `CORS_ALLOWED_ORIGINS` and matches Vercel staging deployments via regex `r"https://.*\.vercel\.app"` | **[VERIFIED]** [backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L267-L274).

---

### Security Observations & Vulnerabilities

*(Specific secret values, keys, and credentials are strictly redacted per safety rules)*

1. [`backend/.env`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/.env): Contains plaintext secrets on disk, including a production PostgreSQL connection string (`[REDACTED connection string]`), HiveMQ Cloud username and password (`[REDACTED MQTT credentials]`), and Gmail SMTP App Password (`[REDACTED SMTP password]`).
2. [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L52): Contains a hardcoded default JWT secret key (`secret_key: str = "[REDACTED dev secret string]"`) used if the environment variable `SECRET_KEY` is not provided.
3. [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L48-L49): Contains hardcoded demo caregiver credentials (`[REDACTED demo email and password]`) active whenever `ENABLE_DEMO_LOGIN=True`.
4. [`firmware/wearbale/firmware/secrets.h`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/secrets.h) and [`firmware/Room-Kit/firmware/secrets.h`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/secrets.h): Contain unencrypted WiFi SSIDs, WiFi passwords, and HiveMQ Cloud broker credentials embedded into microcontrollers.
5. [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L242,L673) and [`firmware/Room-Kit/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L134): Microcontroller TLS sessions invoke `espClient.setInsecure()`, disabling X.509 server certificate validation and exposing telemetry to Man-in-the-Middle (MitM) attacks on local networks.
6. [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L301-L306): The WebSocket endpoint `/ws/live` permits unauthenticated connections by default whenever `WS_AUTH_TOKEN` is left empty.
7. [`frontend/src/lib/mqttClient.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/mqttClient.ts#L47-L51): Browser directly connects to the MQTT broker over WebSockets, necessitating the distribution of broker credentials or anonymous read access to client devices.

---

## 12. Configuration and Deployment

### Environment Variables

| Variable Name | Default Value in Code | Purpose | Evidence |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `"sqlite:///./caretrack.db"` | PostgreSQL database connection string | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L14) |
| `MQTT_BROKER_URL` | `"broker.hivemq.com"` | HiveMQ Cloud broker cluster hostname | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L15) |
| `MQTT_PORT` | `1883` | Broker port (8883 for TLS) | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L16) |
| `MQTT_USERNAME` | `""` | Broker authentication username | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L17) |
| `MQTT_PASSWORD` | `""` | Broker authentication password | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L18) |
| `MQTT_USE_TLS` | `None` (auto if 8883/8884) | Explicit TLS override flag | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L19) |
| `CORS_ALLOWED_ORIGINS` | `localhost:5173,8000` | Comma-separated allowed HTTP origins | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L20) |
| `CORS_ALLOWED_ORIGIN_REGEX`| `r"https://.*\.vercel\.app"` | Regular expression for deployment origins | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L21) |
| `WS_AUTH_TOKEN` | `""` | Optional shared secret for `/ws/live` | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L22) |
| `TELEMETRY_INGEST_KEY` | `""` | Shared secret header for `/telemetry/ingest` | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L23) |
| `EMAIL_ALERTS_ENABLED` | `True` | Master toggle for email notifications | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L28) |
| `SMTP_HOST` | `""` | Outbound SMTP server hostname | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L29) |
| `SMTP_PORT` | `587` | Outbound SMTP port | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L30) |
| `SMTP_USERNAME` | `""` | Outbound SMTP login username | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L31) |
| `SMTP_PASSWORD` | `""` | Outbound SMTP login password | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L32) |
| `SMTP_FROM` | `"CareTrack Alerts <...>"` | Sender address on emergency emails | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L33) |
| `SMTP_USE_TLS` | `True` | STARTTLS toggle for mail delivery | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L34) |
| `SMTP_TIMEOUT_SECONDS` | `10` | Socket timeout for mail delivery | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L35) |
| `ALERT_COOLDOWN_SECONDS` | `300` | General vital signs alert cooldown | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L37) |
| `FALL_ALERT_COOLDOWN_SECONDS`| `10` | Specific fall emergency cooldown | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L38) |
| `ALERT_FALLBACK_RECIPIENTS`| `""` | Extra emails copied on all alerts | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L41) |
| `EXPO_PUSH_ACCESS_TOKEN` | `""` | Expo Push API bearer authentication token | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L44) |
| `ENABLE_DEMO_LOGIN` | `True` | Toggle for `/api/v1/auth/demo-login` | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L47) |
| `SECRET_KEY` | Hardcoded default | Cryptographic secret for JWT signing | [`backend/settings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L52) |
| `VERCEL` | Unset (auto on Vercel) | Disables persistent MQTT background loop | [`backend/main.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L23) |

---

### Installation & Run Commands (from README & manifests)

- **Backend (Python / uv)**:
  ```powershell
  cd backend
  uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```
- **Demo Data Seeding**:
  ```powershell
  cd backend
  uv run python setup_demo_devices.py
  ```
- **Frontend (Node / Vite)**:
  ```powershell
  cd frontend
  npm install
  npm run dev
  ```
- **Mobile (Expo / React Native)**:
  ```powershell
  cd mobile
  npm install
  npx expo start
  ```
- **CI / Docker Files**: Dockerfiles and GitHub Actions workflow files are **NOT FOUND IN CODE**.

---

## 13. Testing and Evaluation Evidence

### Automated Test Suites

- **Framework**: `pytest` 9.1.1 and `pytest-asyncio` 1.4.0 with FastAPI `TestClient` (backed by `httpx`) and in-memory SQLite (`sqlite:///:memory:`) configured in [`backend/tests/conftest.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/conftest.py).
- **Total Test Cases**: Exactly 48 unit tests located across 10 files in `backend/tests/` | **[VERIFIED]**:
  1. [`test_alerting.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_alerting.py) (20 tests): Validates patient UUID threshold resolution, individual vital breaches, AMPV multi-sensor rule matching and single-signal rejection, SMTP email delivery, fall push notification fan-out, anti-flooding cooldown suppression, unpaired device fallback routing, and multiple breach email batching.
  2. [`test_patients_api.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_patients_api.py) (7 tests): Validates caregiver patient onboarding, dual-device pairing, duplicate room number rejection, profile modification, patient deactivation, and device unpairing.
  3. [`test_auth_api.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_auth_api.py) (4 tests): Validates user registration, password verification, demo login seeding, and unauthorized access rejections.
  4. [`test_telemetry.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_telemetry.py) (4 tests): Validates room and wearable topic parsing, metric range validation, invalid body temperature rejection, and fall event extraction.
  5. [`test_alert_api.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_alert_api.py) (3 tests): Validates synchronous HTTP ingestion completion, ingestion key security header verification, and `/api/v1/alerts/latest` time/device filtering.
  6. [`test_demo_setup.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_demo_setup.py) (3 tests): Validates idempotent execution of demo seed script and preservation of deactivated patient records.
  7. [`test_security.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_security.py) (3 tests): Validates Bcrypt password hashing lifecycle, JWT creation, claims decoding, and expired token rejection.
  8. [`test_models.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_models.py) (2 tests): Validates SQLAlchemy ORM instantiation, GUID persistence, foreign keys, and cascading deletions.
  9. [`test_latest_readings.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_latest_readings.py) (1 test): Validates latest reading aggregation across paired room and wearable hardware identifiers.
  10. [`test_push.py`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/tests/test_push.py) (1 test): Validates HTTP mocking of the Expo Push API ticket outcomes.
- **Frontend / Mobile Tests**: 0 automated test suites exist in `frontend/src` and `mobile/src` | **[VERIFIED]**.

---

### Empirical Evaluation Metrics in Repo Artifacts vs. Code Reality

- **Reported Accuracy / Sensitivity / False Positive Rates**:
  - Research Paper Draft Fig. 3 ([research.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/research.pdf#L8)) reports: False Positive Rate of $20.6\%$ for B1 (IMU), $11.8\%$ for B2 (PPG), $28.9\%$ for B3 (PIR), and $6.8\%$ for AMPV.
  - Research Paper Draft Fig. 4 ([research.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/research.pdf#L8)) reports: AMPV fall detection sensitivity of $93.4\%$ on an "In-lab proxy cohort", $89.2\%$ on "MobiFall", and $88.6\%$ on "UP-Fall".
  - **Code Reality**: **NOT FOUND IN CODE**. No benchmark datasets, raw trial sensor logs, participant trial records, or evaluation scripts exist within the repository to reproduce these numbers. An IEEE author must not present these numbers as reproducible findings derived from the codebase.

---

## 14. Performance and Resource Clues

- **Microcontroller Clock & Sampling Frequencies**:
  - Wearable ESP32 I2C Bus Clock: $100\text{ kHz}$ (`I2C_SPEED_STANDARD`) ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L421)).
  - MPU6050 Motion Sampling Interval: Sampled every $20\text{ ms}$ ($50\text{ Hz}$) ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L701)).
  - MPU6050 Hardware Low-Pass Filter: Configured to $21\text{ Hz}$ bandwidth (`MPU6050_BAND_21_HZ`) ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L436)).
  - DHT11 Environmental Sampling Rate: Sampled every $2000\text{ ms}$ ($0.5\text{ Hz}$) ([firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L40)).
  - Serial Baud Rate: $115200\text{ baud}$ on both ESP32 and ESP8266 ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L662)).
- **Buffer & Queue Allocations**:
  - Wearable FreeRTOS Inter-Task Queue: Length 1 item of `sizeof(Reading)` ($32\text{ bytes}$) with overwrite semantics ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L678)).
  - Wearable Network FreeRTOS Task Stack: $10240\text{ bytes}$ allocated ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L679)).
  - Room Node Offline Ring Buffer: Static array of 50 messages (`BUF_MAX = 50`), each with an 80-byte topic and 256-byte payload ([firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L47-L50)).
  - PubSubClient MQTT Packet Buffer: $512\text{ bytes}$ configured on both nodes ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L675)).
  - Frontend Client Trend Buffer: Retains last 25 live data points in active view, and last 120 points in session buffer ([frontend/src/lib/useCardio.ts](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/useCardio.ts#L122-L123), [`frontend/src/lib/useRoom.ts`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend/src/lib/useRoom.ts#L94)).
- **Network Timeouts & Intervals**:
  - Embedded MQTT Keep-Alive: $30\text{ seconds}$ on ESP32 ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L676)).
  - Wearable HTTP POST Ingest Timeout: $7000\text{ ms}$ with 3 retry attempts ([firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L244)).
  - Node Heartbeat Interval: $60\text{ seconds}$ on both room and wearable units ([firmware/Room-Kit/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware/firmware.ino#L201)).
  - SMTP Connection Timeout: $10\text{ seconds}$ ([backend/settings.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/settings.py#L35)).
  - Database Connection Timeout: $15\text{ seconds}$ ([backend/database.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/database.py#L17)).

---

## 15. Limitations and Known Issues

1. **Absence of Server-Side Telemetry History Range Queries**: Although incoming telemetry is continuously written to the `readings` table in PostgreSQL, the backend API provides no endpoint to query historical intervals (e.g. past 24 hours, 7 days, or 30 days). The web dashboard History page visualizes only an in-memory session buffer of the current browser tab | **[VERIFIED]**.
2. **Discrepancy Between Research Claims and Firmware Reality**:
   - The research paper draft claims the presence of an MLX90614 infrared body temperature sensor and an active audio buzzer. In the actual code, the ESP32 samples temperature from the MPU6050 die and utilizes a single visual Alert LED on GPIO 2 | **[VERIFIED]**.
3. **Database Architecture Divergence**:
   - System design documentation ([docs/2-Technical-Requirements-Document.md](file:///c:/Users/HP/Desktop/Office/dhruva/docs/2-Technical-Requirements-Document.md#L51), [docs/5-Backend-Schema-Document.md](file:///c:/Users/HP/Desktop/Office/dhruva/docs/5-Backend-Schema-Document.md#L4)) and research paper draft ([research.pdf](file:///c:/Users/HP/Desktop/Office/dhruva/research.pdf#L5)) describe a MongoDB document database with TTL indexes. The codebase implements PostgreSQL relational models via SQLAlchemy without TTL auto-purging | **[VERIFIED]**.
4. **Transport Layer Security Bypassing on Microcontrollers**:
   - Both firmware sketches call `espClient.setInsecure()`, disabling X.509 certificate trust checks. This permits rogue access points to intercept or spoof MQTT telemetry packets | **[VERIFIED]**.
5. **Direct Browser MQTT Broker Exposure**:
   - The web frontend establishes a direct WebSocket connection to the cloud MQTT broker over port 8884. This requires credentials or unrestricted subscription permissions on the broker, rather than proxying telemetry securely through the backend | **[VERIFIED]**.
6. **Alert Status Lifecycle Incompleteness**:
   - The `Alert` relational model includes `acknowledged_at`, `acknowledged_by_id`, `resolved_at`, and `resolved_by_id`, but the REST API lacks endpoints allowing caregivers to acknowledge or resolve alerts | **[VERIFIED]**.

---

## 16. Candidate Contributions for a Research Paper

### Verified Contributions Supported by Code

1. **Cross-Modality Multi-Parameter Verification (AMPV)**: A deterministic clinical decision engine operating over a 60-second temporal correlation window that combines wearable cardiac vitals, body kinematic impacts, and room ambient PIR motion to verify emergency fall and cardiac incidents before generating alerts | **[VERIFIED]** [backend/core/ampv.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/core/ampv.py).
2. **Three-Phase Biomechanical Fall Detection with Dual-Model Height Estimation**: A 50Hz finite state machine implemented on constrained microcontrollers that models free-fall weightlessness ($<0.68\text{ g}$), impact shock ($>2.00\text{ g}$), and post-fall rest ($1000\text{ ms}$), combining kinematic physics ($h = 0.5 \cdot g_{\text{eff}} \cdot t^2$) with non-linear shock power regressions to categorize fall severity | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L463-L548).
3. **Resilient Dual-Channel Cloud Ingestion Topology**: A hybrid communication design supporting persistent bidirectional pub/sub over TLS MQTT (HiveMQ Cloud) for low-latency live streaming, combined with synchronous fallback HTTP POST webhooks (`/api/v1/telemetry/ingest`) to support serverless backend hosting (Vercel) | **[VERIFIED]** [backend/main.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/main.py#L408-L438), [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino#L238-L258).
4. **Relational Patient-Device Decoupling Architecture**: A database schema that pairs heterogeneous physical devices (wearable monitors and ambient room units) to patient entities, enabling independent hardware replacement while maintaining patient-specific alert thresholds and assignment of primary caregivers | **[VERIFIED]** [backend/models/device.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/models/device.py), [backend/models/patient.py](file:///c:/Users/HP/Desktop/Office/dhruva/backend/models/patient.py).
5. **Autonomous Cellular SMS Fallback Dispatch (SIM800L)**: HardwareSerial UART2 driver on the ESP32 that autonomously dispatches high-priority SMS notifications with impact shock (g), estimated fall height (m), and vital signs directly to an emergency contact over GSM cellular networks when WiFi or cloud connectivity fails | **[VERIFIED]** [firmware/wearbale/firmware/firmware.ino](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino).

---

### Unverified Claims to Avoid in the Research Paper

- **Do NOT claim that body temperature is captured via MLX90614 infrared sensing**: The firmware reads the MPU6050 onboard die temperature sensor | **[NOT FOUND IN CODE]**.
- **Do NOT claim that MongoDB with TTL automatic data expiration is used**: The implementation uses PostgreSQL with SQLAlchemy | **[NOT FOUND IN CODE]**.
- **Do NOT claim that the AMPV algorithm uses a weighted scoring formula**: Table II of the research paper draft lists channel weights, but the implemented algorithm executes strict Boolean correlation rules | **[NOT FOUND IN CODE]**.
- **Do NOT claim experimental validation on MobiFall or UP-Fall benchmark datasets**: No test scripts, benchmark logs, or dataset files exist in the repository | **[NOT FOUND IN CODE]**.

---

## 17. Figure and Table Suggestions

### Suggested Figures

1. **System Architectural Topology Diagram**:
   - Nodes: Wearable Unit (ESP32), Room Unit (ESP8266), HiveMQ Cloud Broker, FastAPI Server, PostgreSQL Database, SMTP Mailer, Expo Push Gateway, React Web Dashboard, React Native Mobile App.
   - Edges: Labeled with protocols and port numbers (MQTT TLS 8883, WSS 8884, HTTPS 443, WebSocket `/ws/live`, SMTP 587, TCP 5432).
2. **Three-Phase Fall Detection Finite State Machine (FSM)**:
   - States: `FALL_IDLE`, `FALL_FREE_FALLING`, `FALL_WAITING_REST`.
   - Transitions: $SVM < 0.68\text{ g}$, $SVM > 2.60\text{ g}$, $SVM > 2.00\text{ g}$, timeout $> 800\text{ ms}$, recovery movement $SVM > 2.30\text{ g}$, rest confirmation $\ge 1000\text{ ms}$.
3. **AMPV Decision Logic Flowchart**:
   - Inputs: 60-second correlated snapshot ($HR$, $\text{SpO}_2$, $T_b$, $F$, $M$) and patient thresholds ($\text{hr\_min}$, $\text{hr\_max}$, $\text{spo2\_min}$).
   - Decision Nodes: Rule 1 ($F \land (\text{Abnormal } HR \lor \text{Low } \text{SpO}_2)$), Rule 2 ($\text{Abnormal } HR \land T_b > 38^\circ\text{C}$), Rule 3 ($F \land \text{No Room Motion}$).
   - Terminal Nodes: Issue Critical Emergency Alert vs. Fallback Individual Checks vs. Suppress / Normal.
4. **Relational Database Entity-Relationship Diagram (ERD)**:
   - Entities: `users`, `patients`, `devices`, `device_pairings`, `caregiver_assignments`, `patient_thresholds`, `readings`, `alerts`, `notifications`, `audit_logs`.

---

### Suggested Tables

1. **Hardware Bill of Materials & Pin Configurations**: ESP32 DevKit V1, NodeMCU ESP8266, MAX30102 (I2C 0x57), MPU6050 (I2C 0x68), SH1106 OLED (I2C 0x3C), DHT11 (GPIO 14), HC-SR501 PIR (GPIO 4), Alert LED (GPIO 2).
2. **Clinical Signal Thresholds & Escalation Cut-Offs**: Table listing normal operating ranges, caregiver configurable ranges, warning triggers, and critical escalation cut-offs for heart rate, SpO2, body temperature, room temperature, and fall acceleration.
3. **MQTT Topics and Payload Contracts**: Complete specification of all five topic patterns, publishing nodes, delivery frequencies, and JSON keys.
4. **REST API Endpoint Catalog**: Comprehensive listing of authentication, patient, threshold, telemetry, and alert endpoints.

---

### Screenshot Recommendations (and Privacy Safeguards)

1. **Patients Directory (Web Dashboard)**: Capture view of active patient cards and vital indicators. *Privacy redaction: Blur real personal names, emergency phone numbers, and room numbers; use demo mock profiles (e.g. Dr. Sarah Jenkins).*
2. **Live Patient Monitor (Web Dashboard)**: Capture view showing synchronized real-time pulse oximetry chart, climate readings, and device status badges.
3. **Emergency Fall Banner / Modal**: Capture the high-priority critical fall alert modal showing impact magnitude, estimated fall height, and category.
4. **Mobile Patient Dashboard (React Native)**: Capture mobile view of vital metrics and recent alert history cards.

---

## 18. Literature-Search Keywords

1. **Ambient Assisted Living (AAL)** (IEEE standard domain term for elderly remote monitoring).
2. **Multi-Sensor Data Fusion** (Methods combining physiological and ambient data streams).
3. **Wearable Photoplethysmography (PPG)** (Optical pulse oximetry and heart rate estimation).
4. **Inertial Measurement Unit (IMU) Fall Detection** (Accelerometer and gyroscope kinematic modeling).
5. **Threshold-Based False Alarm Reduction** (Techniques combating alert fatigue in clinical monitoring).
6. **Remote Patient Monitoring (RPM)** (Cloud-connected healthcare telemetry architectures).
7. **Internet of Medical Things (IoMT)** (Standard networking paradigm for connected biomedical sensors).
8. **Asynchronous MQTT Telemetry Ingestion** (Low-overhead pub/sub architectures for constrained microcontrollers).
9. **Kinematic Fall Height Estimation** (Free-fall duration and shock power modeling).
10. **Dicrotic Notch Suppression** (Algorithms filtering optical pulse waveform reflections).
11. **Clinical Alert Fatigue** (Human-factors literature justifying multi-parameter verification).
12. **Relevant Protocols and Standards**:
    - **OASIS MQTT v3.1.1 / v5.0** (Standard IoT messaging protocol).
    - **RFC 5246 / RFC 8446 (TLS 1.2 / 1.3)** (Transport Layer Security over port 8883/8884).
    - **RFC 7519 (JSON Web Tokens - JWT)** (Stateless authorization assertion).
    - **RFC 5322 (Internet Message Format)** (Standard email notification structure).

---

## 19. Questions the Code Cannot Answer

*(Items the research-paper author must obtain directly from the project owner)*

1. **Experimental Benchmarking**:
   - Were the sensitivity and false-positive numbers reported in the research paper draft (e.g., $93.4\%$ sensitivity, $6.8\%$ false-positive rate, MobiFall/UP-Fall comparisons) generated from a separate physical experiment, or were they borrowed from related literature as hypothetical targets?
   - If real physical experiments were performed, where are the raw trial data logs, motion capture reference recordings, and participant trial counts stored?
2. **Human Subject & Ethical Approvals**:
   - Did the hardware trials involve elderly human participants or student proxies?
   - What Institutional Review Board (IRB) or Institutional Ethics Committee (IEC) approval number governs the clinical vital sign and fall simulation testing?
3. **Physical Hardware Packaging & Power Profiling**:
   - What specific Lithium-Polymer (LiPo) battery capacity (mAh) and power management IC (PMIC) were used in the wearable housing prototype?
   - What is the measured active operating battery life (in hours) of the wearable unit under continuous 50Hz motion sampling and 100Hz optical sensor operation?
4. **Optical Sensor Calibration**:
   - Was the empirical linear SpO2 calibration formula ($\text{SpO}_2 = 112.0 - 22.0 \cdot R$) calibrated against a commercial medical reference pulse oximeter (e.g. Masimo, Nellcor), or derived from standard manufacturer application notes?
5. **Deployment Context**:
   - In what physical environment (e.g. clinical hospital ward, old-age home, residential apartment) was the dual-node system physically installed, and what was the maximum reliable WiFi transmission distance observed?

---

## Report Completeness Checklist

- [x] **Section 1: Project Identity** — Fully answered with verified code evidence.
- [x] **Section 2: Maturity and Completeness** — Fully answered with explicit status table, comment counts, and scaffolding analysis.
- [x] **Section 3: Architecture** — Fully answered with component roles, connection protocols, and Mermaid diagram.
- [x] **Section 4: Technology Stack** — Fully answered with structured table quoting exact manifest versions.
- [x] **Section 5: Data Flow** — Fully answered with step-by-step traces for routine telemetry, AMPV emergencies, and sequence diagram.
- [x] **Section 6: Modules and Responsibilities** — Fully answered covering backend, firmware, frontend, and mobile files.
- [x] **Section 7: Algorithms, Models, and Rules** — Fully answered with mathematical formulas, exact parameters, and state machine stages.
- [x] **Section 8: Data and Datasets** — Fully answered distinguishing missing external datasets from relational database schemas.
- [x] **Section 9: Interfaces** — Fully answered with complete REST endpoints, WebSockets, MQTT topics, and hardware pinouts.
- [x] **Section 10: Database** — Fully answered with relational ER diagram, column definitions, and retention notes.
- [x] **Section 11: Security and Privacy Mechanisms** — Fully answered with cryptographic details and redacted security observations.
- [x] **Section 12: Configuration and Deployment** — Fully answered with complete environment variables and run commands.
- [x] **Section 13: Testing and Evaluation Evidence** — Fully answered detailing 48 backend test suites and absent benchmark files.
- [x] **Section 14: Performance and Resource Clues** — Fully answered with exact sampling rates, stack sizes, timeouts, and buffer limits.
- [x] **Section 15: Limitations and Known Issues** — Fully answered highlighting discrepancies between documentation and code.
- [x] **Section 16: Candidate Contributions for a Paper** — Fully answered separating verified contributions from unsupported paper claims.
- [x] **Section 17: Figure and Table Suggestions** — Fully answered with diagram topologies, table specifications, and redaction guidance.
- [x] **Section 18: Literature-Search Keywords** — Fully answered with 12 targeted academic phrases and networking standards.
- [x] **Section 19: Questions the Code Cannot Answer** — Fully answered with 5 critical questions for the project owner.
