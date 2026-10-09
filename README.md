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
8. [Hardware-Free Testing (Telemetry Simulator)](#-hardware-free-testing-telemetry-simulator)
9. [MQTT Topics & Payload Data Contracts](#-mqtt-topics--payload-data-contracts)
10. [REST API & WebSocket Reference](#-rest-api--websocket-reference)
11. [Companion Mobile App & Documentation](#-companion-mobile-app--documentation)
12. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏛 System Overview & Architecture

CareTrack bridges hardware sensing, secure cloud messaging, real-time backend persistence, and low-latency frontend dashboards:

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
│  - Real-Time WebSocket Broadcaster (/ws/live) (<1ms)    │
│  - REST API (/readings/latest, /health)                 │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
       WebSocket Broadcast         Direct Static Serve
               ▼                          ▼
┌───────────────────────────┐  ┌──────────────────────────┐
│    LIVE WEB DASHBOARD     │  │   COMPANION MOBILE APP   │
│ - Unified Patient Monitor │  │ - React Native / Expo    │
│ - Heart Rate / SpO2 / Temp│  │ - Caregiver Push Alerts  │
│ - Ambient Climate & Fall  │  │ - Historical Trends      │
└───────────────────────────┘  └──────────────────────────┘
```

---

## 📂 Repository Directory Structure

```text
dhruva/
├── README.md                      # Master project documentation (this file)
├── cardiac_monitor.ino            # Standalone ESP32 MAX30102 + OLED firmware sketch
├── Project Synopsis ours.pdf      # VTU Project synopsis & academic concept proposal
├── research.pdf                   # Clinical and technical background research paper
│
├── backend/                       # FastAPI ingestion engine & static dashboard server
│   ├── main.py                    # Application entry point, MQTT handler, WebSocket manager
│   ├── schema.sql                 # PostgreSQL relational schema & indexes
│   ├── simulate_sensors.py        # Python telemetry simulator for hardware-free testing
│   ├── requirements.txt           # Standard Python dependencies
│   ├── pyproject.toml / uv.lock   # uv package manager specifications
│   ├── Pipfile                    # Pipenv configuration
│   ├── .env                       # Active runtime environment secrets
│   ├── .env.example               # Template environment configuration
│   └── static/                    # Frontend dashboards served directly by FastAPI
│       ├── index.html             # Unified CareTrack patient & room dashboard
│       └── cardio.html            # Dedicated cardiac waveform & vital monitor
│
├── firmware/                      # Microcontroller source code
│   ├── Room-Kit/
│   │   └── firmware.ino           # NodeMCU ESP8266 sketch (DHT11 + PIR + HiveMQ)
│   └── wearbale/
│       └── firmware/
│           └── firmware.ino       # ESP32 sketch (MAX30102 + MPU6050 + OLED + HiveMQ)
│
├── web_dashboard/
│   └── index.html                 # Standalone client dashboard with direct MQTT/WS support
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
2. Update the credentials at the top of the file:
   ```cpp
   #define WIFI_SSID       "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

   #define MQTT_BROKER_URL "YOUR_HIVEMQ_CLUSTER.s1.eu.hivemq.cloud"
   #define MQTT_PORT       8883
   #define MQTT_USERNAME   "YOUR_MQTT_USERNAME"
   #define MQTT_PASSWORD   "YOUR_MQTT_PASSWORD"
   ```
3. Select Board: **ESP32 Dev Module** (or **DOIT ESP32 DEVKIT V1**).
4. Connect ESP32 via Micro-USB, select the COM port, and click **Upload**.
5. Open Serial Monitor at **115200 baud** to verify WiFi & TLS MQTT connection.

---

### Step 4: Flash the Room Unit (NodeMCU ESP8266)

1. Open [`firmware/Room-Kit/firmware.ino`](file:///c:/Users/HP/Desktop/Office/dhruva/firmware/Room-Kit/firmware.ino) in Arduino IDE.
2. Update WiFi & MQTT credentials:
   ```cpp
   #define WIFI_SSID       "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

   #define MQTT_BROKER_URL "YOUR_HIVEMQ_CLUSTER.s1.eu.hivemq.cloud"
   #define MQTT_PORT       8883
   #define MQTT_USERNAME   "YOUR_MQTT_USERNAME"
   #define MQTT_PASSWORD   "YOUR_MQTT_PASSWORD"
   ```
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
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/caretrack

# HiveMQ Cloud TLS Endpoint (Port 8883)
MQTT_BROKER_URL=592dc9d2e79e40e1bf88e094608c669a.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=room-kit
MQTT_PASSWORD=Room-Kit@1

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

## 🖥 Running & Accessing the Web Dashboards

### 1. Integrated FastAPI Web Dashboard
Once the backend server is running, open your web browser to:

| Route | URL | Description |
|---|---|---|
| **Main Dashboard** | [http://localhost:8000](http://localhost:8000) | Unified CareTrack patient & room status monitor |
| **Cardiac Monitor** | [http://localhost:8000/cardio](http://localhost:8000/cardio) | Focused real-time cardiac & PPG waveform viewer |
| **API Health** | [http://localhost:8000/health](http://localhost:8000/health) | Backend health check probe |
| **Latest Vitals** | [http://localhost:8000/readings/latest?device_id=room-unit-01](http://localhost:8000/readings/latest?device_id=room-unit-01) | Query latest readings for a device |

#### Connecting on the Dashboard:
- Enter your device ID: `room-unit-01` or `ESP32-CardiacMonitor` (or click the pre-filled connect button).
- The dashboard automatically opens a WebSocket to `ws://localhost:8000/ws/live` and renders telemetry in real time.

---

### 2. Standalone Web Dashboard
The [`web_dashboard/index.html`](file:///c:/Users/HP/Desktop/Office/dhruva/web_dashboard/index.html) file can also be run independently using any static HTTP server:
```powershell
# Using Python's built-in HTTP server
cd c:\Users\HP\Desktop\Office\dhruva\web_dashboard
python -m http.server 3000
```
Then navigate to `http://localhost:3000`.

---

## 🧪 Hardware-Free Testing (Telemetry Simulator)

To verify the entire cloud ingestion, database retention, WebSocket broadcasting, and live UI without plugging in any hardware:

1. Keep the FastAPI backend running in your primary terminal.
2. Open a second terminal window and run:
   ```powershell
   cd c:\Users\HP\Desktop\Office\dhruva\backend
   python simulate_sensors.py
   ```
3. **What happens:**
   - Every 3 seconds, the simulator publishes real-time data to HiveMQ Cloud.
   - Ambient room data (temperature, humidity, motion pulses).
   - Wearable data (heart rate, SpO₂, body temperature, accelerometer readings).
   - Simulates occasional fall incidents with critical acceleration peaks.
4. Watch the updates instantly appear on your browser at [http://localhost:8000](http://localhost:8000)!

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
