"""
CareTrack telemetry simulator.

Publishes validated room and wearable payloads to the canonical MQTT topics:
- caretrack/room/environment
- caretrack/room/motion
- caretrack/wearable/vitals
- caretrack/wearable/fall
"""
import json
import os
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

BROKER_URL = os.getenv("MQTT_BROKER_URL", "broker.hivemq.com")
PORT = int(os.getenv("MQTT_PORT", "1883"))
USERNAME = os.getenv("MQTT_USERNAME", "")
PASSWORD = os.getenv("MQTT_PASSWORD", "")
MQTT_USE_TLS = os.getenv("MQTT_USE_TLS", "").lower() in {"1", "true", "yes"}

ROOM_DEVICE_ID = os.getenv("SIM_ROOM_DEVICE_ID", "room-unit-01")
WEARABLE_DEVICE_ID = os.getenv("SIM_WEARABLE_DEVICE_ID", "wearable-01")
SIM_STEPS = int(os.getenv("SIM_STEPS", "0"))

client = mqtt.Client()
if USERNAME:
    client.username_pw_set(USERNAME, PASSWORD)
if MQTT_USE_TLS or PORT in (8883, 8884):
    client.tls_set()


def publish(topic: str, payload: dict):
    client.publish(topic, json.dumps(payload), qos=0)


print(f"[Simulator] Connecting to {BROKER_URL}:{PORT}...")
client.connect(BROKER_URL, PORT, 60)
client.loop_start()
time.sleep(1)
print("[Simulator] Connected. Publishing mock telemetry (Ctrl+C to stop).")

try:
    step = 0
    while True:
        step += 1
        now_iso = datetime.now(timezone.utc).isoformat()

        room_temp = round(22.0 + random.uniform(-1.5, 2.5), 1)
        room_hum = round(50.0 + random.uniform(-5.0, 5.0), 1)
        motion_active = random.random() > 0.65
        heart_rate = int(random.uniform(70, 85))
        spo2 = int(random.uniform(96, 99))
        body_temp = round(36.5 + random.uniform(-0.3, 0.4), 1)
        simulate_fall = step % 25 == 0
        accel_mag = round(random.uniform(3.2, 4.5), 2) if simulate_fall else round(random.uniform(0.95, 1.05), 2)

        publish("caretrack/room/environment", {
            "device_id": ROOM_DEVICE_ID,
            "sensor": "room",
            "timestamp": now_iso,
            "readings": {
                "room_temp": room_temp,
                "humidity": room_hum,
            },
        })

        publish("caretrack/room/motion", {
            "device_id": ROOM_DEVICE_ID,
            "sensor": "room",
            "timestamp": now_iso,
            "readings": {
                "motion": motion_active,
            },
        })

        publish("caretrack/wearable/vitals", {
            "device_id": WEARABLE_DEVICE_ID,
            "sensor": "wearable",
            "timestamp": now_iso,
            "readings": {
                "heart_rate": heart_rate,
                "spo2": spo2,
                "body_temp": body_temp,
                "accel_magnitude": accel_mag,
                "fall_detected": simulate_fall,
            },
        })

        if simulate_fall:
            publish("caretrack/wearable/fall", {
                "device_id": WEARABLE_DEVICE_ID,
                "sensor": "wearable",
                "timestamp": now_iso,
                "readings": {
                    "fall_detected": True,
                    "accel_magnitude": accel_mag,
                },
            })

        print(
            f"[{now_iso}] Room T:{room_temp}C H:{room_hum}% M:{motion_active} | "
            f"Wearable HR:{heart_rate} SpO2:{spo2}% Body:{body_temp}C Fall:{simulate_fall}"
        )
        if SIM_STEPS and step >= SIM_STEPS:
            break
        time.sleep(3)

except KeyboardInterrupt:
    print("\n[Simulator] Stopping...")
finally:
    client.loop_stop()
    client.disconnect()
