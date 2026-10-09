/*
 * Wearable Cardiac Risk & Fall Detection Monitor - ESP32
 * MAX30100/MAX30102 + Adafruit MPU-6050 + SH1106/SSD1306 OLED + HiveMQ Cloud MQTT
 * Pinout: SDA=GPIO21, SCL=GPIO22, ALERT_LED=GPIO2
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
#define WIFI_SSID       "RUSTECEAN"
#define WIFI_PASSWORD   "1234567890"

#define MQTT_BROKER_URL "592dc9d2e79e40e1bf88e094608c669a.s1.eu.hivemq.cloud"
#define MQTT_PORT       8883
#define MQTT_USERNAME   "room-kit"
#define MQTT_PASSWORD   "Room-Kit@1"

const char* MQTT_CLIENT_ID = "ESP32-CardiacMonitor";
const char* MQTT_TOPIC     = "cardiac/monitor/data";

#define I2C_SDA_PIN     21
#define I2C_SCL_PIN     22
#define ALERT_LED_PIN   2
#define MPU6050_ADDR    0x68
#define OLED_ADDR       0x3C
#define OLED_WIDTH      128
#define OLED_HEIGHT     64

// Clinical & Sensor Constants
static const uint32_t REPORT_INTERVAL_MS = 1000;
static const uint32_t FINGER_IR_MIN      = 6000;
static const uint32_t IR_CLIP            = 52000;
static const uint8_t  LED_START          = 0x77;

// Beat filtering & Dicrotic notch suppression
static const uint8_t  IBI_SIZE           = 8;
static const uint16_t IBI_MIN_MS         = 500;
static const uint16_t IBI_MAX_MS         = 1400;
static const uint8_t  HR_MIN_BPM         = 45;
static const uint8_t  HR_MAX_BPM         = 125;
static const uint8_t  HR_LOCK_N          = 4;
static const uint8_t  EARLY_PCT          = 65;
static const uint8_t  LATE_PCT           = 155;
static const uint8_t  RHYTHM_TOL_PCT     = 22;
static const uint8_t  REJECT_RESET_N     = 5;
static const int      HR_MAX_STEP        = 2;
static const uint32_t LOCK_TIMEOUT_MS    = 4000;

// SpO2 parameters
static const float    PI_MIN_PCT         = 0.15f;
static const float    PI_MAX_PCT         = 8.0f;
static const uint8_t  SPO2_MED_SIZE      = 7;
static const uint8_t  SPO2_MIN           = 75;
static const uint8_t  SPO2_LOCK_N        = 4;
static const uint8_t  SPO2_LOW_FLAG      = 90;
static const uint32_t SETTLE_MS          = 2500;
static const float    SPO2_A             = 112.0f;
static const float    SPO2_B             = 22.0f;

// 3-Phase Fall Detection thresholds
static const float    FALL_FREE_FALL_G      = 0.55f;
static const float    FALL_IMPACT_MIN_G     = 2.70f;
static const float    FALL_HARD_IMPACT_G    = 3.60f;
static const uint32_t FALL_FREE_FALL_WINDOW = 650;
static const uint32_t FALL_REST_TIME_MS     = 1400;
static const uint32_t FALL_ALERT_SCREEN_MS  = 10000;

// ---------------------------------------------------------------------------
// Hardware Objects & Global State
// ---------------------------------------------------------------------------
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
Adafruit_SH1106G display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
Adafruit_MPU6050 mpu;
MAX30105 sensor;

bool mpuReady = false, isMAX30100 = false, oledReady = false, sensorReady = false;
float currentAx = 0, currentAy = 0, currentAz = 1, currentSVM = 1.0f;
bool fallAlertActive = false; // indicates if fall alert is active
bool fallTelemetrySent = false; // ensures fall alert sent only once per event
uint32_t fallAlertStartMs = 0;
float lastFallImpactG = 0.0f;

enum FallStage { FALL_IDLE, FALL_FREE_FALLING, FALL_WAITING_REST };
FallStage fallStage = FALL_IDLE;
uint32_t freeFallStartMs = 0, impactOccurredMs = 0;

uint8_t ledCurrent = LED_START;
uint32_t totalSamples = 0, lastBeatMs = 0;
uint16_t ibi[IBI_SIZE] = {0};
uint8_t ibiIdx = 0, ibiCount = 0, rejectStreak = 0;
uint16_t beatCount = 0;
int beatAvg = 0, pubHr = 0;
float smoothedHr = 0.0f;

uint64_t redAccum = 0, irAccum = 0;
uint32_t sampleAccum = 0;
uint32_t irMin = 0xFFFFFFFF, irMax = 0, redMin = 0xFFFFFFFF, redMax = 0;
uint32_t irMean = 0, redMean = 0;
uint8_t spo2Hist[SPO2_MED_SIZE] = {0}, spo2HistIdx = 0, spo2HistCount = 0;
uint32_t fingerSinceMs = 0, lastReportMs = 0, lastMqttRetryMs = 0;
float lastTempC = 36.5f;
int lastShownHr = 0, lastShownSpo2 = 0;

struct Reading {
  int hr; float spo2; float piPct; bool spo2Low; bool fallDetected; float accelG; uint32_t ms;
};
QueueHandle_t readingQueue = nullptr;
volatile bool netWifiUp = false, netMqttUp = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
template<typename T>
T medianVal(const T *arr, uint8_t n) {
  if (n == 0) return 0;
  T tmp[8];
  for (uint8_t i = 0; i < n && i < 8; i++) tmp[i] = arr[i];
  for (uint8_t i = 1; i < n; i++) {
    T key = tmp[i]; int j = i - 1;
    while (j >= 0 && tmp[j] > key) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = key;
  }
  return tmp[n / 2];
}

void queueTelemetry(int hr, float spo2, float pi, bool low, bool fall, float accel) {
  Reading r = {hr, spo2, pi, low, fall, accel, millis()};
  xQueueOverwrite(readingQueue, &r);
}

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
    writeReg8(0x06, 0x03);
    writeReg8(0x09, ledCurrent);
  } else {
    sensor.setPulseAmplitudeIR(ledCurrent);
    sensor.setPulseAmplitudeRed(ledCurrent);
  }
}

void autoRangeLed(uint32_t meanIr, bool fingerPresent) {
  if (!isMAX30100) return;
  uint8_t nib = ledCurrent & 0x0F;
  uint8_t prev = nib;
  if (!fingerPresent) nib = 0x05;
  else if (meanIr > IR_CLIP && nib > 0x03) nib--;
  else if (meanIr < 12000 && nib < 0x07) nib++;
  if (nib != prev) {
    ledCurrent = (nib << 4) | nib;
    applyLed();
    Serial.printf("[Sensor] Auto-range LED: 0x%02X\n", ledCurrent);
  }
}

// ---------------------------------------------------------------------------
// Network & MQTT Telemetry (Runs on FreeRTOS Core 0)
// ---------------------------------------------------------------------------
void setupWifi() {
  Serial.printf("\n[WiFi] Connecting to '%s' ...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.disconnect();
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.printf("\n[WiFi] Could not connect to '%s'\n", WIFI_SSID);
  }
}

void maintainNetwork() {
  netWifiUp = (WiFi.status() == WL_CONNECTED);
  if (!netWifiUp) {
    netMqttUp = false;
    static uint32_t lastRetry = 0;
    if (millis() - lastRetry > 12000) {
      lastRetry = millis();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    return;
  }
  if (mqttClient.connected()) {
    mqttClient.loop();
    netMqttUp = true;
    return;
  }
  netMqttUp = false;
  if (millis() - lastMqttRetryMs < 4000) return;
  lastMqttRetryMs = millis();
  Serial.print("[MQTT TLS] Connecting to HiveMQ Cloud...");
  if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println(" Connected securely!");
    netMqttUp = true;
  } else {
    Serial.printf(" Failed (rc=%d)\n", mqttClient.state());
  }
}

void publishReading(const Reading &r) {
  if (!mqttClient.connected()) return;
  time_t now = time(nullptr);
  unsigned long epoch = (now > 1700000000) ? (unsigned long)now : 0UL;

  char payload[384];
  snprintf(payload, sizeof(payload),
           "{\"heart_rate\":%d,\"spo2\":%.1f,\"spo2_low\":%s,"
           "\"temperature\":%.1f,\"temp_valid\":false,"
           "\"battery\":100,\"battery_valid\":false,"
           "\"signal_quality\":%.2f,\"fall_detected\":%s,"
           "\"accel_magnitude\":%.2f,\"timestamp\":%lu,\"epoch\":%lu}",
           r.hr, r.spo2, r.spo2Low ? "true" : "false",
           lastTempC, r.piPct, r.fallDetected ? "true" : "false",
           r.accelG, (unsigned long)r.ms, epoch);

  if (mqttClient.publish(MQTT_TOPIC, payload)) {
    Serial.printf("[HiveMQ Published -> %s] %s\n", MQTT_TOPIC, payload);
  }

  // Emergency Dual Publish for Fall Alert
  if (r.fallDetected) {
    char fallPayload[256];
    snprintf(fallPayload, sizeof(fallPayload),
             "{\"device_id\":\"room-unit-01\",\"sensor\":\"wearable\","
             "\"timestamp\":%lu,\"data\":{\"fall_detected\":true,\"accel_magnitude\":%.2f}}",
             epoch ? epoch : (unsigned long)millis(), r.accelG);
    mqttClient.publish("caretrack/room-unit-01/wearable/motion", fallPayload);
    Serial.printf("🚨 [EMERGENCY FALL DISPATCH] %s\n", fallPayload);
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
// OLED Display
// ---------------------------------------------------------------------------
void setupDisplay() {
  oledReady = display.begin(OLED_ADDR, true);
  if (!oledReady) return;
  display.setRotation(2);
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Cardiac Monitor\nHiveMQ Cloud SSL");
  display.display();
}

void updateDisplay(int hr, int spo2Value) {
  if (!oledReady) return;
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  if (fallAlertActive) {
    if (millis() - fallAlertStartMs > FALL_ALERT_SCREEN_MS) {
      fallAlertActive = false;
    } else {
      display.setTextSize(1);
      display.setCursor(4, 2);
      display.print("! EMERGENCY ALERT !");
      display.drawLine(0, 11, 127, 11, SH110X_WHITE);
      display.setTextSize(2);
      display.setCursor(6, 16);
      display.print("FALL DETECT");
      display.setTextSize(1);
      display.setCursor(4, 38);
      display.printf("Shock: %.1f g", lastFallImpactG);
      display.setCursor(4, 52);
      display.print("HELP REQUESTED ->");
      display.display();
      return;
    }
  }

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Cardiac Monitor");
  display.setCursor(120, 0);
  display.print(netMqttUp ? "H" : (netWifiUp ? "W" : "."));
  display.drawLine(0, 10, 127, 10, SH110X_WHITE);

  display.setCursor(8, 14);  display.print("HR");
  display.setCursor(72, 14); display.print("SpO2");

  int showHr = (hr > 0) ? hr : lastShownHr;
  int showSpo2 = (spo2Value > 0) ? spo2Value : lastShownSpo2;

  display.setTextSize(2);
  display.setCursor(4, 24);
  if (showHr > 0) display.printf("%d", showHr); else display.print("--");
  display.setCursor(70, 24);
  if (showSpo2 > 0) display.printf("%d", showSpo2); else display.print("--");

  display.setTextSize(1);
  display.setCursor(8, 46);  display.print("bpm");
  display.setCursor(78, 46); display.print("%");

  display.setCursor(0, 56);
  const char *mode = (hr > 0 && fingerSinceMs > 0) ? "LIVE" : "HOLD";
  if (mpuReady) display.printf("[%s] M:%.1fg OK", mode, currentSVM);
  else          display.printf("[%s] MPU:DISC", mode);
  display.display();
}

// ---------------------------------------------------------------------------
// Hardware Diagnostics & Init
// ---------------------------------------------------------------------------
void scanI2CBus() {
  Serial.println("\n--- [I2C Bus Scan] ---");
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      if (addr == 0x3C) Serial.println("  [OK] 0x3C : OLED Display");
      else if (addr == 0x68) Serial.println("  [OK] 0x68 : MPU-6050 Motion Sensor");
      else if (addr == 0x57) Serial.println("  [OK] 0x57 : MAX30100 Pulse Sensor");
      else Serial.printf("  [OK] 0x%02X : I2C Device\n", addr);
    }
  }
}

bool setupSensor() {
  Wire.beginTransmission(0x57);
  if (Wire.endTransmission() != 0) return false;
  uint8_t partID = readReg8(0xFF);
  Serial.printf("[Sensor] Part ID: 0x%02X\n", partID);

  if (partID == 0x11) {
    isMAX30100 = true;
    writeReg8(0x06, 0x40); delay(100);
    writeReg8(0x02, 0x00); writeReg8(0x04, 0x00);
    writeReg8(0x07, 0x47); writeReg8(0x06, 0x03);
    ledCurrent = LED_START;
    applyLed();
    Wire.beginTransmission(0x57); Wire.write(0x05); Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)0x57, (uint8_t)4);
    while (Wire.available()) Wire.read();
    sensorReady = true;
    return true;
  } else {
    isMAX30100 = false;
    if (!sensor.begin(Wire, I2C_SPEED_STANDARD)) return false;
    Wire.setClock(100000);
    sensor.setup(0x1F, 4, 2, 400, 411, 4096);
    sensorReady = true;
    return true;
  }
}

bool setupMPU6050() {
  if (!mpu.begin(MPU6050_ADDR, &Wire) && !mpu.begin(0x69, &Wire)) {
    Serial.println("[Adafruit_MPU6050] Not detected!");
    mpuReady = false;
    return false;
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  mpuReady = true;
  Serial.println("[Adafruit_MPU6050] Initialized & Active!");
  return true;
}

// ---------------------------------------------------------------------------
// Motion & 3-Phase Fall Detection
// ---------------------------------------------------------------------------
bool readMPU6050(float &ax, float &ay, float &az, float &svm) {
  if (!mpuReady) return false;
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  ax = a.acceleration.x / 9.80665f;
  ay = a.acceleration.y / 9.80665f;
  az = a.acceleration.z / 9.80665f;
  svm = sqrtf(ax * ax + ay * ay + az * az);
  if (temp.temperature > 15.0f && temp.temperature < 60.0f) lastTempC = temp.temperature;
  return true;
}

void triggerFallEmergency(float impactG) {
  fallAlertActive = true;
  fallAlertStartMs = millis();
  fallTelemetrySent = true;
  lastFallImpactG = impactG;
  digitalWrite(ALERT_LED_PIN, HIGH);
  Serial.printf("\n🚨 [CRITICAL ALERT] FALL DETECTED! Impact: %.2f g\n\n", impactG);

  queueTelemetry(lastShownHr > 0 ? lastShownHr : 82,
                 lastShownSpo2 > 0 ? (float)lastShownSpo2 : 95.0f,
                 2.0f, false, true, impactG);
  updateDisplay(lastShownHr, lastShownSpo2);
}

void processFallDetection() {
  if (!mpuReady || fallAlertActive) return;
  float ax = 0, ay = 0, az = 0, svm = 1.0f;
  if (!readMPU6050(ax, ay, az, svm)) return;
  currentAx = ax; currentAy = ay; currentAz = az; currentSVM = svm;
  uint32_t now = millis();

  switch (fallStage) {
    case FALL_IDLE:
      if (svm < FALL_FREE_FALL_G) {
        freeFallStartMs = now;
        fallStage = FALL_FREE_FALLING;
      } else if (svm > FALL_HARD_IMPACT_G) {
        impactOccurredMs = now;
        lastFallImpactG = svm;
        fallStage = FALL_WAITING_REST;
      }
      break;
    case FALL_FREE_FALLING:
      if (svm > FALL_IMPACT_MIN_G) {
        impactOccurredMs = now;
        lastFallImpactG = svm;
        fallStage = FALL_WAITING_REST;
      } else if (now - freeFallStartMs > FALL_FREE_FALL_WINDOW) {
        fallStage = FALL_IDLE;
      }
      break;
    case FALL_WAITING_REST:
      if (svm > 2.2f) {
        fallStage = FALL_IDLE;
      } else if (now - impactOccurredMs >= FALL_REST_TIME_MS) {
        fallStage = FALL_IDLE;
        triggerFallEmergency(lastFallImpactG);
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Heart Rate & SpO2 Processing
// ---------------------------------------------------------------------------
void clearIbi() {
  ibiCount = ibiIdx = beatCount = beatAvg = rejectStreak = 0;
}

void resetLock() {
  clearIbi();
  lastBeatMs = 0;
  pubHr = 0;
  smoothedHr = 0.0f;
  spo2HistCount = spo2HistIdx = fingerSinceMs = 0;
}

bool rhythmStable() {
  if (ibiCount < 4) return false;
  uint16_t med = medianVal(ibi, ibiCount);
  uint8_t bad = 0;
  for (uint8_t i = 0; i < ibiCount; i++) {
    if (abs((int)ibi[i] - (int)med) * 100 > (int)med * RHYTHM_TOL_PCT) bad++;
  }
  return bad <= 1;
}

void onBeatDetected() {
  uint32_t nowMs = millis();
  uint32_t delta = nowMs - lastBeatMs;
  if (lastBeatMs == 0 || delta > IBI_MAX_MS) {
    lastBeatMs = nowMs;
    rejectStreak = 0;
    return;
  }
  uint32_t minBlanking = IBI_MIN_MS;
  if (ibiCount >= 2) {
    uint16_t med = medianVal(ibi, ibiCount);
    uint32_t adaptiveFloor = (med * 58) / 100;
    if (adaptiveFloor > minBlanking) minBlanking = adaptiveFloor;
  }
  if (delta < minBlanking) return;

  if (ibiCount >= 4) {
    uint16_t med = medianVal(ibi, ibiCount);
    bool tooEarly = delta * 100 < (uint32_t)med * EARLY_PCT;
    bool tooLate  = delta * 100 > (uint32_t)med * LATE_PCT;
    if (tooEarly || tooLate) {
      if (tooLate) lastBeatMs = nowMs;
      if (++rejectStreak >= REJECT_RESET_N) {
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
  beatAvg = 60000 / medianVal(ibi, ibiCount);
}

inline void processSample(uint32_t ir, uint32_t red) {
  totalSamples++;
  redAccum += red; irAccum += ir; sampleAccum++;
  if (ir < FINGER_IR_MIN) return;
  if (ir < irMin) irMin = ir;
  if (ir > irMax) irMax = ir;
  if (red < redMin) redMin = red;
  if (red > redMax) redMax = red;
  if (checkForBeat((int32_t)ir)) onBeatDetected();
}

void pumpSensor() {
  if (isMAX30100) {
    uint8_t wrPtr = readReg8(0x02);
    uint8_t rdPtr = readReg8(0x04);
    if (wrPtr == 0xFF || rdPtr == 0xFF) return;
    int numSamples = (wrPtr - rdPtr) & 0x0F;
    if (numSamples == 0) {
      if (readReg8(0x03) > 0) {
        Wire.beginTransmission(0x57); Wire.write(0x05); Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x57, (uint8_t)4);
        while (Wire.available()) Wire.read();
        writeReg8(0x02, 0); writeReg8(0x04, 0);
      }
      return;
    }
    for (int s = 0; s < numSamples; s++) {
      Wire.beginTransmission(0x57); Wire.write(0x05); Wire.endTransmission(false);
      Wire.requestFrom((uint8_t)0x57, (uint8_t)4);
      if (Wire.available() >= 4) {
        uint32_t rawIR  = ((uint32_t)Wire.read() << 8) | Wire.read();
        uint32_t rawRed = ((uint32_t)Wire.read() << 8) | Wire.read();
        if (rawIR <= 65500 && rawRed <= 65500) processSample(rawIR, rawRed);
      }
    }
  } else {
    sensor.check();
    while (sensor.available()) {
      uint32_t ir = sensor.getFIFOIR(), red = sensor.getFIFORed();
      sensor.nextSample();
      processSample(ir, red);
    }
  }
}

// ---------------------------------------------------------------------------
// Arduino Setup & Main Loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[boot] Cardiac & Fall Monitor - ESP32 HiveMQ Cloud");
  pinMode(ALERT_LED_PIN, OUTPUT);
  digitalWrite(ALERT_LED_PIN, LOW);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);
  setupDisplay();
  scanI2CBus();

  espClient.setInsecure();
  mqttClient.setServer(MQTT_BROKER_URL, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(30);

  readingQueue = xQueueCreate(1, sizeof(Reading));
  xTaskCreatePinnedToCore(networkTask, "net", 10240, nullptr, 1, nullptr, 0);

  sensorReady = setupSensor();
  setupMPU6050();
  updateDisplay(lastShownHr, lastShownSpo2);
}

void loop() {
  // Serial Diagnostics & Fall Simulation
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'f' || c == 'F') {
      Serial.println("\n[SIMULATION] Manual Fall Triggered via Serial!");
      triggerFallEmergency(3.85f);
    } else if (c == 'm' || c == 'M') {
      Serial.printf("\n--- MPU Status: %s | SVM: %.2fg | Temp: %.1fC ---\n",
                    mpuReady ? "OK" : "DISCONNECTED", currentSVM, lastTempC);
    }
  }

  // High-Frequency 50Hz Motion Sampling
  static uint32_t lastMpuMs = 0;
  if (millis() - lastMpuMs >= 20) {
    lastMpuMs = millis();
    processFallDetection();
  }

  if (fallAlertActive && millis() - fallAlertStartMs > FALL_ALERT_SCREEN_MS) {
  digitalWrite(ALERT_LED_PIN, LOW);
  fallAlertActive = false; // Reset alert state after display duration
  fallTelemetrySent = false; // Allow future alerts
}

  if (!sensorReady) {
    resetLock();
    static uint32_t lastRetry = 0;
    if (millis() - lastRetry > 3000) {
      lastRetry = millis();
      sensorReady = setupSensor();
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
  redAccum = irAccum = sampleAccum = 0;
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
      Serial.printf("[Sensor] Waiting for finger... (HOLD: HR=%d, SpO2=%d | MPU: %.2fg)\n",
                    lastShownHr, lastShownSpo2, currentSVM);
    }
    updateDisplay(lastShownHr, lastShownSpo2);

    // Continuous 24/7 Motion Telemetry even without finger contact
    // Routine heartbeat sends fall=false; emergency fall was dispatched on trigger
    queueTelemetry(0, 0.0f, 0.0f, false, false, currentSVM);
    return;

  }

  if (fingerSinceMs == 0) fingerSinceMs = millis();
  const bool settled = (millis() - fingerSinceMs) >= SETTLE_MS;
  const float piPct = irMean ? (100.0f * (float)irAC / (float)irMean) : 0.0f;
  const bool goodSignal = (piPct >= PI_MIN_PCT && piPct <= PI_MAX_PCT);

  if (settled && !clipping && goodSignal && irAC > 5) {
    int spo2Raw = 98;
    if (redAC > 0 && redMean > 10) {
      float ratio = ((float)redAC / (float)redMean) / ((float)irAC / (float)irMean);
      spo2Raw = constrain((int)(SPO2_A - SPO2_B * ratio + 0.5f), (int)SPO2_MIN, 99);
    } else {
      spo2Raw = (piPct >= 1.2f) ? 98 : 97;
    }
    spo2Hist[spo2HistIdx] = (uint8_t)spo2Raw;
    spo2HistIdx = (spo2HistIdx + 1) % SPO2_MED_SIZE;
    if (spo2HistCount < SPO2_MED_SIZE) spo2HistCount++;
  }

  if (lastBeatMs == 0 || millis() - lastBeatMs > LOCK_TIMEOUT_MS) {
    clearIbi();
    pubHr = 0;
  }

  const bool stable = rhythmStable();
  const bool locked = settled && !clipping && goodSignal &&
                      beatCount >= HR_LOCK_N && spo2HistCount >= SPO2_LOCK_N &&
                      beatAvg >= HR_MIN_BPM && beatAvg <= HR_MAX_BPM && stable;

  if (!locked) {
    Serial.printf("[Sensor] acquiring beats=%u spo2N=%u BPM=%d PI=%.2f%% ir=%lu red=%lu\n",
                  beatCount, spo2HistCount, beatAvg, piPct, (unsigned long)irMean, (unsigned long)redMean);
    updateDisplay(lastShownHr, lastShownSpo2);
    return;
  }

  // Medical damping: 85% baseline + 15% new sample
  if (smoothedHr <= 0.0f || abs((int)smoothedHr - beatAvg) > 25) {
    smoothedHr = (float)beatAvg;
  } else {
    smoothedHr = smoothedHr * 0.85f + (float)beatAvg * 0.15f;
  }

  int hrOut = (int)(smoothedHr + 0.5f);
  if (pubHr > 0) hrOut = constrain(hrOut, pubHr - HR_MAX_STEP, pubHr + HR_MAX_STEP);
  pubHr = hrOut;

  const int spo2Out = medianVal(spo2Hist, spo2HistCount);
  lastShownHr   = hrOut;
  lastShownSpo2 = spo2Out;
  updateDisplay(lastShownHr, lastShownSpo2);

  queueTelemetry(hrOut, (float)spo2Out, piPct, spo2Out < SPO2_LOW_FLAG, false, currentSVM);
Serial.printf(">>> [LOCKED] HR: %d BPM | SpO2: %d %% | PI: %.2f%%\n", hrOut, spo2Out, piPct);
}
