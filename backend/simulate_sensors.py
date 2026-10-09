"""
CareTrack Sensor Simulator
Simulates real-time telemetry from both the Wearable Unit (Heart Rate, SpO2, Temperature, Fall Detection)
and the Room Unit (PIR Motion, Ambient Temperature, Humidity) into HiveMQ Cloud.
"""
import os
import time
import json
import random
from datetime import datetime, timezone
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

BROKER_URL = os.getenv("MQTT_BROKER_URL", "592dc9d2e79e40e1bf88e094608c669a.s1.eu.hivemq.cloud")
PORT = int(os.getenv("MQTT_PORT", "8883"))
USERNAME = os.getenv("MQTT_USERNAME", "room-kit")
PASSWORD = os.getenv("MQTT_PASSWORD", "Room-Kit@1")

ROOM_DEVICE_ID = "room-unit-01"
WEARABLE_DEVICE_ID = "ESP32-CardiacMonitor"

client = mqtt.Client()
if USERNAME:
    client.username_pw_set(USERNAME, PASSWORD)
if PORT == 8883:
    client.tls_set()

print(f"[Simulator] Connecting to {BROKER_URL}:{PORT}...")
client.connect(BROKER_URL, PORT, 60)
client.loop_start()
time.sleep(1)
print("[Simulator] Connected! Publishing mock telemetry (Ctrl+C to stop)...")

try:
    step = 0
    while True:
        step += 1
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Room Unit - Environment
        room_temp = round(22.0 + random.uniform(-1.5, 2.5), 1)
        room_hum = round(50.0 + random.uniform(-5.0, 5.0), 1)
        env_payload = {
            "device_id": ROOM_DEVICE_ID,
            "sensor": "room",
            "timestamp": now_iso,
            "data": {
                "temperature": room_temp,
                "humidity": room_hum
            }
        }
        client.publish(f"caretrack/{ROOM_DEVICE_ID}/room/environment", json.dumps(env_payload))

        # 2. Room Unit - Motion (Occasional)
        motion_active = random.random() > 0.65
        motion_payload = {
            "device_id": ROOM_DEVICE_ID,
            "sensor": "room",
            "timestamp": now_iso,
            "data": {
                "motion_detected": motion_active
            }
        }
        client.publish(f"caretrack/{ROOM_DEVICE_ID}/room/motion", json.dumps(motion_payload))

        # 3. Wearable Unit - Cardiac & Vitals
        heart_rate = int(random.uniform(70, 85))
        spo2 = int(random.uniform(96, 99))
        cardio_temp = round(36.5 + random.uniform(-0.3, 0.4), 1)
        
        # Fall detection simulation once every 20 steps
        simulate_fall = (step % 25 == 0)
        accel_mag = round(random.uniform(3.2, 4.5), 2) if simulate_fall else round(random.uniform(0.95, 1.05), 2)

        wearable_payload = {
            "device_id": WEARABLE_DEVICE_ID,
            "sensor": "wearable",
            "timestamp": now_iso,
            "data": {
                "heart_rate": heart_rate,
                "spo2": spo2,
                "temperature": cardio_temp,
                "accel_magnitude": accel_mag,
                "fall_detected": simulate_fall
            }
        }
        client.publish("cardiac/monitor/data", json.dumps(wearable_payload))
        client.publish(f"caretrack/{WEARABLE_DEVICE_ID}/wearable/vitals", json.dumps(wearable_payload))

        print(f"[{now_iso}] Sent Room (T:{room_temp}°C, H:{room_hum}%, M:{motion_active}) | Wearable (HR:{heart_rate}bpm, SpO2:{spo2}%, Fall:{simulate_fall})")
        time.sleep(3)

except KeyboardInterrupt:
    print("\n[Simulator] Stopping...")
finally:
    client.loop_stop()
    client.disconnect()
