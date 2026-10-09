/*
 * Wearable Cardiac Risk Monitoring System - ESP32 Secure MQTT (HiveMQ Cloud)
 * ============================================================================
 * MAX30100 / MAX30102  --I2C-->  ESP32  --TLS 8883-->  HiveMQ Cloud  --> Frontend
 *                                  |
 *                                  '--I2C--> SSD1306 / SH1106 OLED (local readout)
 *
 * Board       : Standard ESP32 (Dev Module / DevKit V1, 30 or 38 pins)
 *
 * Pinout:
 *   - I2C SDA : GPIO 21
 *   - I2C SCL : GPIO 22
 *   - Sensor  : VIN -> 3.3V or 5V, GND -> GND
 *   - OLED    : Shared on GPIO 21 & 22 (addr 0x3C)
 *
 * Libraries required (Arduino IDE -> Library Manager):
 *   - "PubSubClient" by Nick O'Leary
 *   - "SparkFun MAX3010x Pulse and Proximity Sensor Library"
 *   - "Adafruit GFX Library"
 *   - "Adafruit SSD1306" (or "Adafruit SH110X" if using 1.3" OLED)
 *
 * Files: this sketch must live in a folder named "cardiac_monitor" next to
 *        secrets.h (WiFi / MQTT credentials, optional root CA).
 *
 * Architecture:
 *   loop()        (core 1) : sensor reading, beat detection, SpO2, OLED
 *   networkTask() (core 0) : WiFi, NTP, TLS MQTT connect/publish
 *   The two talk through a 1-slot queue, so a slow TLS reconnect can never
 *   starve the sensor FIFO and cause false beats or lost lock.
 *
 * NOTE: SpO2 uses a generic linear approximation and is NOT clinically
 *       calibrated. Treat these values as a prototype, not a medical device.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <time.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <Adafruit_GFX.h>

#include "secrets.h"

const char* MQTT_CLIENT_ID = "ESP32-CardiacMonitor";
const char* MQTT_TOPIC     = "cardiac/monitor/data";

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ---------------------------------------------------------------------------
// Hardware Pinout
// ---------------------------------------------------------------------------
#define I2C_SDA_PIN  21
#define I2C_SCL_PIN  22

// OLED Configuration
#define OLED_ENABLED  1
#define OLED_SH1106   1        // 1 = SH1106 (1.3" OLED)
#define OLED_WIDTH    128
#define OLED_HEIGHT   64
#define OLED_ADDR     0x3C
#define OLED_ROTATION 2        // 2 = 180 deg (right-side up with bottom pins)

#if OLED_ENABLED
  #if OLED_SH1106
    #include <Adafruit_SH110X.h>
    Adafruit_SH1106G display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
    #define OLED_WHITE SH110X_WHITE
  #else
    #include <Adafruit_SSD1306.h>
    Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
    #define OLED_WHITE SSD1306_WHITE
  #endif
#endif

// Battery: set to 1 only if you wired a 2:1 divider from the cell to the ADC pin.
#define BATTERY_MONITOR_ENABLED 0
#define BATTERY_ADC_PIN         34

// ---------------------------------------------------------------------------
// Tunable parameters
// ---------------------------------------------------------------------------
static const uint32_t REPORT_INTERVAL_MS = 1000;

static const uint32_t FINGER_IR_MIN = 6000;
static const uint32_t IR_TARGET_LO  = 15000;
static const uint32_t IR_TARGET_HI  = 48000;
static const uint32_t IR_CLIP       = 52000;

static const uint8_t  LED_START = 0x33;

// Heart rate / beat filtering
static const uint8_t  IBI_SIZE       = 8;
static const uint16_t IBI_MIN_MS     = 330;    // hard floor  (~180 BPM)
static const uint16_t IBI_MAX_MS     = 1500;   // hard ceiling (~40 BPM)
static const uint8_t  HR_MIN_BPM     = 40;
static const uint8_t  HR_MAX_BPM     = 185;
static const uint8_t  HR_LOCK_N      = 4;      // accepted beats needed before lock
static const uint8_t  EARLY_PCT      = 70;     // IBI < 70% of median  -> notch/noise, reject
static const uint8_t  LATE_PCT       = 160;    // IBI > 160% of median -> missed beat, resync
static const uint8_t  RHYTHM_TOL_PCT = 20;     // IBIs must be within 20% of median to lock
static const uint8_t  REJECT_RESET_N = 6;      // consecutive rejects -> rebuild baseline
static const int      HR_MAX_STEP    = 15;     // max displayed HR change per second

static const uint32_t LOCK_TIMEOUT_MS = 4000;

// Signal quality: perfusion index = AC/DC of IR over 1 s, in percent
static const float    PI_MIN_PCT = 0.15f;
static const float    PI_MAX_PCT = 8.0f;

// SpO2
static const uint8_t  SPO2_MED_SIZE = 7;
static const uint8_t  SPO2_MIN      = 70;      // below this the sample is treated as garbage
static const uint8_t  SPO2_LOCK_N   = 5;
static const uint8_t  SPO2_LOW_FLAG = 90;      // publish "spo2_low":true below this
static const uint32_t SETTLE_MS     = 3000;    // ignore SpO2 while finger pressure settles
static const float    SPO2_A        = 110.0f;  // SpO2 = A - B * R  (uncalibrated)
static const float    SPO2_B        = 25.0f;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
MAX30105 sensor;
bool isMAX30100  = false;
bool oledReady   = false;
bool sensorReady = false;

uint8_t ledCurrent = LED_START;

uint32_t totalSamples = 0;
uint32_t lastBeatMs = 0;

// HR
uint16_t ibi[IBI_SIZE] = {0};
uint8_t  ibiIdx     = 0;
uint8_t  ibiCount   = 0;
uint16_t beatCount  = 0;
int      beatAvg    = 0;
uint8_t  rejectStreak = 0;
int      pubHr      = 0;      // slew-limited HR

// SpO2 / signal accumulators (reset every report interval)
uint64_t redAccum = 0, irAccum = 0;
uint32_t sampleAccum = 0;
uint32_t irMin = 0xFFFFFFFF, irMax = 0, redMin = 0xFFFFFFFF, redMax = 0;
uint32_t irMean = 0, redMean = 0;
uint8_t  spo2Hist[SPO2_MED_SIZE] = {0};
uint8_t  spo2HistIdx = 0;
uint8_t  spo2HistCount = 0;

uint32_t fingerSinceMs = 0;
uint32_t lastReportMs  = 0;
uint32_t lastMqttRetryMs = 0;
float    lastTempC = 36.5f;   // placeholder: no body-temperature sensor fitted

int      lastShownHr   = 0;
int      lastShownSpo2 = 0;

// Shared between sensor loop (core 1) and network task (core 0)
struct Reading {
  int      hr;
  float    spo2;
  float    piPct;
  bool     spo2Low;
  uint32_t ms;
};
QueueHandle_t readingQueue = nullptr;
volatile bool netWifiUp = false;
volatile bool netMqttUp = false;

// ---------------------------------------------------------------------------
// Time (NTP) - needed for certificate validation and for epoch timestamps
// ---------------------------------------------------------------------------
bool timeSynced() {
  return time(nullptr) > 1700000000;
}

// ---------------------------------------------------------------------------
// WiFi & Secure MQTT (TLS 8883) - runs in networkTask on core 0
// ---------------------------------------------------------------------------
void setupWifi() {
  Serial.printf("\n[WiFi] Connecting to '%s' ...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.disconnect();
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.printf("\n[WiFi] Could not connect to '%s' (status=%d).\n", WIFI_SSID, (int)WiFi.status());
    Serial.println("[WiFi Scanner] Scanning for visible 2.4 GHz networks...");
    int n = WiFi.scanNetworks();
    if (n <= 0) {
      Serial.println("[WiFi Scanner] No 2.4 GHz networks found nearby.");
    } else {
      Serial.printf("[WiFi Scanner] Found %d visible 2.4 GHz networks:\n", n);
      bool foundTarget = false;
      for (int i = 0; i < n; ++i) {
        Serial.printf("   - %s (%d dBm)\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
        if (WiFi.SSID(i) == WIFI_SSID) foundTarget = true;
      }
      if (!foundTarget) {
        Serial.printf(">>> [!] '%s' NOT FOUND in 2.4 GHz scan!\n", WIFI_SSID);
        Serial.println(">>> If using a phone hotspot, switch to 2.4GHz ('Maximize Compatibility' on iPhone)!");
      } else {
        Serial.printf(">>> '%s' was found! Check the password or that security is WPA2-Personal.\n", WIFI_SSID);
      }
    }
  }
}

void maintainNetwork() {
  netWifiUp = (WiFi.status() == WL_CONNECTED);

  if (!netWifiUp) {
    netMqttUp = false;
    static uint32_t lastWifiRetryMs = 0;
    if (millis() - lastWifiRetryMs > 12000) {
      lastWifiRetryMs = millis();
      Serial.printf("[WiFi] Re-trying connection to '%s'...\n", WIFI_SSID);
      WiFi.disconnect();
      delay(50);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    return;
  }

  if (mqttClient.connected()) {
    mqttClient.loop();
    netMqttUp = mqttClient.connected();
    return;
  }
  netMqttUp = false;

#ifdef HIVEMQ_ROOT_CA
  // Certificate validity checks need a correct clock.
  if (!timeSynced()) {
    static uint32_t lastNtpMsg = 0;
    if (millis() - lastNtpMsg > 5000) {
      lastNtpMsg = millis();
      Serial.println("[NTP] Waiting for time sync before TLS connect...");
    }
    return;
  }
#endif

  if (millis() - lastMqttRetryMs < 4000) return;
  lastMqttRetryMs = millis();

  Serial.print("[MQTT TLS] Connecting to HiveMQ Cloud...");
  if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println(" Connected securely!");
    netMqttUp = true;
  } else {
    Serial.printf(" Failed (rc=%d), will retry\n", mqttClient.state());
  }
}

int readBatteryPercent(bool &valid) {
#if BATTERY_MONITOR_ENABLED
  int mv = (int)analogReadMilliVolts(BATTERY_ADC_PIN) * 2;   // 2:1 divider
  int pct = (mv - 3300) * 100 / (4200 - 3300);
  valid = true;
  return constrain(pct, 0, 100);
#else
  valid = false;
  return 100;   // placeholder
#endif
}

void publishReading(const Reading &r) {
  if (!mqttClient.connected()) {
    static uint32_t lastWarnMs = 0;
    if (millis() - lastWarnMs > 3000) {
      lastWarnMs = millis();
      Serial.printf("[Telemetry pending] MQTT not connected (WiFi: %s)\n",
                    WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE");
    }
    return;
  }

  bool battValid = false;
  int  batt = readBatteryPercent(battValid);
  time_t now = time(nullptr);
  unsigned long epoch = (now > 1700000000) ? (unsigned long)now : 0UL;

  // "timestamp" stays as device uptime (ms) for compatibility with the frontend;
  // "epoch" is real UTC seconds (0 until NTP syncs).
  char payload[320];
  snprintf(payload, sizeof(payload),
           "{\"heart_rate\":%d,\"spo2\":%.1f,\"spo2_low\":%s,"
           "\"temperature\":%.1f,\"temp_valid\":false,"
           "\"battery\":%d,\"battery_valid\":%s,"
           "\"signal_quality\":%.2f,\"timestamp\":%lu,\"epoch\":%lu}",
           r.hr, r.spo2, r.spo2Low ? "true" : "false",
           lastTempC,
           batt, battValid ? "true" : "false",
           r.piPct, (unsigned long)r.ms, epoch);

  if (mqttClient.publish(MQTT_TOPIC, payload)) {
    Serial.printf("[HiveMQ Published -> %s] %s\n", MQTT_TOPIC, payload);
  } else {
    Serial.println("[HiveMQ Publish Failed] Packet buffer dropped");
  }
}

void networkTask(void *) {
  setupWifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  for (;;) {
    maintainNetwork();
    Reading r;
    if (xQueueReceive(readingQueue, &r, pdMS_TO_TICKS(20)) == pdTRUE) {
      publishReading(r);
    }
  }
}

// ---------------------------------------------------------------------------
// OLED Display (loop task only - the sensor shares this I2C bus)
// ---------------------------------------------------------------------------
void setupDisplay() {
#if !OLED_ENABLED
  Serial.println("[OLED] disabled at compile time");
  return;
#else
  #if OLED_SH1106
  oledReady = display.begin(OLED_ADDR, true);
  #else
  oledReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR, true, false);
  #endif
  if (!oledReady) {
    Serial.printf("[OLED] panel not detected at 0x%02X (running headless)\n", OLED_ADDR);
    return;
  }
  display.setRotation(OLED_ROTATION);
  display.clearDisplay();
  display.setTextColor(OLED_WHITE);
  display.setTextWrap(false);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Cardiac Monitor");
  display.setCursor(0, 16);
  display.println("HiveMQ Cloud SSL");
  display.display();
#endif
}

void updateDisplay(int hr, int spo2Value) {
#if !OLED_ENABLED
  (void)hr; (void)spo2Value;
  return;
#else
  if (!oledReady) return;

  char buf[24];
  display.clearDisplay();
  display.setTextColor(OLED_WHITE);
  display.setTextWrap(false);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Cardiac Monitor");

  // Status: 'H' = HiveMQ connected, 'W' = WiFi only, '.' = offline
  display.setCursor(OLED_WIDTH - 8, 0);
  display.print(netMqttUp ? "H" : (netWifiUp ? "W" : "."));
  display.drawLine(0, 10, OLED_WIDTH - 1, 10, OLED_WHITE);

  display.setTextSize(1);
  display.setCursor(8, 14);
  display.print("HR");
  display.setCursor(72, 14);
  display.print("SpO2");

  display.setTextSize(2);
  display.setCursor(4, 24);
  if (hr > 0) snprintf(buf, sizeof(buf), "%d", hr);
  else        snprintf(buf, sizeof(buf), "--");
  display.print(buf);

  display.setCursor(70, 24);
  if (spo2Value > 0) snprintf(buf, sizeof(buf), "%d", spo2Value);
  else               snprintf(buf, sizeof(buf), "--");
  display.print(buf);

  display.setTextSize(1);
  display.setCursor(8, 46);
  display.print("bpm");
  display.setCursor(78, 46);
  display.print("%");

  display.setCursor(0, 56);
  snprintf(buf, sizeof(buf), "Net:%s", netMqttUp ? "ON" : (netWifiUp ? "WIFI" : "OFF"));
  display.print(buf);

  display.display();
#endif
}

// ---------------------------------------------------------------------------
// Sensor I2C Registers & Auto-range
// ---------------------------------------------------------------------------
uint8_t readReg8(uint8_t reg) {
  Wire.beginTransmission(0x57);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)0x57, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0xFF;
}

void writeReg8(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(0x57);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

void applyLed() {
  if (isMAX30100) {
    writeReg8(0x09, ledCurrent);
  } else {
    sensor.setPulseAmplitudeIR(ledCurrent);
    sensor.setPulseAmplitudeRed(ledCurrent / 3);
  }
}

void autoRangeLed(uint32_t meanIr, bool fingerPresent) {
  if (!isMAX30100) return;

  uint8_t irNibble = ledCurrent & 0x0F;
  uint8_t newNibble = irNibble;

  if (!fingerPresent) {
    newNibble = 0x03;
  } else if (meanIr > IR_CLIP) {
    if (irNibble > 0x02) newNibble = irNibble - 1;
  } else if (meanIr < 12000) {
    if (irNibble < 0x06) newNibble = irNibble + 1;
  }

  if (newNibble != irNibble) {
    ledCurrent = (newNibble << 4) | newNibble;
    applyLed();
    Serial.printf("[Sensor] Auto-range LED adjusted to 0x%02X\n", ledCurrent);
  }
}

bool setupSensor() {
  uint8_t partID = readReg8(0xFF);
  Serial.print("[Sensor] Part ID returned: 0x");
  Serial.println(partID, HEX);

  if (partID == 0x11) {
    isMAX30100 = true;
    Serial.println("[Sensor] Recognized MAX30100! Initializing native driver...");

    writeReg8(0x06, 0x40);          // reset
    delay(100);
    writeReg8(0x02, 0x00);          // clear FIFO pointers
    writeReg8(0x04, 0x00);
    writeReg8(0x07, 0x47);          // 100 Hz, 1600us pulse width, 16-bit
    writeReg8(0x06, 0x03);          // SpO2 mode (Red + IR)

    ledCurrent = LED_START;
    applyLed();

    Wire.beginTransmission(0x57);   // flush leftover FIFO bytes
    Wire.write(0x05);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)0x57, (uint8_t)4);
    while (Wire.available()) Wire.read();

    sensorReady = true;
    return true;
  } else {
    isMAX30100 = false;
    if (!sensor.begin(Wire, I2C_SPEED_STANDARD)) {
      Serial.println("[Sensor] MAX30102 not detected");
      return false;
    }
    Wire.setClock(100000);
    sensor.setup(0x1F, 4, 2, 400, 411, 4096);
    sensorReady = true;
    return true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
uint16_t medianU16(const uint16_t *arr, uint8_t n) {
  if (n == 0) return 0;
  uint16_t tmp[IBI_SIZE];
  for (uint8_t i = 0; i < n; i++) tmp[i] = arr[i];
  for (uint8_t i = 1; i < n; i++) {
    uint16_t key = tmp[i];
    int j = i - 1;
    while (j >= 0 && tmp[j] > key) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = key;
  }
  return tmp[n / 2];
}

uint8_t medianU8(const uint8_t *arr, uint8_t n) {
  if (n == 0) return 0;
  uint8_t tmp[SPO2_MED_SIZE];
  for (uint8_t i = 0; i < n; i++) tmp[i] = arr[i];
  for (uint8_t i = 1; i < n; i++) {
    uint8_t key = tmp[i];
    int j = i - 1;
    while (j >= 0 && tmp[j] > key) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = key;
  }
  return tmp[n / 2];
}

void clearIbi() {
  ibiCount = 0;
  ibiIdx = 0;
  beatCount = 0;
  beatAvg = 0;
  rejectStreak = 0;
}

void resetLock() {
  clearIbi();
  lastBeatMs = 0;
  pubHr = 0;
  spo2HistCount = 0;
  spo2HistIdx = 0;
  fingerSinceMs = 0;
}

// True when (almost) all stored inter-beat intervals agree with their median.
bool rhythmStable() {
  if (ibiCount < 4) return false;
  uint16_t med = medianU16(ibi, ibiCount);
  uint8_t bad = 0;
  for (uint8_t i = 0; i < ibiCount; i++) {
    int d = abs((int)ibi[i] - (int)med);
    if (d * 100 > (int)med * RHYTHM_TOL_PCT) bad++;
  }
  return bad <= 1;
}

// ---------------------------------------------------------------------------
// Beat handling: reject notch/noise beats against the running median.
// Key point: an early (rejected) beat does NOT move lastBeatMs, so the next
// real beat is still timed from the previous real beat.
// ---------------------------------------------------------------------------
void onBeatDetected() {
  uint32_t nowMs = millis();
  uint32_t delta = nowMs - lastBeatMs;

  // First beat after a pause / finger placement: just set the baseline.
  if (lastBeatMs == 0 || delta > IBI_MAX_MS) {
    lastBeatMs = nowMs;
    rejectStreak = 0;
    return;
  }

  if (delta < IBI_MIN_MS) return;   // physically implausible, ignore

  if (ibiCount >= 4) {
    uint16_t med = medianU16(ibi, ibiCount);
    bool tooEarly = delta * 100 < (uint32_t)med * EARLY_PCT;
    bool tooLate  = delta * 100 > (uint32_t)med * LATE_PCT;

    if (tooEarly || tooLate) {
      if (tooLate) lastBeatMs = nowMs;   // a beat was missed: resync, don't record
      if (++rejectStreak >= REJECT_RESET_N) {
        // The rhythm genuinely changed (or the baseline was bad): rebuild it.
        clearIbi();
        lastBeatMs = nowMs;
      }
      return;
    }
  }

  rejectStreak = 0;
  lastBeatMs = nowMs;

  ibi[ibiIdx] = (uint16_t)delta;
  ibiIdx = (ibiIdx + 1) % IBI_SIZE;
  if (ibiCount < IBI_SIZE) ibiCount++;
  if (beatCount < 0xFFFF) beatCount++;

  beatAvg = 60000 / medianU16(ibi, ibiCount);
}

inline void processSample(uint32_t ir, uint32_t red) {
  totalSamples++;

  redAccum += red;
  irAccum  += ir;
  sampleAccum++;

  if (ir < FINGER_IR_MIN) return;

  if (ir < irMin) irMin = ir;
  if (ir > irMax) irMax = ir;
  if (red < redMin) redMin = red;
  if (red > redMax) redMax = red;

  // Maxim's PBA algorithm with FIR filtering
  if (checkForBeat((int32_t)ir)) onBeatDetected();
}

void pumpSensor() {
  if (isMAX30100) {
    uint8_t wrPtr = readReg8(0x02);
    uint8_t rdPtr = readReg8(0x04);

    if (wrPtr == 0xFF || rdPtr == 0xFF) return;

    int numSamples = (wrPtr - rdPtr) & 0x0F;

    if (numSamples == 0) {
      uint8_t ovf = readReg8(0x03);
      if (ovf > 0) {
        // FIFO overflowed: read one sample to clear, reset pointers
        Wire.beginTransmission(0x57);
        Wire.write(0x05);
        Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x57, (uint8_t)4);
        while (Wire.available()) Wire.read();
        writeReg8(0x02, 0x00);
        writeReg8(0x04, 0x00);
      }
      return;
    }

    for (int s = 0; s < numSamples; s++) {
      Wire.beginTransmission(0x57);
      Wire.write(0x05);
      Wire.endTransmission(false);
      Wire.requestFrom((uint8_t)0x57, (uint8_t)4);

      if (Wire.available() >= 4) {
        uint32_t rawIR  = ((uint32_t)Wire.read() << 8) | Wire.read();
        uint32_t rawRed = ((uint32_t)Wire.read() << 8) | Wire.read();
        if (rawIR > 65500 || rawRed > 65500) continue;
        processSample(rawIR, rawRed);
      }
    }
  } else {
    sensor.check();
    while (sensor.available()) {
      uint32_t ir  = sensor.getFIFOIR();
      uint32_t red = sensor.getFIFORed();
      sensor.nextSample();
      processSample(ir, red);
    }
  }
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[boot] Wearable Cardiac Monitor - ESP32 HiveMQ Cloud MQTT");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);

  setupDisplay();

  // TLS configuration
#ifdef HIVEMQ_ROOT_CA
  espClient.setCACert(HIVEMQ_ROOT_CA);
  Serial.println("[TLS] Certificate validation ENABLED");
#else
  espClient.setInsecure();
  Serial.println("[TLS] WARNING: no root CA set in secrets.h - server identity is NOT verified");
#endif
  mqttClient.setServer(MQTT_BROKER_URL, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(5);

  readingQueue = xQueueCreate(1, sizeof(Reading));

  // WiFi + NTP + TLS MQTT on core 0 so blocking connects never stall the sensor
  xTaskCreatePinnedToCore(networkTask, "net", 10240, nullptr, 1, nullptr, 0);

  sensorReady = setupSensor();
  if (!sensorReady) {
    Serial.println("[Sensor] Not detected - retrying in background...");
  }
  updateDisplay(lastShownHr, lastShownSpo2);
}

// ---------------------------------------------------------------------------
void loop() {
  if (!sensorReady) {
    resetLock();
    static uint32_t lastRetryMs = 0;
    if (millis() - lastRetryMs > 3000) {
      lastRetryMs = millis();
      sensorReady = setupSensor();
      if (sensorReady) Serial.println("[Sensor] Sensor came online!");
    }
    updateDisplay(lastShownHr, lastShownSpo2);
    delay(50);
    return;
  }

  pumpSensor();

  if (millis() - lastReportMs < REPORT_INTERVAL_MS) {
    delay(2);
    return;
  }
  lastReportMs = millis();

  irMean  = sampleAccum ? (uint32_t)(irAccum  / sampleAccum) : 0;
  redMean = sampleAccum ? (uint32_t)(redAccum / sampleAccum) : 0;
  const uint32_t irAC  = (irMax  > irMin)  ? irMax  - irMin  : 0;
  const uint32_t redAC = (redMax > redMin) ? redMax - redMin : 0;
  redAccum = irAccum = 0;
  sampleAccum = 0;
  irMin = redMin = 0xFFFFFFFF;
  irMax = redMax = 0;

  const bool fingerPresent = irMean >= FINGER_IR_MIN;
  const bool clipping = (irMean >= IR_CLIP);

  autoRangeLed(irMean, fingerPresent);

  if (!fingerPresent) {
    resetLock();
    static uint32_t lastNoFingerPrint = 0;
    if (millis() - lastNoFingerPrint > 1500) {
      lastNoFingerPrint = millis();
      Serial.printf("[Sensor] Waiting for finger... (ir=%lu, threshold=%lu)\n",
                    (unsigned long)irMean, (unsigned long)FINGER_IR_MIN);
    }
    updateDisplay(0, 0);
    return;
  }

  if (fingerSinceMs == 0) fingerSinceMs = millis();
  const bool settled = (millis() - fingerSinceMs) >= SETTLE_MS;

  // Perfusion index (pulse amplitude relative to DC) as a signal-quality gauge
  const float piPct = irMean ? (100.0f * (float)irAC / (float)irMean) : 0.0f;
  const bool goodSignal = (piPct >= PI_MIN_PCT && piPct <= PI_MAX_PCT);

  // SpO2: only accept samples once the finger has settled and the signal is clean
  if (settled && !clipping && goodSignal && irAC > 5 && redAC > 0 && irMean > 0 && redMean > 0) {
    float ratio = ((float)redAC / (float)redMean) / ((float)irAC / (float)irMean);
    int   spo2Raw = (int)(SPO2_A - SPO2_B * ratio + 0.5f);
    if (spo2Raw > 100) spo2Raw = 100;
    if (spo2Raw >= SPO2_MIN) {
      spo2Hist[spo2HistIdx] = (uint8_t)spo2Raw;
      spo2HistIdx = (spo2HistIdx + 1) % SPO2_MED_SIZE;
      if (spo2HistCount < SPO2_MED_SIZE) spo2HistCount++;
    }
  }

  // No beat for a while -> drop the HR baseline completely
  if (lastBeatMs == 0 || millis() - lastBeatMs > LOCK_TIMEOUT_MS) {
    clearIbi();
    pubHr = 0;
  }

  const bool stable = rhythmStable();
  const bool locked = settled && !clipping && goodSignal &&
                      beatCount >= HR_LOCK_N &&
                      spo2HistCount >= SPO2_LOCK_N &&
                      beatAvg >= HR_MIN_BPM && beatAvg <= HR_MAX_BPM &&
                      stable;

  if (!locked) {
    const char *hint = clipping              ? "  (ADC saturated)"
                     : !settled              ? "  (settling)"
                     : irMean > IR_TARGET_HI ? "  (signal high)"
                     : irMean < IR_TARGET_LO ? "  (signal low)"
                     : !goodSignal           ? "  (poor pulse signal)"
                     : (ibiCount >= 4 && !stable) ? "  (irregular - hold still)"
                                             : "  (hold still)";
    Serial.printf("[Sensor] acquiring  beats=%u spo2N=%u BPM=%d PI=%.2f%% ir=%lu red=%lu led=0x%02X%s\n",
                  beatCount, spo2HistCount, beatAvg, piPct, (unsigned long)irMean,
                  (unsigned long)redMean, ledCurrent, hint);
    updateDisplay(lastShownHr, lastShownSpo2);
    return;
  }

  // Limit how fast the displayed/published HR may move per second
  int hrOut = beatAvg;
  if (pubHr > 0) {
    if (hrOut > pubHr + HR_MAX_STEP)      hrOut = pubHr + HR_MAX_STEP;
    else if (hrOut < pubHr - HR_MAX_STEP) hrOut = pubHr - HR_MAX_STEP;
  }
  pubHr = hrOut;

  const int spo2Out = medianU8(spo2Hist, spo2HistCount);
  lastShownHr   = hrOut;
  lastShownSpo2 = spo2Out;
  updateDisplay(lastShownHr, lastShownSpo2);

  // Hand the reading to the network task (overwrites any unsent one)
  Reading r;
  r.hr      = hrOut;
  r.spo2    = (float)spo2Out;
  r.piPct   = piPct;
  r.spo2Low = spo2Out < SPO2_LOW_FLAG;
  r.ms      = millis();
  xQueueOverwrite(readingQueue, &r);

  Serial.printf(">>> [LOCKED] HR: %d BPM  |  SpO2: %d %%%s  |  PI: %.2f%%\n",
                hrOut, spo2Out, r.spo2Low ? " (LOW)" : "", piPct);
}
