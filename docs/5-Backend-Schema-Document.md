# Backend Schema Document
## CareTrack — IoT Based Elderly Health Monitoring Companion App

Database: **MongoDB** (Atlas free tier). Collections below with field definitions, types, indexes, and relationships. Designed for FastAPI + `motor` (async MongoDB driver) or `pymongo`.

---

## 1. Collection: `users`

Represents caregivers (the only human app-users; the elderly person has no login).

```json
{
  "_id": "ObjectId",
  "full_name": "string",
  "email": "string (unique, indexed)",
  "password_hash": "string",
  "phone": "string (optional)",
  "created_at": "datetime",
  "linked_profile_ids": ["ObjectId (ref: elderly_profiles)"]
}
```

**Indexes:** unique index on `email`.

---

## 2. Collection: `elderly_profiles`

```json
{
  "_id": "ObjectId",
  "name": "string",
  "age": "int",
  "gender": "string (optional)",
  "known_conditions": "string (optional, free text)",
  "emergency_contact_name": "string",
  "emergency_contact_phone": "string",
  "device_id": "string (ref: devices.device_id, nullable until paired)",
  "thresholds": {
    "heart_rate_min": 50,
    "heart_rate_max": 120,
    "spo2_min": 92,
    "inactivity_watch_hours": 4,
    "inactivity_critical_hours": 6,
    "temperature_alerts_enabled": true
  },
  "caregivers": [
    {
      "user_id": "ObjectId (ref: users)",
      "role": "primary | secondary",
      "joined_at": "datetime"
    }
  ],
  "created_by": "ObjectId (ref: users, the creator = first primary caregiver)",
  "created_at": "datetime"
}
```

**Indexes:** index on `device_id`; index on `caregivers.user_id` (to query "all profiles a user has access to").

**Note for AI agent:** `thresholds` defaults shown above should be applied automatically when a profile is created, editable only by `role: primary` caregivers (enforce in API layer, not just UI).

---

## 3. Collection: `devices`

```json
{
  "_id": "ObjectId",
  "device_id": "string (unique, matches firmware-burned ID, e.g. 'CT-0001')",
  "profile_id": "ObjectId (ref: elderly_profiles, nullable until paired)",
  "paired_at": "datetime",
  "last_seen_at": "datetime",
  "status": "online | offline",
  "firmware_version": "string (optional)"
}
```

**Indexes:** unique index on `device_id`.

**Note:** `status` is updated by the backend's MQTT status-topic subscriber — if no heartbeat received for > 90 seconds, a background job flips status to `offline`.

---

## 4. Collection: `readings`

Stores raw sensor data points. This is the highest-volume collection — designed with a TTL index to auto-expire old raw data (per NFR in TRD: 30-day raw retention).

```json
{
  "_id": "ObjectId",
  "device_id": "string",
  "profile_id": "ObjectId",
  "sensor_type": "wearable | room",
  "metric": "heart_rate | spo2 | temperature | motion",
  "value": "number or boolean",
  "unit": "string (e.g. 'bpm', '%', 'celsius', null for boolean motion)",
  "timestamp": "datetime (from device payload, not server receipt time)",
  "received_at": "datetime (server receipt time, for latency debugging)"
}
```

**Indexes:**
- Compound index on `(profile_id, metric, timestamp)` — this is the primary query pattern for History screen (`GET /readings/history?metric=...&range=...`).
- TTL index on `received_at` with `expireAfterSeconds = 2592000` (30 days) — auto-deletes old raw readings.

**Note for AI agent:** Consider a secondary `readings_hourly_agg` collection (min/max/avg per hour) populated by a scheduled job, so long-range (30d) chart queries don't scan raw 10-second-interval data. Optional for v1 demo scale, but mention this as the scaling path in code comments.

---

## 5. Collection: `alerts`

```json
{
  "_id": "ObjectId",
  "profile_id": "ObjectId",
  "device_id": "string",
  "alert_type": "fall_detected | abnormal_heart_rate | low_spo2 | inactivity | temperature_extreme",
  "severity": "watch | critical",
  "triggering_readings": [
    { "metric": "heart_rate", "value": 145, "timestamp": "datetime" }
  ],
  "status": "active | acknowledged | resolved",
  "acknowledged_by": [
    { "user_id": "ObjectId", "responded_at": "datetime" }
  ],
  "resolved_by": "ObjectId (ref: users, nullable)",
  "resolution_note": "string (optional)",
  "created_at": "datetime",
  "resolved_at": "datetime (nullable)"
}
```

**Indexes:** Compound index on `(profile_id, status, created_at)` — supports both the Alerts list screen and "any active alert?" dashboard check.

**Note:** `acknowledged_by` is an array (not a single field) specifically to support the "multiple caregivers can see who else is responding" real-time flow from the App Flow Document.

---

## 6. Collection: `invite_codes`

```json
{
  "_id": "ObjectId",
  "code": "string (unique, 6-8 char alphanumeric)",
  "profile_id": "ObjectId",
  "created_by": "ObjectId (ref: users)",
  "expires_at": "datetime (e.g. created_at + 7 days)",
  "used": "boolean",
  "used_by": "ObjectId (nullable)",
  "created_at": "datetime"
}
```

**Indexes:** unique index on `code`.

---

## 7. Entity Relationship Summary

```
users (1) ----< caregivers array >---- (many) elderly_profiles
elderly_profiles (1) ---- device_id ---- (1) devices
elderly_profiles (1) ----< (many) readings
elderly_profiles (1) ----< (many) alerts
elderly_profiles (1) ----< (many) invite_codes
```

- One elderly profile has exactly one device (v1 simplification).
- One elderly profile can have many caregivers (embedded array on the profile — chosen over a separate join collection since caregiver lists are small and read-heavy, not write-heavy).
- One device produces many readings and can trigger many alerts.

---

## 8. Data Validation Rules (enforce in Pydantic models, not just at DB level)

- `elderly_profiles.thresholds.heart_rate_min` must be < `heart_rate_max`.
- `readings.value` for `metric: spo2` must be between 0–100.
- `alerts.status` transitions must follow `active → acknowledged → resolved` only (no skipping or reversing — enforce in API logic).
- `invite_codes.code` must be regenerated (not reused) if expired; API should reject joins with `used: true` or `expires_at < now`.

---

## 9. Suggested Pydantic Model Files (for AI agent to scaffold)

```
/app/models/
  user.py           # UserCreate, UserOut, UserInDB
  elderly_profile.py # ProfileCreate, ProfileOut, ThresholdsUpdate
  device.py          # DevicePairRequest, DeviceStatus
  reading.py         # ReadingIn (from MQTT), ReadingOut (for API)
  alert.py           # AlertOut, AlertAcknowledge, AlertResolve
  invite.py          # InviteCreate, InviteJoinRequest
```
