from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/patients", tags=["Patients Directory"])

PATIENTS_DATA = [
    {
        "id": "p-001",
        "first_name": "Margaret",
        "last_name": "Thatcher",
        "age": 84,
        "gender": "Female",
        "room_number": "Room 204",
        "condition": "Post-cardiac stent, mobility risk, mild hypertension",
        "status": "STABLE",
        "room_device_id": "room-unit-01",
        "wearable_device_id": "ESP32-CardiacMonitor",
        "vitals": {"hr": 76, "spo2": 98, "temp": 36.6},
        "room_env": {"temp": 23.5, "humidity": 48},
        "assigned_caregiver": "Dr. Sarah Jenkins, RN",
    },
    {
        "id": "p-002",
        "first_name": "Arthur",
        "last_name": "Pendleton",
        "age": 79,
        "gender": "Male",
        "room_number": "Room 108",
        "condition": "Arrhythmia history, pacemaker, type 2 diabetes",
        "status": "ATTENTION",
        "room_device_id": "room-unit-02",
        "wearable_device_id": "ESP32-CardiacMonitor-02",
        "vitals": {"hr": 88, "spo2": 94, "temp": 36.8},
        "room_env": {"temp": 24.1, "humidity": 52},
        "assigned_caregiver": "Dr. Sarah Jenkins, RN",
    },
    {
        "id": "p-003",
        "first_name": "Eleanor",
        "last_name": "Vance",
        "age": 91,
        "gender": "Female",
        "room_number": "Room 312",
        "condition": "Severe osteoporosis, chronic COPD, high fall risk",
        "status": "CRITICAL",
        "room_device_id": "room-unit-03",
        "wearable_device_id": "ESP32-CardiacMonitor-03",
        "vitals": {"hr": 64, "spo2": 91, "temp": 36.4},
        "room_env": {"temp": 22.8, "humidity": 45},
        "assigned_caregiver": "Dr. Sarah Jenkins, RN",
    },
]

@router.get("")
def list_patients():
    return PATIENTS_DATA
