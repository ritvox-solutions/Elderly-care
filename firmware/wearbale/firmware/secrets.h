#pragma once

#define WIFI_SSID       "Gt"
#define WIFI_PASSWORD   "1234567890"
#define MQTT_BROKER_URL "592dc9d2e79e40e1bf88e094608c669a.s1.eu.hivemq.cloud"
#define MQTT_PORT       8883
#define MQTT_USERNAME   "room-kit"
#define MQTT_PASSWORD   "Room-Kit@1"

// SIM800L GSM SMS Emergency Contact (replace with caregiver phone number, e.g. +91XXXXXXXXXX)
#define EMERGENCY_PHONE_NUMBER "+919901643589"

// Optional Fall Detection Hardware Threshold Overrides (uncomment to customize):
// #define FALL_FREE_FALL_G      0.68f  // Free-fall threshold: SVM < 0.68g (bed slips & soft drops)
// #define FALL_IMPACT_MIN_G     2.00f  // Post-freefall impact: SVM > 2.00g (carpet/cushioned impacts)
// #define FALL_HARD_IMPACT_G    2.60f  // Direct collapse/shock: SVM > 2.60g (trip & slip detection)
// #define FALL_REST_TIME_MS     1000   // Stillness window (ms) to confirm fall


