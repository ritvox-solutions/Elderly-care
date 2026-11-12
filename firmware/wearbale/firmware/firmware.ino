/*
 * Wearable Cardiac Risk & Fall Detection Monitor - ESP32
 * MAX30100/MAX30102 + Adafruit MPU-6050 + SH1106/SSD1306 OLED + HiveMQ Cloud MQTT + SIM800L GSM SMS
 * Pinout: SDA=GPIO21, SCL=GPIO22, ALERT_LED=GPIO2, SIM800_RX=GPIO16, SIM800_TX=GPIO17
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "secrets.h"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const char* MQTT_CLIENT_ID = "ESP32-CardiacMonitor";
const char* MQTT_TOPIC     = "cardiac/monitor/data";

#ifndef ALERT_INGEST_URL
#define ALERT_INGEST_URL "https://elderly-care-api.vercel.app/api/v1/telemetry/ingest"
#endif
#ifndef DEVICE_CONFIG_URL
#define DEVICE_CONFIG_URL "https://elderly-care-api.vercel.app/api/v1/devices/"
#endif
#ifndef TELEMETRY_INGEST_KEY
#define TELEMETRY_INGEST_KEY ""
#endif

#define I2C_SDA_PIN     21
#define I2C_SCL_PIN     22
#define ALERT_LED_PIN   2
#define MPU6050_ADDR    0x68
#define OLED_ADDR       0x3C
#define OLED_WIDTH      128
#define OLED_HEIGHT     64

// SIM800L GSM SMS Configuration (ESP32 UART2 / Serial2)
#ifndef SIM800_RX_PIN
#define SIM800_RX_PIN   16  // ESP32 RX2 (connects to SIM800L TXD)
#endif
#ifndef SIM800_TX_PIN
#define SIM800_TX_PIN   17  // ESP32 TX2 (connects to SIM800L RXD)
#endif
#ifndef SIM800_RST_PIN
#define SIM800_RST_PIN  -1  // Optional reset pin (-1 if unused)
#endif
#ifndef SIM800_BAUD
#define SIM800_BAUD     9600
#endif
#ifndef EMERGENCY_PHONE_NUMBER
#define EMERGENCY_PHONE_NUMBER "+1234567890"
#endif

#define SIM800_SERIAL   Serial2

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
bool sim800Ready = false, sim800NetRegistered = false, lastSmsSuccess = false;
int  sim800SignalCsq = 0;
uint32_t lastSmsSentMs = 0;
static const uint32_t SMS_COOLDOWN_MS = 30000; // 30s minimum between emergency SMS

// Dynamic Device Configuration (Synchronized from Web Dashboard & Persisted in NVS Flash)
Preferences preferences;
char activeEmergencyPhone[32] = {0};
char assignedPatientName[48]  = "Unassigned";
char assignedRoomNumber[32]   = "N/A";
bool deviceIsPaired           = false;
uint32_t lastConfigSyncMs     = 0;
static const uint32_t CONFIG_SYNC_INTERVAL_MS = 300000; // 5 min periodic sync
float currentAx = 0, currentAy = 0, currentAz = 1, currentSVM = 1.0f;
bool fallAlertActive = false; // indicates if fall alert is active
bool fallTelemetrySent = false; // ensures fall alert sent only once per event
uint32_t fallAlertStartMs = 0;
float lastFallImpactG = 0.0f;
float lastFallHeightM = 0.0f;
uint16_t lastFallDurationMs = 0;
char lastFallCategory[32] = "Normal";
uint32_t freeFallDurationMs = 0;

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
  int hr; float spo2; float piPct; bool spo2Low; bool fallDetected; float accelG; float fallHeightM; uint16_t fallDurationMs; uint32_t ms;
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

void queueTelemetry(int hr, float spo2, float pi, bool low, bool fall, float accel, float fallHeight = 0.0f, uint16_t fallDuration = 0) {
  if (readingQueue == nullptr) return;
  Reading r = {hr, spo2, pi, low, fall, accel, fallHeight, fallDuration, millis()};

  if (fall) {
    // Critical fall emergency: send immediately to front of queue
    xQueueSendToFront(readingQueue, &r, 0);
  } else {
    // If queue holds a pending fall alert, do not drop or crowd it
    Reading pending;
    if (xQueuePeek(readingQueue, &pending, 0) == pdTRUE && pending.fallDetected) {
      return;
    }
    // If queue is full, discard the oldest routine sample to make room
    if (uxQueueSpacesAvailable(readingQueue) == 0) {
      Reading dummy;
      xQueueReceive(readingQueue, &dummy, 0);
    }
    xQueueSend(readingQueue, &r, 0);
  }
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
// Dynamic Device Configuration & NVS Flash Persistence
// ---------------------------------------------------------------------------
bool extractJsonString(const String& json, const char* key, char* outVal, size_t maxLen) {
  String searchKey = String("\"") + key + "\"";
  int keyIdx = json.indexOf(searchKey);
  if (keyIdx == -1) return false;
  int colonIdx = json.indexOf(':', keyIdx + searchKey.length());
  if (colonIdx == -1) return false;

  int valStart = colonIdx + 1;
  while (valStart < (int)json.length() && (json[valStart] == ' ' || json[valStart] == '\t' || json[valStart] == '\r' || json[valStart] == '\n')) {
    valStart++;
  }
  if (valStart >= (int)json.length() || json[valStart] != '\"') return false;

  int firstQuote = valStart;
  int secondQuote = json.indexOf('\"', firstQuote + 1);
  if (secondQuote == -1) return false;

  String val = json.substring(firstQuote + 1, secondQuote);
  val.trim();
  if (val.length() == 0 || val == "null") return false;
  strncpy(outVal, val.c_str(), maxLen - 1);
  outVal[maxLen - 1] = '\0';
  return true;
}

bool extractJsonBool(const String& json, const char* key, bool defaultVal = false) {
  String searchKey = String("\"") + key + "\"";
  int keyIdx = json.indexOf(searchKey);
  if (keyIdx == -1) return defaultVal;
  int colonIdx = json.indexOf(':', keyIdx + searchKey.length());
  if (colonIdx == -1) return defaultVal;
  int commaIdx = json.indexOf(',', colonIdx);
  int braceIdx = json.indexOf('}', colonIdx);
  int endIdx = (commaIdx != -1 && commaIdx < braceIdx) ? commaIdx : braceIdx;
  if (endIdx == -1) endIdx = json.length();
  String val = json.substring(colonIdx + 1, endIdx);
  val.trim();
  if (val.startsWith("true") || val.startsWith("1")) return true;
  if (val.startsWith("false") || val.startsWith("0")) return false;
  return defaultVal;
}

void loadConfigFromNVS() {
  preferences.begin("caretrack", true); // read-only mode
  String phone = preferences.getString("phone", EMERGENCY_PHONE_NUMBER);
  String pName = preferences.getString("patient", "Unassigned");
  String room  = preferences.getString("room", "N/A");
  bool paired  = preferences.getBool("paired", false);
  preferences.end();

  strncpy(activeEmergencyPhone, phone.c_str(), sizeof(activeEmergencyPhone) - 1);
  activeEmergencyPhone[sizeof(activeEmergencyPhone) - 1] = '\0';

  strncpy(assignedPatientName, pName.c_str(), sizeof(assignedPatientName) - 1);
  assignedPatientName[sizeof(assignedPatientName) - 1] = '\0';

  strncpy(assignedRoomNumber, room.c_str(), sizeof(assignedRoomNumber) - 1);
  assignedRoomNumber[sizeof(assignedRoomNumber) - 1] = '\0';

  deviceIsPaired = paired;

  Serial.printf("\n[Config] 📂 Loaded configuration from NVS Flash:\n");
  Serial.printf("         Emergency Phone : %s\n", activeEmergencyPhone);
  Serial.printf("         Patient Name    : %s\n", assignedPatientName);
  Serial.printf("         Room Number     : %s\n", assignedRoomNumber);
  Serial.printf("         Pairing Status  : %s\n", deviceIsPaired ? "PAIRED" : "UNPAIRED");
}

bool saveEmergencyPhoneToNVS(const char* newPhone) {
  if (!newPhone || strlen(newPhone) < 5) return false;
  if (strcmp(activeEmergencyPhone, newPhone) == 0) return true;

  preferences.begin("caretrack", false); // read-write
  size_t bytes = preferences.putString("phone", newPhone);
  preferences.end();

  if (bytes > 0) {
    strncpy(activeEmergencyPhone, newPhone, sizeof(activeEmergencyPhone) - 1);
    activeEmergencyPhone[sizeof(activeEmergencyPhone) - 1] = '\0';
    Serial.printf("[Config] 💾 Stored new Emergency Phone in NVS Flash: %s\n", activeEmergencyPhone);
    return true;
  }
  return false;
}

void savePatientInfoToNVS(const char* pName, const char* room, bool paired) {
  preferences.begin("caretrack", false);
  if (pName && strlen(pName) > 0) {
    preferences.putString("patient", pName);
    strncpy(assignedPatientName, pName, sizeof(assignedPatientName) - 1);
    assignedPatientName[sizeof(assignedPatientName) - 1] = '\0';
  }
  if (room && strlen(room) > 0) {
    preferences.putString("room", room);
    strncpy(assignedRoomNumber, room, sizeof(assignedRoomNumber) - 1);
    assignedRoomNumber[sizeof(assignedRoomNumber) - 1] = '\0';
  }
  preferences.putBool("paired", paired);
  deviceIsPaired = paired;
  preferences.end();
}

bool fetchDeviceConfigHttp() {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(7000);

  String url = String(DEVICE_CONFIG_URL);
  if (!url.endsWith("/")) url += "/";
  url += String(MQTT_CLIENT_ID) + "/config";

  Serial.printf("\n[Config HTTP] Fetching device config from: %s ...\n", url.c_str());
  if (!http.begin(client, url)) {
    Serial.println("[Config HTTP] ❌ Connection failed.");
    return false;
  }

  if (strlen(TELEMETRY_INGEST_KEY) > 0) {
    http.addHeader("X-Telemetry-Key", TELEMETRY_INGEST_KEY);
  }

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    Serial.printf("[Config HTTP] ✅ Received: %s\n", payload.c_str());

    char newPhone[32] = {0};
    if (extractJsonString(payload, "emergency_phone", newPhone, sizeof(newPhone))) {
      if (strlen(newPhone) >= 5 && strcmp(newPhone, activeEmergencyPhone) != 0) {
        Serial.printf("[Config HTTP] 🔄 Updated Emergency Phone: %s -> %s\n",
                      activeEmergencyPhone, newPhone);
        saveEmergencyPhoneToNVS(newPhone);
      } else {
        Serial.printf("[Config HTTP] Emergency Phone is current (%s).\n", activeEmergencyPhone);
      }
    }

    char newPatient[48] = {0};
    char newRoom[32] = {0};
    extractJsonString(payload, "patient_name", newPatient, sizeof(newPatient));
    extractJsonString(payload, "room_number", newRoom, sizeof(newRoom));
    bool paired = extractJsonBool(payload, "paired", false);
    savePatientInfoToNVS(newPatient, newRoom, paired);

    http.end();
    return true;
  } else if (httpCode == 404) {
    Serial.printf("[Config HTTP] ℹ️ Cloud API returned 404 (not yet deployed on cloud; retaining active phone: %s)\n", activeEmergencyPhone);
    http.end();
    return false;
  } else {
    Serial.printf("[Config HTTP] ⚠️ GET returned code %d\n", httpCode);
    http.end();
    return false;
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (length == 0 || length > 1024) return;
  char msg[1025];
  memcpy(msg, payload, length);
  msg[length] = '\0';
  String jsonStr = String(msg);
  Serial.printf("\n[MQTT Config] 📩 Downlink message on '%s': %s\n", topic, msg);

  char newPhone[32] = {0};
  if (extractJsonString(jsonStr, "emergency_phone", newPhone, sizeof(newPhone))) {
    if (strlen(newPhone) >= 5 && strcmp(newPhone, activeEmergencyPhone) != 0) {
      Serial.printf("[Config MQTT] 🔄 Updated Emergency Phone from Dashboard: %s -> %s\n",
                    activeEmergencyPhone, newPhone);
      saveEmergencyPhoneToNVS(newPhone);
    }
  }

  char newPatient[48] = {0};
  char newRoom[32] = {0};
  extractJsonString(jsonStr, "patient_name", newPatient, sizeof(newPatient));
  extractJsonString(jsonStr, "room_number", newRoom, sizeof(newRoom));
  bool paired = extractJsonBool(jsonStr, "paired", deviceIsPaired);
  savePatientInfoToNVS(newPatient, newRoom, paired);
}

void printDeviceConfig() {
  Serial.println("\n--- [CareTrack Wearable Active Configuration] ---");
  Serial.printf(" Device ID        : %s\n", MQTT_CLIENT_ID);
  Serial.printf(" Pairing Status   : %s\n", deviceIsPaired ? "PAIRED" : "UNPAIRED");
  Serial.printf(" Assigned Patient : %s\n", assignedPatientName);
  Serial.printf(" Assigned Room    : %s\n", assignedRoomNumber);
  Serial.printf(" Active SMS Phone : %s\n", strlen(activeEmergencyPhone) ? activeEmergencyPhone : "Unset");
  Serial.printf(" Fallback Phone   : %s\n", EMERGENCY_PHONE_NUMBER);
  Serial.printf(" SIM800L Module   : %s | Signal CSQ: %d/31\n", sim800Ready ? "READY" : "OFFLINE", sim800SignalCsq);
  Serial.println("-------------------------------------------------");
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
  mqttClient.setCallback(onMqttMessage);
  if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println(" Connected securely!");
    netMqttUp = true;
    char cfgTopic[64];
    snprintf(cfgTopic, sizeof(cfgTopic), "caretrack/%s/config", MQTT_CLIENT_ID);
    mqttClient.subscribe(cfgTopic);
    mqttClient.subscribe("cardiac/monitor/config");
    Serial.printf("[MQTT] Subscribed to configuration topic '%s'\n", cfgTopic);
  } else {
    Serial.printf(" Failed (rc=%d)\n", mqttClient.state());
  }
}

bool postFallToBackend(const char* payload) {
  if (WiFi.status() != WL_CONNECTED) return false;
  // If MQTT is connected, real-time alert was already dispatched to HiveMQ Cloud
  if (mqttClient.connected()) return true;

  // Fallback to HTTP Webhook if MQTT is down
  WiFiClientSecure alertClient;
  alertClient.setInsecure();
  HTTPClient http;
  http.setTimeout(2500);
  if (!http.begin(alertClient, ALERT_INGEST_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  if (strlen(TELEMETRY_INGEST_KEY)) http.addHeader("X-Telemetry-Key", TELEMETRY_INGEST_KEY);
  int status = http.POST((uint8_t*)payload, strlen(payload));
  http.end();
  if (status >= 200 && status < 300) {
    Serial.printf("[Backend Alert] Delivered via HTTP fallback (%d)\n", status);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// SIM800L GSM SMS Module Driver
// ---------------------------------------------------------------------------
bool sim800SendCommand(const String& cmd, const char* expected, uint32_t timeoutMs = 2000, String* outResponse = nullptr) {
  while (SIM800_SERIAL.available()) {
    SIM800_SERIAL.read();
  }
  SIM800_SERIAL.println(cmd);

  String response = "";
  uint32_t startMs = millis();
  while (millis() - startMs < timeoutMs) {
    while (SIM800_SERIAL.available()) {
      char c = (char)SIM800_SERIAL.read();
      response += c;
    }
    if (expected != nullptr && response.indexOf(expected) != -1) {
      if (outResponse) *outResponse = response;
      return true;
    }
    delay(10);
  }

  if (outResponse) *outResponse = response;
  return (expected == nullptr);
}

bool setupSIM800() {
  Serial.printf("\n[SIM800] Initializing on UART2 (RX=GPIO%d, TX=GPIO%d) @ %d baud...\n",
                SIM800_RX_PIN, SIM800_TX_PIN, SIM800_BAUD);

  SIM800_SERIAL.begin(SIM800_BAUD, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);

  if (SIM800_RST_PIN != -1) {
    pinMode(SIM800_RST_PIN, OUTPUT);
    digitalWrite(SIM800_RST_PIN, LOW);
    delay(100);
    digitalWrite(SIM800_RST_PIN, HIGH);
    delay(2000);
  }

  // Probe module with AT command (up to 5 attempts to sync autobaud)
  bool responding = false;
  for (uint8_t i = 0; i < 5; i++) {
    if (sim800SendCommand("AT", "OK", 1000)) {
      responding = true;
      break;
    }
    delay(300);
  }

  if (!responding) {
    Serial.println("[SIM800] ⚠️ Module not responding. Continuing (ensure 3.7V-4.2V/2A power & TX/RX connected).");
    sim800Ready = false;
    return false;
  }

  sim800Ready = true;
  sim800SendCommand("ATE0", "OK", 1000);            // Echo off
  sim800SendCommand("AT+CMEE=2", "OK", 1000);        // Verbose error reporting (CMS/CME error messages)
  sim800SendCommand("AT+CMGF=1", "OK", 1000);        // Text mode for SMS
  sim800SendCommand("AT+CSCS=\"GSM\"", "OK", 1000); // Standard GSM character set

  // Check network registration (AT+CREG?)
  String regResp;
  sim800SendCommand("AT+CREG?", "OK", 1500, &regResp);
  if (regResp.indexOf(",1") != -1 || regResp.indexOf(",5") != -1) {
    sim800NetRegistered = true;
  }

  // Check signal quality (AT+CSQ)
  String csqResp;
  sim800SendCommand("AT+CSQ", "OK", 1000, &csqResp);
  int csqIdx = csqResp.indexOf("+CSQ: ");
  if (csqIdx != -1) {
    sim800SignalCsq = csqResp.substring(csqIdx + 6, csqResp.indexOf(",", csqIdx)).toInt();
  }

  Serial.printf("[SIM800] ✅ Ready! Registration: %s | Signal CSQ: %d/31\n",
                sim800NetRegistered ? "OK (Home/Roaming)" : "Searching...", sim800SignalCsq);
  return true;
}

bool sendSMS(const char* phoneNumber, const char* message) {
  if (!phoneNumber || strlen(phoneNumber) < 4) {
    Serial.println("[SIM800] ⚠️ Cannot send SMS: Invalid or empty EMERGENCY_PHONE_NUMBER (check secrets.h).");
    return false;
  }

  // Sanitize phone number (strip whitespace, hyphens, and formatting)
  char cleanPhone[32] = {0};
  int cIdx = 0;
  for (int i = 0; phoneNumber[i] != '\0' && cIdx < 31; i++) {
    char ch = phoneNumber[i];
    if (ch == '+' || (ch >= '0' && ch <= '9')) {
      cleanPhone[cIdx++] = ch;
    }
  }
  cleanPhone[cIdx] = '\0';
  if (strlen(cleanPhone) < 5) {
    Serial.printf("[SIM800] ⚠️ Invalid phone number: '%s'\n", phoneNumber);
    return false;
  }

  if (!sim800Ready) {
    if (!setupSIM800()) {
      Serial.println("[SIM800] ⚠️ Cannot send SMS: SIM800 module offline or not responding.");
      return false;
    }
  }

  uint32_t now = millis();
  if (lastSmsSentMs != 0 && (now - lastSmsSentMs < SMS_COOLDOWN_MS)) {
    Serial.printf("[SIM800] ⏳ SMS suppressed by cooldown (%u s remaining)\n",
                  (unsigned int)((SMS_COOLDOWN_MS - (now - lastSmsSentMs)) / 1000));
    return false;
  }

  Serial.printf("\n[SIM800] 📤 Sending Emergency SMS to: %s\n", cleanPhone);
  Serial.printf("[SIM800] Content: \"%s\"\n", message);

  // Quick check if cellular network registered
  String regResp;
  sim800SendCommand("AT+CREG?", "OK", 1000, &regResp);
  if (regResp.indexOf(",1") == -1 && regResp.indexOf(",5") == -1) {
    Serial.println("[SIM800] ⏳ Cellular network registration is still in progress (Searching...). Wait 5-10s until registered (type 'g' to check), then retry.");
    return false;
  }

  // Ensure SMS text mode
  if (!sim800SendCommand("AT+CMGF=1", "OK", 1500)) {
    Serial.println("[SIM800] ❌ Failed to set SMS text mode.");
    return false;
  }

  // Flush buffer
  while (SIM800_SERIAL.available()) SIM800_SERIAL.read();

  // Send AT+CMGS="<cleanPhone>"
  String cmgsCmd = String("AT+CMGS=\"") + cleanPhone + "\"";
  SIM800_SERIAL.println(cmgsCmd);

  // Wait for '>' prompt
  bool gotPrompt = false;
  uint32_t promptStart = millis();
  while (millis() - promptStart < 3000) {
    if (SIM800_SERIAL.available()) {
      char c = (char)SIM800_SERIAL.read();
      if (c == '>') {
        gotPrompt = true;
        break;
      }
    }
    delay(10);
  }

  if (!gotPrompt) {
    Serial.println("[SIM800] ❌ Did not receive '>' prompt from module.");
    SIM800_SERIAL.write(0x1B); // Send ESC to cancel CMGS
    return false;
  }

  // Send message body and terminate with Ctrl+Z (ASCII 26)
  SIM800_SERIAL.print(message);
  SIM800_SERIAL.write(0x1A);

  // Wait for +CMGS: or OK (network dispatch timeout up to 15 seconds)
  String sendResp = "";
  uint32_t sendStart = millis();
  bool sent = false;
  while (millis() - sendStart < 15000) {
    while (SIM800_SERIAL.available()) {
      char c = (char)SIM800_SERIAL.read();
      sendResp += c;
    }
    if (sendResp.indexOf("+CMGS:") != -1 || sendResp.indexOf("OK") != -1) {
      sent = true;
      break;
    }
    if (sendResp.indexOf("ERROR") != -1) {
      break;
    }
    delay(50);
  }

  if (sent) {
    lastSmsSentMs = millis();
    lastSmsSuccess = true;
    Serial.println("[SIM800] 🎉 Emergency SMS successfully dispatched via GSM cellular network!");
    return true;
  } else {
    lastSmsSuccess = false;
    Serial.printf("[SIM800] ❌ SMS transmission failed or timed out. Response: %s\n", sendResp.c_str());
    return false;
  }
}

void dispatchFallSMS(float impactG, float heightM, const char* category, int hr, int spo2) {
  const char* phone = (strlen(activeEmergencyPhone) >= 5) ? activeEmergencyPhone : EMERGENCY_PHONE_NUMBER;
  if (!phone || strlen(phone) < 4 || strcmp(phone, "+1234567890") == 0) {
    Serial.println("[SIM800] ⚠️ No active Emergency Phone configured on Dashboard or secrets.h; skipping SMS.");
    return;
  }

  char smsBody[160];
  if (deviceIsPaired && strlen(assignedPatientName) > 0 && strcmp(assignedPatientName, "Unassigned") != 0) {
    snprintf(smsBody, sizeof(smsBody),
             "CareTrack ALERT: Fall detected for %s (%s)! Impact: %.1fg. Vitals: %d bpm, %d%% SpO2. Immediate help needed!",
             assignedPatientName, assignedRoomNumber, impactG,
             hr > 0 ? hr : 80, spo2 > 0 ? spo2 : 95);
  } else {
    snprintf(smsBody, sizeof(smsBody),
             "CareTrack ALERT: Fall detected! Impact: %.1fg (~%.2fm, %s). Vitals: HR %d bpm, SpO2 %d%%. Immediate assistance needed!",
             impactG, heightM, (category && strlen(category)) ? category : "Standing",
             hr > 0 ? hr : 80, spo2 > 0 ? spo2 : 95);
  }

  sendSMS(phone, smsBody);
}

void triggerTestSMS() {
  const char* phone = (strlen(activeEmergencyPhone) >= 5) ? activeEmergencyPhone : EMERGENCY_PHONE_NUMBER;
  if (!phone || strlen(phone) < 4) {
    Serial.println("[SIM800] ⚠️ Please set Emergency Contact Phone on Dashboard or secrets.h first!");
    return;
  }
  char smsBody[160];
  snprintf(smsBody, sizeof(smsBody),
           "CareTrack TEST: Wearable SIM800L module online. Target: %s. Patient: %s (%s). CSQ: %d/31.",
           phone, assignedPatientName, assignedRoomNumber, sim800SignalCsq);
  sendSMS(phone, smsBody);
}

void printSIM800Status() {
  Serial.println("\n--- [SIM800L GSM Status] ---");
  if (!sim800Ready) {
    Serial.println("  Status: NOT INITIALIZED / NO RESPONSE");
    Serial.println("  Attempting initialization now...");
    setupSIM800();
    return;
  }
  String resp;
  sim800SendCommand("AT+CSQ", "OK", 1000, &resp);
  Serial.printf("  Signal (CSQ): %s", resp.c_str());
  sim800SendCommand("AT+CREG?", "OK", 1000, &resp);
  Serial.printf("  Registration: %s", resp.c_str());
  sim800SendCommand("AT+COPS?", "OK", 1500, &resp);
  Serial.printf("  Operator: %s", resp.c_str());
  sim800SendCommand("AT+CBC", "OK", 1000, &resp);
  Serial.printf("  Battery (CBC): %s", resp.c_str());
  sim800SendCommand("AT+CCID", "OK", 1000, &resp);
  Serial.printf("  SIM Card ID (ICCID): %s", resp.c_str());
  sim800SendCommand("AT+CNUM", "OK", 1000, &resp);
  Serial.printf("  SIM Stored Number (CNUM): %s", resp.c_str());
  Serial.println("----------------------------\n");
}

void triggerTestCall() {
  const char* phone = (strlen(activeEmergencyPhone) >= 5) ? activeEmergencyPhone : EMERGENCY_PHONE_NUMBER;
  if (!phone || strlen(phone) < 4) {
    Serial.println("[SIM800] ⚠️ Please set Emergency Contact Phone first!");
    return;
  }
  Serial.printf("\n[SIM800] 📞 Calling %s for 15 seconds to reveal SIM number on Caller ID...\n", phone);
  String dialCmd = String("ATD") + phone + ";";
  sim800SendCommand(dialCmd, "OK", 3000);
  for (int i = 15; i > 0; i--) {
    Serial.printf("[SIM800] 📞 Ringing %s... (%d sec remaining - check your phone's screen!)\n", phone, i);
    delay(1000);
  }
  Serial.println("[SIM800] 📴 Hanging up test call...");
  sim800SendCommand("ATH", "OK", 2000);
  Serial.println("[SIM800] Call ended. Check your mobile phone screen or missed call log for the SIM number!\n");
}

void checkSIMNumberUSSD() {
  Serial.println("\n[SIM800] 🔍 Checking SIM card number and identity...");
  String resp;
  sim800SendCommand("AT+CNUM", "OK", 1500, &resp);
  Serial.printf("[SIM800] AT+CNUM Result: %s\n", resp.c_str());
  sim800SendCommand("AT+CCID", "OK", 1500, &resp);
  Serial.printf("[SIM800] SIM ICCID Serial: %s\n", resp.c_str());
  Serial.println("[SIM800] Querying operator USSD (*282# for Airtel, *199# for Vi)...");
  sim800SendCommand("AT+CUSD=1,\"*282#\",15", "OK", 6000, &resp);
  if (resp.length() > 5) Serial.printf("[SIM800] Airtel USSD Response:\n%s\n", resp.c_str());
  sim800SendCommand("AT+CUSD=1,\"*199#\",15", "OK", 6000, &resp);
  if (resp.length() > 5) Serial.printf("[SIM800] Vi USSD Response:\n%s\n", resp.c_str());
}

void publishReading(const Reading &r) {
  time_t now = time(nullptr);
  unsigned long epoch = (now > 1700000000) ? (unsigned long)now : 0UL;

  char payload[384];
  snprintf(payload, sizeof(payload),
           "{\"heart_rate\":%d,\"spo2\":%.1f,\"spo2_low\":%s,"
           "\"temperature\":%.1f,\"device_temperature\":%.1f,\"temp_valid\":%s,"
           "\"battery\":100,\"battery_valid\":false,"
           "\"signal_quality\":%.2f,\"fall_detected\":%s,"
           "\"accel_magnitude\":%.2f,\"timestamp\":%lu,\"epoch\":%lu}",
           r.hr, r.spo2, r.spo2Low ? "true" : "false",
           0.0f, lastTempC, "false",
           r.piPct, r.fallDetected ? "true" : "false",
           r.accelG, (unsigned long)r.ms, epoch);

  if (mqttClient.connected() && mqttClient.publish(MQTT_TOPIC, payload)) {
    Serial.printf("[HiveMQ Published -> %s] %s\n", MQTT_TOPIC, payload);
  }

  // Emergency Dual Publish for Fall Alert
  if (r.fallDetected) {
    char fallPayload[320];
    snprintf(fallPayload, sizeof(fallPayload),
             "{\"topic\":\"caretrack/room-unit-01/wearable/motion\","
             "\"device_id\":\"ESP32-CardiacMonitor\",\"sensor\":\"wearable\","
             "\"timestamp\":%lu,\"data\":{\"fall_detected\":true,\"accel_magnitude\":%.2f}}",
             epoch ? epoch : (unsigned long)millis(), r.accelG);
    // 1. Dispatch SIM800L Emergency SMS FIRST without any delay
    dispatchFallSMS(r.accelG, r.fallHeightM, lastFallCategory,
                    r.hr > 0 ? r.hr : lastShownHr,
                    r.spo2 > 0 ? (int)r.spo2 : lastShownSpo2);

    // 2. Publish real-time MQTT alert
    if (mqttClient.connected()) mqttClient.publish("caretrack/room-unit-01/wearable/motion", fallPayload);
    Serial.printf("🚨 [EMERGENCY FALL DISPATCH] %s\n", fallPayload);

    // 3. Fallback HTTP Webhook to Backend Cloud (only if MQTT is down)
    postFallToBackend(fallPayload);
  }
}

void networkTask(void *) {
  setupSIM800();
  setupWifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
  uint32_t ntpStartedMs = millis();
  while (WiFi.status() == WL_CONNECTED && time(nullptr) <= 1700000000 && millis() - ntpStartedMs < 5000) {
    delay(100);
  }
  Serial.println(time(nullptr) > 1700000000 ? "[Time] NTP synchronized" : "[Time] NTP pending; epoch remains unavailable");

  // Allow LwIP network stack and TCPIP core to settle before initiating HTTPS
  delay(1000);

  // Sync device configuration (emergency phone number & patient info) from backend
  if (WiFi.status() == WL_CONNECTED) {
    fetchDeviceConfigHttp();
    lastConfigSyncMs = millis();
  }

  for (;;) {
    maintainNetwork();

    // Periodic config sync with backend over HTTP (fallback if MQTT broker offline or Vercel serverless)
    if (netWifiUp && millis() - lastConfigSyncMs > CONFIG_SYNC_INTERVAL_MS) {
      lastConfigSyncMs = millis();
      fetchDeviceConfigHttp();
    }

    // Background periodic retry for SIM800 if module was powered after boot
    static uint32_t lastSimCheckMs = 0;
    if (!sim800Ready && millis() - lastSimCheckMs > 20000) {
      lastSimCheckMs = millis();
      setupSIM800();
    }

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
      display.setCursor(4, 34);
      display.printf("Shock: %.1fg  H:~%.2fm", lastFallImpactG, lastFallHeightM);
      display.setCursor(4, 44);
      display.printf("Type: %s", lastFallCategory);
      display.setCursor(4, 54);
      display.print(lastSmsSuccess ? "HELP & SMS SENT!" : "HELP REQUESTED ->");
      display.display();
      return;
    }
  }

  display.setTextSize(1);
  display.setCursor(0, 0);
  if (deviceIsPaired && strlen(assignedRoomNumber) > 0 && strcmp(assignedRoomNumber, "N/A") != 0) {
    display.printf("%.13s", assignedRoomNumber);
  } else {
    display.print("Cardiac Monitor");
  }
  display.setCursor(110, 0);
  display.print(sim800Ready ? "G" : ".");
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

// ---------------------------------------------------------------------------
// Fall Height Kinematic & Biomechanical Estimator
// ---------------------------------------------------------------------------
// Free-fall duration kinematic model: h = 1/2 * g_eff * t^2
// Empirical torso damping factor g_eff = ~8.83 m/s^2 (0.90 * g)
// Fallback biomechanical shock model for sudden collapses without clear free-fall
float calculateFallHeight(uint32_t durationMs, float impactG, const char* &category) {
  float heightM = 0.0f;
  
  if (durationMs >= 90 && durationMs <= FALL_FREE_FALL_WINDOW) {
    float tSec = (float)durationMs / 1000.0f;
    heightM = 0.5f * 8.83f * tSec * tSec;
  } else {
    // Biomechanical impact shock regression
    float gDiff = max(0.0f, impactG - 1.0f);
    heightM = powf(gDiff, 1.35f) * 0.09f;
  }

  // Constrain within realistic physical limits for human falls (0.2m to 2.5m)
  heightM = constrain(heightM, 0.20f, 2.50f);

  if (heightM < 0.50f) {
    category = "Low Level (<0.5m)";
  } else if (heightM < 0.95f) {
    category = "Bed/Chair Ht (0.5-0.9m)";
  } else if (heightM < 1.65f) {
    category = "Standing Ht (1.0-1.6m)";
  } else {
    category = "Elevated (>1.6m)";
  }

  return heightM;
}

void triggerFallEmergency(float impactG, uint32_t durationMs = 0, float heightM = 0.0f, const char* category = "Standing Ht") {
  fallAlertActive = true;
  fallAlertStartMs = millis();
  fallTelemetrySent = true;
  lastFallImpactG = impactG;
  lastFallDurationMs = durationMs;
  lastFallHeightM = heightM;
  strncpy(lastFallCategory, category, sizeof(lastFallCategory) - 1);
  digitalWrite(ALERT_LED_PIN, HIGH);
  Serial.printf("\n🚨 [CRITICAL ALERT] FALL DETECTED! Impact: %.2f g | Duration: %u ms | Est. Height: ~%.2f m (%s)\n\n",
                impactG, durationMs, heightM, category);

  queueTelemetry(lastShownHr > 0 ? lastShownHr : 82,
                 lastShownSpo2 > 0 ? (float)lastShownSpo2 : 95.0f,
                 2.0f, false, true, impactG, heightM, durationMs);
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
        freeFallDurationMs = (impactOccurredMs >= freeFallStartMs) ? (impactOccurredMs - freeFallStartMs) : 0;
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
        const char *cat = "Standing Ht";
        float estHeight = calculateFallHeight(freeFallDurationMs, lastFallImpactG, cat);
        triggerFallEmergency(lastFallImpactG, freeFallDurationMs, estHeight, cat);
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

  // Load persisted dynamic configuration (emergency phone & patient info) from NVS Flash
  loadConfigFromNVS();

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);
  setupDisplay();
  scanI2CBus();

  espClient.setInsecure();
  mqttClient.setServer(MQTT_BROKER_URL, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(30);

  readingQueue = xQueueCreate(4, sizeof(Reading));
  xTaskCreatePinnedToCore(networkTask, "net", 12288, nullptr, 1, nullptr, 0);

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
    } else if (c == 's' || c == 'S') {
      Serial.println("\n[SIM800] Manual Test SMS Triggered via Serial!");
      triggerTestSMS();
    } else if (c == 'g' || c == 'G') {
      printSIM800Status();
    } else if (c == 'c' || c == 'C') {
      printDeviceConfig();
    } else if (c == 'd' || c == 'D') {
      triggerTestCall();
    } else if (c == 'n' || c == 'N') {
      checkSIMNumberUSSD();
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
