# CareTrack · IoT Elderly Health & Cardiac Risk Monitoring System

> **A real-time remote healthcare and environmental telemetry platform connecting wearable biometrics and ambient room sensors to an asynchronous FastAPI backend and live web dashboards via HiveMQ Cloud MQTT.**

---

## 📑 Table of Contents

1. [System Overview & Architecture](#-system-overview--architecture)
2. [Repository Directory Structure](#-repository-directory-structure)
3. [Prerequisites & Bill of Materials](#-prerequisites--bill-of-materials)
4. [Hardware Wiring & Pinouts](#-hardware-wiring--pinouts)
5. [Firmware Flashing & Setup](#-firmware-flashing--setup)
6. [Database & Backend Setup](#-database--backend-setup)
7. [Running & Accessing the Web Dashboards](#-running--accessing-the-web-dashboards)
8. [MQTT Topics & Payload Data Contracts](#-mqtt-topics--payload-data-contracts)
9. [REST API & WebSocket Reference](#-rest-api--websocket-reference)
10. [Companion Mobile App & Documentation](#-companion-mobile-app--documentation)
11. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏛 System Overview & Architecture

CareTrack bridges hardware sensing, secure cloud messaging, real-time backend persistence, and low-latency frontend dashboards:

The backend alert engine implements the paper's Adaptive Multi-Parameter Verification (AMPV) rules. It correlates paired wearable and room readings from a 60-second window and marks combined fall/vital, heart-rate/fever, or fall/no-motion evidence as one verified critical emergency. Single-sensor conditions retain the existing fail-safe alerts.

```
┌─────────────────────────────────────────────────────────┐
│                     IOT HARDWARE                        │
│                                                         │
│  [Wearable Unit (ESP32)]         [Room Unit (ESP8266)]  │
│  - MAX30102 (HR / SpO2)         - DHT11 (Temp/Humidity) │
│  - MPU6050 (Fall/Motion)        - PIR (Motion Sensor)   │
│  - SH1106/SSD1306 OLED                                  │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             │ TLS Port 8883 (MQTT)       │ TLS Port 8883 (MQTT)
             ▼                            ▼
┌─────────────────────────────────────────────────────────┐
│               HIVEMQ CLOUD MQTT BROKER                  │
│       Topics: caretrack/+/..., cardiac/monitor/data     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  FASTAPI BACKEND SERVER                 │
│  - Paho-MQTT Ingestion Worker (async loop)              │
│  - Asynchronous DB Retention via PostgreSQL             │
│  - Alert WebSocket Broadcaster (/ws/live)               │
│  - REST API (/readings/latest, /health)                 │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
       Verified Alerts             API / Push Alerts
               ▼                          ▼
┌───────────────────────────┐  ┌──────────────────────────┐
│    LIVE WEB DASHBOARD     │  │   COMPANION MOBILE APP   │
│ - Unified Patient Monitor │  │ - React Native / Expo    │
│ - Direct MQTT Live Values │  │ - Caregiver Push Alerts  │
│ - Ambient Climate & Fall  │  │ - Historical Trends      │
└───────────────────────────┘  └──────────────────────────┘
```

The web dashboard subscribes to HiveMQ over secure WebSockets for low-latency
room and wearable values. In parallel, the backend consumes the same MQTT
events for persistence and AMPV evaluation; only its verified alerts are sent
to the web dashboard over `/ws/live`.

Because Vercel cannot keep the MQTT worker alive between requests, the wearable
also posts detected falls to `/api/v1/telemetry/ingest`. Open web and mobile
clients read persisted backend alerts through `/api/v1/alerts/latest`; closed
mobile apps receive the same backend alert through Expo push notifications.

---

## 📂 Repository Directory Structure

```text
dhruva/
├── README.md                      # Master project documentation (this file)
├── cardiac_monitor.ino            # Standalone ESP32 MAX30102 + OLED firmware sketch
├── Project Synopsis ours.pdf      # VTU Project synopsis & academic concept proposal
├── research.pdf                   # Clinical and technical background research paper
│
├── backend/                       # FastAPI ingestion engine & API server
│   ├── main.py                    # Application entry point, MQTT handler, WebSocket manager
│   ├── schema.sql                 # PostgreSQL relational schema & indexes
│   ├── requirements.txt           # Standard Python dependencies
│   ├── pyproject.toml / uv.lock   # uv package manager specifications
│   ├── Pipfile                    # Pipenv configuration
│   ├── .env                       # Active runtime environment secrets
│   └── .env.example               # Template environment configuration
│
├── frontend/                      # Vite + React web dashboard (main web UI)
│   └── src/                       # Views, components, styles & API/WebSocket clients
│
├── mobile/                        # React Native (Expo) caregiver & patient app
│   └── src/                       # Screens, components, fixtures & theme
│
├── firmware/                      # Microcontroller source code
│   ├── Room-Kit/
│   │   └── firmware.ino           # NodeMCU ESP8266 sketch (DHT11 + PIR + HiveMQ)
│   └── wearbale/
│       └── firmware/
│           └── firmware.ino       # ESP32 sketch (MAX30102 + MPU6050 + OLED + HiveMQ)
│
└── docs/                          # Comprehensive system documentation
    ├── 1-Product-Requirements-Document.md  # PRD & scope
    ├── 2-Technical-Requirements-Document.md# TRD & architecture
    ├── 3-App-Flow-Document.md              # User journeys & screens
    ├── 4-UIUX-Design-Brief.md              # Design system & tokens
    ├── 5-Backend-Schema-Document.md        # Data models & storage
    └── 6-Implementation-Plan.md            # Multi-phase engineering roadmap
```

---

## 🧰 Prerequisites & Bill of Materials

### 1. Hardware Components
| Component | Function | Target Board |
|---|---|---|
| **ESP32 DevKit V1** (30 or 38 pin) | Wearable unit processing & TLS MQTT | Wearable |
| **NodeMCU v3 / ESP8266** | Room sensor telemetry & offline buffering | Room Unit |
| **MAX30102 or MAX30100** | Optical pulse oximetry (Heart Rate & SpO₂) | Wearable |
| **MPU6050** | 6-axis IMU for fall detection & motion dynamics | Wearable |
| **0.96" or 1.3" OLED (I2C)** | SSD1306 / SH1106 on-device visual readout (0x3C) | Wearable |
| **HC-SR501 or AM312** | PIR passive infrared room motion sensor | Room Unit |
| **DHT11 or DHT22** | Ambient room temperature and relative humidity | Room Unit |
| **Red LED & 220Ω Resistor** | Critical alert status indicator | Wearable |

### 2. Software Tools
- **Python**: Version `3.11+`
- **Package Manager**: [uv](https://github.com/astral-sh/uv) (recommended) or `pip` / `virtualenv`
- **Database**: PostgreSQL `14+` (local or hosted on Supabase / Neon / Render)
- **Arduino IDE**: Version `2.x+` (or PlatformIO in VS Code)
- **MQTT Broker**: Free cluster on [HiveMQ Cloud](https://www.hivemq.com/cloud/)

---

## 🔌 Hardware Wiring & Pinouts

### 1. Wearable Unit (ESP32)

Both the **MAX30102**, **MPU6050**, and **OLED Display** operate over the shared I2C bus:

| Component Pin | ESP32 GPIO | Description |
|---|---|---|
| **All VCC / VIN** | `3.3V` (or `5V` if sensor board has LDO) | Power Supply |
| **All GND** | `GND` | Common Ground |
| **MAX30102 SDA** | `GPIO 21` | I2C Data Line |
| **MAX30102 SCL** | `GPIO 22` | I2C Clock Line |
| **MPU6050 SDA** | `GPIO 21` | Shared I2C Data |
| **MPU6050 SCL** | `GPIO 22` | Shared I2C Clock |
| **OLED SDA** | `GPIO 21` | Shared I2C Data (Address `0x3C`) |
| **OLED SCL** | `GPIO 22` | Shared I2C Clock |
| **ALERT LED (+)** | `GPIO 2` | Active-high fall/emergency alert LED |
| **ALERT LED (-)** | `GND` (via 220Ω resistor) | Current limiting resistor |

> [!NOTE]
> MPU6050 uses I2C address `0x68`, OLED uses `0x3C`, and MAX30102 uses `0x57`. They share GPIO 21 and 22 without collision.

---

### 2. Room Unit (NodeMCU ESP8266)

| Sensor Pin | NodeMCU Pin | GPIO Pin | Notes |
|---|---|---|---|
| **PIR OUT** | `D2` | `GPIO 4` | Digital motion pulse |
| **PIR VCC** | `VIN` | `5V / USB` | HC-SR501 requires 5V supply |
| **PIR GND** | `GND` | `GND` | Ground |
| **DHT11 DATA** | `D5` | `GPIO 14` | Digital 1-wire communication |
| **DHT11 VCC** | `3V3` or `VIN` | `3.3V / 5V` | Sensor power |
| **DHT11 GND** | `GND` | `GND` | Ground |

---

## ⚡ Firmware Flashing & Setup

### Step 1: Install Arduino Board Packages
1. Open **Arduino IDE** -> **Settings / Preferences**.
2. Add the following URLs into **Additional Boards Manager URLs**:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   https://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. Open **Boards Manager** (`Ctrl+Shift+B` or sidebar) and install:
   - `esp32` by **Espressif Systems**
   - `esp8266` by **ESP8266 Community**

### Step 2: Install Arduino Libraries
In **Library Manager** (`Ctrl+Shift+I`), search and install:
- `PubSubClient` by Nick O'Leary
- `SparkFun MAX3010x Pulse and Proximity Sensor Library`
- `Adafruit MPU6050`
- `Adafruit Unified Sensor`
- `Adafruit GFX Library`
- `Adafruit SH110X` and `Adafruit SSD1306`
- `DHT sensor library` by Adafruit

---

### Step 3: Flash the Wearable Unit (ESP32)

1. Open [`firmware/wearbale/firmware/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/wearbale/firmware/firmware.ino) in Arduino IDE.
2. Copy `secrets.example.h` beside the sketch as `secrets.h`, then enter the WiFi and MQTT credentials there. `secrets.h` is ignored by Git.
3. Select Board: **ESP32 Dev Module** (or **DOIT ESP32 DEVKIT V1**).
4. Connect ESP32 via Micro-USB, select the COM port, and click **Upload**.
5. Open Serial Monitor at **115200 baud** to verify WiFi & TLS MQTT connection.

---

### Step 4: Flash the Room Unit (NodeMCU ESP8266)

1. Open [`firmware/Room-Kit/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware.ino) in Arduino IDE.
2. Copy `secrets.example.h` beside the sketch as `secrets.h`, then enter the WiFi and MQTT credentials there. `secrets.h` is ignored by Git.
3. Select Board: **NodeMCU 1.0 (ESP-12E Module)**.
4. Select the COM port, set CPU frequency to **80 MHz**, and click **Upload**.
5. Open Serial Monitor at **115200 baud**.

---

## 🗄 Database & Backend Setup

The backend is built with **FastAPI**, **SQLAlchemy**, and **Paho-MQTT**, using **PostgreSQL** for persistent telemetry logging.

### Step 1: Create the PostgreSQL Database

Using `psql` or `pgAdmin`:
```sql
CREATE DATABASE caretrack;
```

Run the schema migration from the [`backend/schema.sql`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/schema.sql) file:
```bash
psql -U postgres -d caretrack -f backend/schema.sql
```
*(Note: SQLAlchemy will also automatically create the `readings` table upon startup if it does not already exist).*

---

### Step 2: Configure Environment Variables

Navigate to the [`backend`](file:///c:/Users/HP/Desktop/Office/dhruva/backend) folder and ensure your [`.env`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/.env) contains:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/caretrack

# HiveMQ Cloud TLS Endpoint (Port 8883)
MQTT_BROKER_URL=YOUR_HIVEMQ_CLUSTER.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=YOUR_MQTT_USERNAME
MQTT_PASSWORD=YOUR_MQTT_PASSWORD

# FastAPI Server Host & Port
APP_HOST=0.0.0.0
APP_PORT=8000
```
A template is available at [`backend/.env.example`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/.env.example).

---

### Step 3: Install Dependencies & Run the Server

#### Option A: Using `uv` (Fastest, Recommended)
```powershell
cd c:\Users\HP\Desktop\Office\dhruva\backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Option B: Using Standard Python Virtual Environment
```powershell
cd c:\Users\HP\Desktop\Office\dhruva\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Expected Terminal Startup Output:
```text
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
[App] Starting MQTT client
[MQTT] Connected rc=0
[MQTT] Subscribed to Room, Wearable (Motion/Fall), and Cardiac topics
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

## 🖥 Running & Accessing the Web UI

### 1. React Web App (Vite)
The dashboards now live in [`frontend/`](file:///c:/Users/HP/Desktop/Office/dhruva/frontend) — the legacy `backend/static/` HTML dashboards were removed:

```powershell
cd c:\Users\HP\Desktop\Office\dhruva\frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api`, `/readings` and `/ws` to the backend.

Before the first hardware demo, pair the default room and wearable identifiers to the same patient:

```powershell
cd backend
uv run python setup_demo_devices.py
```

The command is idempotent and refuses to replace an existing active pairing.

### Onboard a Patient

1. Create or sign in with a real **Care Taker** account. The one-click demo login cannot onboard patients.
2. Open **Patients Directory** and select **+ Add Patient**.
3. Enter the patient profile, family emergency contact email, and both device IDs.

The backend creates both device pairings and assigns the signed-in caretaker in one transaction. Emergency emails for those devices are then sent to the assigned caretaker and the patient's family contact. Duplicate rooms and devices that are already paired are rejected.

| Route | URL | Description |
|---|---|---|
| **Web App** | [http://localhost:5173](http://localhost:5173) | CareTrack patient & room status monitor (login required) |
| **API Index** | [http://localhost:8000](http://localhost:8000) | Backend service index (JSON) |
| **API Health** | [http://localhost:8000/health](http://localhost:8000/health) | Backend health check probe |
| **Latest Vitals** | [http://localhost:8000/readings/latest?device_id=room-unit-01](http://localhost:8000/readings/latest?device_id=room-unit-01) | Query latest readings for a device |
| **OpenAPI Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |

#### Connecting on the Dashboard:
- The dashboard reads live telemetry directly from MQTT and uses the backend
  WebSocket only for verified alerts and warnings.

---

## 📡 MQTT Topics & Payload Data Contracts

All telemetry passes through HiveMQ Cloud over secure TLS (`port 8883`):

| Topic Pattern | Publisher | Payload Structure |
|---|---|---|
| `caretrack/{device_id}/room/environment` | NodeMCU | `{"device_id":"room-unit-01","sensor":"room","timestamp":"...","data":{"temperature":24.5,"humidity":52}}` |
| `caretrack/{device_id}/room/motion` | NodeMCU | `{"device_id":"room-unit-01","sensor":"room","timestamp":"...","data":{"motion_detected":true}}` |
| `caretrack/{device_id}/wearable/vitals` | ESP32 | `{"device_id":"ESP32-01","sensor":"wearable","timestamp":"...","data":{"heart_rate":74,"spo2":98,"temperature":36.6}}` |
| `caretrack/{device_id}/wearable/motion` | ESP32 | `{"device_id":"ESP32-01","sensor":"wearable","timestamp":"...","data":{"accel_magnitude":1.02,"fall_detected":false}}` |
| `cardiac/monitor/data` | ESP32 / Wearable | `{"device_id":"ESP32-CardiacMonitor","sensor":"wearable","timestamp":"...","data":{"heart_rate":72,"spo2":98,"accel_magnitude":1.01,"fall_detected":false}}` |
| `caretrack/{device_id}/status` | Both | `{"device_id":"...","sensor":"...","timestamp":"...","data":{"status":"online"}}` |

---

## 🔌 REST API & WebSocket Reference

### 1. REST Endpoints

#### `GET /health`
Returns system status.
```json
{"status": "ok"}
```

#### `GET /readings/latest?device_id={device_id}`
Returns the most recent reading for each tracked metric.
```json
{
  "device_id": "room-unit-01",
  "temperature": { "value": 24.5, "timestamp": "2026-10-09T09:15:00Z" },
  "humidity": { "value": 52.0, "timestamp": "2026-10-09T09:15:00Z" },
  "motion_detected": { "value": 1.0, "timestamp": "2026-10-09T09:15:00Z" },
  "heart_rate": { "value": 75.0, "timestamp": "2026-10-09T09:15:00Z" },
  "spo2": { "value": 98.0, "timestamp": "2026-10-09T09:15:00Z" },
  "cardio_temp": { "value": 36.6, "timestamp": "2026-10-09T09:15:00Z" },
  "last_seen": "2026-10-09T09:15:00Z"
}
```

### 2. WebSocket Stream (`/ws/live`)
- **URL**: `ws://localhost:8000/ws/live`
- **Behavior**: Broadcasts incoming metrics to all connected clients in real time (<1ms).
- **Message format**:
  ```json
  {
    "device_id": "room-unit-01",
    "sensor": "room",
    "timestamp": "2026-10-09T09:15:00+00:00",
    "metric": "temperature",
    "value": 24.5,
    "fall_detected": false
  }
  ```

---

## 📱 Companion Mobile App & Documentation

Detailed product and technical documentation is maintained under [`docs/`](file:///c:/Users/HP/Desktop/Office/dhruva/docs):

- [`1-Product-Requirements-Document.md`](file:///c:/Users/HP/Desktop/Office/dhruva/docs/1-Product-Requirements-Document.md) — Problem statement, caregiver persona, goals, and non-goals.
- [`2-Technical-Requirements-Document.md`](file:///c:/Users/HP/Desktop/Office/dhruva/docs/2-Technical-Requirements-Document.md) — System architecture, transport contracts, and alert rule engines.
- [`3-App-Flow-Document.md`](file:///c:/Users/HP/Desktop/Office/dhruva/docs/3-App-Flow-Document.md) — Screen-by-screen UX flow (Onboarding, Emergency Fall Alert, History).
- [`4-UIUX-Design-Brief.md`](file:///c:/Users/HP/Desktop/Office/dhruva/docs/4-UIUX-Design-Brief.md) — Design tokens, color palette, typography, and card structures.
- [`5-Backend-Schema-Document.md`](file:///c:/Users/HP/Desktop/Office/dhruva/docs/5-Backend-Schema-Document.md) — Extended schema definitions for users, profiles, and alert histories.
- [`6-Implementation-Plan.md`](file:///c:/Users/HP/Desktop/Office/dhruva/docs/6-Implementation-Plan.md) — Step-by-step phased engineering roadmap.

The caregiver companion app is designed for **React Native (Expo)**:
```bash
npx expo run:android
# or
npx expo start
```

---

## 🔍 Troubleshooting & FAQs

### 1. Database Connection Refused
- **Problem**: `Is the server running on host "localhost" (127.0.0.1) and accepting TCP/IP connections on port 5432?`
- **Solution**:
  1. Ensure the PostgreSQL service is running (`services.msc` on Windows -> start `postgresql-x64-14` or equivalent).
  2. Verify that credentials in [`backend/.env`](file:///c:/Users/HP/Desktop/Office/dhruva/backend/.env) match your local PostgreSQL password.

### 2. MQTT TLS Handshake Failed (rc=-2 or connection timeout)
- **Problem**: Firmware or backend fails to authenticate to HiveMQ Cloud.
- **Solution**:
  1. HiveMQ Cloud requires port `8883` with TLS enabled. Plaintext port `1883` is not accepted.
  2. In Arduino, ensure `WiFiClientSecure` is used with `espClient.setInsecure()` (or Root CA attached) to prevent certificate validation errors on embedded devices.
  3. Ensure your HiveMQ cluster URL does not contain `ssl://` or `mqtts://` prefixes in the `.env` or sketch definitions.

### 3. ESP32 / ESP8266 WiFi Not Connecting
- **Problem**: Device halts at `Connecting to WiFi...`
- **Solution**:
  - ESP32 and ESP8266 only support **2.4 GHz WiFi**. Connect the device to a 2.4 GHz network or mobile hotspot (disable 5 GHz-only mode).

### 4. MAX30102 or MPU6050 Not Detected
- **Problem**: Serial monitor reports `MAX30102 was not found. Please check wiring/power.`
- **Solution**:
  1. Verify I2C connections: SDA to GPIO 21, SCL to GPIO 22.
  2. Run an I2C scanner sketch to confirm device addresses (`0x57` for MAX30102, `0x68` for MPU6050, `0x3C` for OLED).
  3. Ensure pull-up resistors (4.7kΩ) are present on the I2C lines if using raw breakout boards without onboard pull-ups.

---

## 👥 Contributors & Academic Attribution
- **Project**: VTU Final Year Project — *IoT Based Elderly Health Monitoring System*
- **Institution**: Alva's Institute of Engineering & Technology
- **Repository**: CareTrack Core Telemetry & Firmware
