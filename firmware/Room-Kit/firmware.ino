/*
  CareTrack Room Unit Firmware - NodeMCU ESP8266
  Sensors: PIR motion sensor (D2) + DHT11 temperature/humidity (D5)

  WIRING:
    - PIR Motion Sensor:
        VCC -> VIN (5V)
        GND -> GND
        OUT -> D2 (GPIO 4)
    - DHT11 Sensor:
        VCC -> VIN (5V) or 3.3V
        GND -> GND
        DATA -> D5 (GPIO 14)
*/

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// --- Pin Configuration ---
#define PIR_PIN  D2   // NodeMCU D2 (GPIO 4)
#define DHT_PIN  D5   // NodeMCU D5 (GPIO 14)
#define DHT_TYPE DHT11

// --- WiFi Credentials ---
#define WIFI_SSID     "RUSTECEAN"
#define WIFI_PASSWORD "1234567890"

// --- HiveMQ Cloud MQTT ---
#define MQTT_BROKER_URL "592dc9d2e79e40e1bf88e094608c669a.s1.eu.hivemq.cloud"
#define MQTT_PORT       8883
#define MQTT_USERNAME   "room-kit"
#define MQTT_PASSWORD   "Room-Kit@1"

#define DEVICE_ID "room-unit-01"

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClientSecure espClient;
PubSubClient client(espClient);

// Timing variables
unsigned long lastEnv = 0;
unsigned long lastHB = 0;
unsigned long lastReconnectAttempt = 0;

// Fastest physical sample rate supported by DHT11 hardware (2 seconds)
const unsigned long DHT_SAMPLE_INTERVAL_MS = 2000; 

int lastPirState = -1;
float lastTemp = -999.0;
float lastHum = -999.0;

// Offline buffering
const int BUF_MAX = 50;
struct Msg { char topic[80]; char payload[256]; };
Msg buf[BUF_MAX];
int bufCount = 0;

String isoTime() {
  time_t t = time(nullptr);
  if (t < 100000) return "1970-01-01T00:00:00Z";
  struct tm *tm = gmtime(&t);
  char s[25];
  sprintf(s, "%04d-%02d-%02dT%02d:%02d:%02dZ",
    tm->tm_year + 1900, tm->tm_mon + 1, tm->tm_mday,
    tm->tm_hour, tm->tm_min, tm->tm_sec);
  return String(s);
}

void addBuf(const String& top, const String& pay) {
  if (bufCount >= BUF_MAX) {
    for (int i = 1; i < BUF_MAX; i++) buf[i - 1] = buf[i];
    bufCount--;
  }
  strncpy(buf[bufCount].topic, top.c_str(), 79);
  strncpy(buf[bufCount].payload, pay.c_str(), 255);
  bufCount++;
}

bool pub(const String& top, const String& pay) {
  bool ok = client.publish(top.c_str(), pay.c_str());
  Serial.printf("[MQTT REALTIME] %s -> %s\n", ok ? "SENT" : "QUEUED", top.c_str());
  if (!ok) addBuf(top, pay);
  return ok;
}

void flushBuf() {
  while (bufCount > 0 && client.connected()) {
    if (client.publish(buf[0].topic, buf[0].payload)) {
      Serial.printf("[BUF] Flushed: %s\n", buf[0].topic);
      for (int i = 1; i < bufCount; i++) buf[i - 1] = buf[i];
      bufCount--;
    } else break;
  }
}

// Non-blocking MQTT reconnection (never freezes the main loop)
bool ensureMQTTConnected() {
  if (client.connected()) return true;

  unsigned long now = millis();
  if (now - lastReconnectAttempt > 1500) {
    lastReconnectAttempt = now;
    Serial.print("Connecting to HiveMQ Cloud...");
    String id = "CT-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    if (client.connect(id.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println(" connected!");
      flushBuf();
      return true;
    } else {
      Serial.printf(" fail (state: %d)\n", client.state());
    }
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==========================================");
  Serial.println("  CareTrack Real-Time Room Unit (ESP8266) ");
  Serial.println("==========================================");

  pinMode(PIR_PIN, INPUT);
  dht.begin();

  // Connect WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    Serial.print(".");
  }
  Serial.println(" connected! IP: " + WiFi.localIP().toString());

  // Setup NTP Time
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  // Setup Secure MQTT Client
  espClient.setInsecure(); // Required for HiveMQ Cloud TLS
  client.setServer(MQTT_BROKER_URL, MQTT_PORT);
  client.setBufferSize(512);

  // Initialize initial PIR state
  lastPirState = digitalRead(PIR_PIN);
  Serial.println("Real-time telemetry ready.");
}

void loop() {
  // Non-blocking WiFi check
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    return;
  }

  // Non-blocking MQTT check & network loop
  if (ensureMQTTConnected()) {
    client.loop();
  }

  unsigned long now = millis();

  // -------------------------------------------------------------------
  // 1. PIR MOTION: INSTANT REAL-TIME DISPATCH (Zero delay)
  // -------------------------------------------------------------------
  int currentPir = digitalRead(PIR_PIN);
  if (currentPir != lastPirState) {
    lastPirState = currentPir;

    String top = "caretrack/" + String(DEVICE_ID) + "/room/motion";
    String pay = "{\"device_id\":\"" + String(DEVICE_ID) + 
                 "\",\"sensor\":\"room\",\"timestamp\":\"" + isoTime() + 
                 "\",\"data\":{\"motion_detected\":" + String(currentPir == HIGH ? "true" : "false") + "}}";

    Serial.printf("[INSTANT PIR] Motion %s -> Publishing now!\n", currentPir == HIGH ? "DETECTED" : "CLEAR");
    pub(top, pay);
  }

  // -------------------------------------------------------------------
  // 2. DHT11 REAL-TIME TELEMETRY (Fastest physical rate: Every 2s)
  // -------------------------------------------------------------------
  if (now - lastEnv >= DHT_SAMPLE_INTERVAL_MS) {
    lastEnv = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (!isnan(h) && !isnan(t)) {
      lastTemp = t;
      lastHum = h;

      String top = "caretrack/" + String(DEVICE_ID) + "/room/environment";
      String pay = "{\"device_id\":\"" + String(DEVICE_ID) + 
                   "\",\"sensor\":\"room\",\"timestamp\":\"" + isoTime() + 
                   "\",\"data\":{\"temperature\":" + String(t, 1) + 
                   ",\"humidity\":" + String(h, 1) + 
                   ",\"motion_detected\":" + String(currentPir == HIGH ? "true" : "false") + "}}";

      Serial.printf("[DHT11 REALTIME] %.1f°C | %.1f%% | Motion: %s\n", t, h, currentPir == HIGH ? "YES" : "NO");
      pub(top, pay);
    }
  }

  // -------------------------------------------------------------------
  // 3. HEARTBEAT STATUS (Every 60 Seconds)
  // -------------------------------------------------------------------
  if (now - lastHB > 60000) {
    lastHB = now;
    String top = "caretrack/" + String(DEVICE_ID) + "/status";
    String pay = "{\"device_id\":\"" + String(DEVICE_ID) + 
                 "\",\"sensor\":\"room\",\"timestamp\":\"" + isoTime() + 
                 "\",\"data\":{\"status\":\"online\",\"rssi\":" + String(WiFi.RSSI()) + "}}";
    pub(top, pay);
  }

  flushBuf();
}
