#pragma once

#define WIFI_SSID       "YOUR_2_4_GHZ_WIFI_NAME"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define MQTT_BROKER_URL "YOUR_HIVEMQ_HOST"
#define MQTT_PORT       8883
#define MQTT_USERNAME   "YOUR_MQTT_USERNAME"
#define MQTT_PASSWORD   "YOUR_MQTT_PASSWORD"
#define TELEMETRY_INGEST_KEY "OPTIONAL_BACKEND_TELEMETRY_KEY"

// SIM800L GSM SMS Emergency Contact (E.164 format with country code, e.g. +919876543210 or +15551234567)
// NOTE: This number can be updated dynamically anytime from the Web Dashboard (Patients -> Edit Patient).
// Updates are automatically pushed via MQTT downlink, synced over HTTP, and saved to ESP32 NVS Flash.
// The value below is used as the initial fallback prior to dashboard synchronization.
#define EMERGENCY_PHONE_NUMBER "+1234567890"

// Optional backend device configuration endpoint (defaults to production CareTrack API)
// #define DEVICE_CONFIG_URL "https://elderly-care-api.vercel.app/api/v1/devices/"

// Optional SIM800L pin overrides (default: RX=GPIO 16, TX=GPIO 17, RST=-1)
// #define SIM800_RX_PIN 16
// #define SIM800_TX_PIN 17
// #define SIM800_BAUD   9600

