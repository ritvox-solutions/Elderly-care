# Implementation Plan
## CareTrack — IoT Based Elderly Health Monitoring Companion App

This plan sequences the build so that AI coding agents (Cursor/Claude/Bolt/Replit) always have a working, testable increment — never a half-wired system.

---

## Phase 0 — Project Setup (Day 1)

1. Initialize repo structure:
   ```
   /caretrack
     /backend        (FastAPI project)
     /mobile          (Expo project)
     /firmware
       /wearable      (ESP32 Arduino sketch)
       /room-unit     (NodeMCU Arduino sketch)
     /docs            (these 6 documents)
   ```
2. Backend: `fastapi`, `motor` (async Mongo driver), `paho-mqtt` or `gmqtt`, `python-jose` (JWT), `passlib` (password hashing), `pydantic`.
3. Mobile: `npx create-expo-app`, install `@react-navigation/native`, `@tanstack/react-query`, `expo-secure-store`, `expo-notifications`, `expo-camera`, a chart library (`victory-native`).
4. Set up MongoDB Atlas free cluster + HiveMQ Cloud free MQTT broker. Store credentials in `.env` (backend) — never commit secrets.
5. Deploy an empty FastAPI "hello world" to Render/Railway to confirm the deployment pipeline works before building real features on top of it.

**Checkpoint:** Backend responds at a public URL; Expo app runs on a physical phone via Expo Go.

---

## Phase 1 — Auth + Profile + Device Pairing (Days 2–4)

1. Backend: implement `users` collection, signup/login/refresh endpoints, JWT issuance.
2. Backend: implement `elderly_profiles` and `devices` collections + `POST /profiles`, `POST /devices/pair` endpoints.
3. Mobile: build AuthStack (Welcome, Signup, Login) wired to real backend endpoints.
4. Mobile: build Onboarding flow (AddElderlyProfileScreen, PairDeviceScreen with manual device-ID entry first — QR scanning can be added after core flow works).
5. Mobile: implement JWT storage in SecureStore + auto-attach to API requests + auto-redirect to Login on 401.

**Checkpoint:** A user can sign up, create an elderly profile, and "pair" a fake/manually-entered device ID successfully end to end.

---

## Phase 2 — Firmware + MQTT Ingestion (Days 5–8)

*Can run in parallel with Phase 1 if team splits into hardware/software pairs.*

1. Wearable firmware (ESP32): read MAX30102 (heart rate + SpO₂) and MPU6050 (accelerometer), apply moving-average smoothing, detect fall via acceleration-magnitude threshold, publish to MQTT topics per the TRD's Data Contract every 5–10 seconds (vitals) and immediately on fall detection.
2. Room unit firmware (NodeMCU): read PIR (motion) and DHT11 (temp/humidity), publish per TRD's Data Contract.
3. Backend: MQTT subscriber service running as a FastAPI background task (started in `lifespan` context) — subscribes to `caretrack/+/#` wildcard, parses payloads, writes to `readings` collection.
4. Backend: device status tracker — updates `devices.status`/`last_seen_at` on heartbeat topic; background job marks devices `offline` after 90s silence.

**Checkpoint:** Real (or breadboard-simulated) sensor data flows from hardware → MQTT → MongoDB, verifiable by querying the `readings` collection directly.

---

## Phase 3 — Alert Rule Engine + Notifications (Days 9–11)

1. Backend: build `alert_rules.py` implementing all 6 rules from the TRD as pure, independently testable functions.
2. Backend: wire the rule engine into the MQTT ingestion pipeline — every new reading triggers a rule evaluation against recent readings + profile thresholds.
3. Backend: on `CRITICAL` classification, write to `alerts` collection and call the Expo Push Notification API for every linked caregiver's push token.
4. Backend: implement `WS /ws/profiles/{profile_id}` WebSocket endpoint broadcasting new readings and alert state changes to connected clients.
5. Backend: implement `POST /alerts/{id}/acknowledge` and `/resolve`.
6. Write unit tests for the rule engine first — this is the highest-value, most bug-prone logic in the whole system (edge cases: exactly-at-threshold values, rapid oscillation between normal/abnormal, missing data gaps).

**Checkpoint:** Manually publishing a fake `fall_detected: true` MQTT message triggers a push notification to a test phone within 5 seconds.

---

## Phase 4 — Dashboard, Alerts, History Screens (Days 12–16)

1. Mobile: DashboardScreen — vital cards, WebSocket live subscription, REST fallback fetch, alert banner.
2. Mobile: AlertDetailModal — full flow (view → respond → resolve), wired to acknowledge/resolve endpoints, live-updating via WebSocket when other caregivers act.
3. Mobile: AlertsScreen — list view with active/history filter.
4. Mobile: HistoryScreen — metric selector, time-range toggle, chart rendering from `GET /readings/history`.
5. Mobile: push notification handling — `expo-notifications` listener that deep-links a tapped notification directly into AlertDetailModal.

**Checkpoint:** The full critical flow from the App Flow Document (fall → push → tap → respond → resolve, visible to a second caregiver's device in real time) works end to end on two physical test phones.

---

## Phase 5 — Multi-Caregiver + Settings (Days 17–19)

1. Backend: `invite_codes` collection + generate/join endpoints.
2. Mobile: ManageCaregiversScreen, JoinWithCodeScreen, ThresholdSettingsScreen (primary-only edit permission enforced both client- and server-side).
3. Backend: enforce role-based permission checks on threshold updates and caregiver removal.

**Checkpoint:** A second test user can join an existing profile via invite code and see the same live dashboard as the primary caregiver.

---

## Phase 6 — Polish, Edge Cases, Demo Prep (Days 20–23)

1. Apply UI/UX Design Brief styling system-wide (theme tokens, empty states, accessibility pass).
2. Implement offline/error states listed in the App Flow Document (device offline banner, network-loss indicators, invite-code error handling).
3. Add device firmware buffering/retry logic for WiFi dropouts (TRD risk mitigation).
4. Run through the full manual hardware test checklist (below).
5. Prepare a demo script that walks through: onboarding → live vitals → simulated fall → push notification → resolution → history charts → inviting a second caregiver.

---

## Manual Hardware Test Checklist (for viva/demo)

| Test | Steps | Expected Result |
|---|---|---|
| Fall detection | Shake/drop the wearable unit sharply | `CRITICAL` alert + push notification within 5s |
| Low SpO₂ | Remove finger from MAX30102 sensor briefly, then re-place | `WATCH` then possible `CRITICAL` per 2-reading escalation rule; recovers to normal once re-placed and stable |
| Abnormal heart rate | Simulate via test script publishing out-of-range values directly to MQTT (safer/more controlled than trying to induce real tachycardia) | Same escalation behavior as above |
| Room inactivity | Leave room unit's PIR undisturbed for the configured watch window | `WATCH` alert appears at threshold hour mark |
| Device offline | Power off NodeMCU/ESP32 | Dashboard shows "Device Offline" after ~90s, no stale data misrepresented as current |
| Multi-caregiver sync | Two phones logged in as different caregivers on the same profile | Both see the same live data and alert state changes in real time |
| Reconnect buffering | Disconnect device WiFi for 30s, then restore | Buffered readings arrive and backfill correctly, no data loss for that window |

---

## Suggested Build Order Priority (if time runs short)

If the timeline compresses, cut in this order (last cut first, i.e., protect these longest):
1. **Protect always:** Fall detection → alert → notification flow (this is the project's core differentiator per the synopsis's problem statement).
2. **Protect if possible:** Multi-parameter verification (reduces false alarms — a specific stated objective).
3. **Cut first if needed:** Multi-caregiver invite system (demo can work with a single hardcoded caregiver).
4. **Cut second if needed:** History charts (can show raw MongoDB data in viva instead of polished charts).
5. **Cut third if needed:** Threshold customization UI (hardcode sensible defaults, mention configurability as future work).

---

## Handoff Notes for AI Coding Agents

- Build backend and rule engine **before** polishing mobile UI — the alert logic is the graded/demoed core of this project per the synopsis's stated objectives, and it's the hardest part to fix late.
- Use the exact MQTT topic and payload structure from the Technical Requirements Document — don't let the agent invent its own topic naming, or firmware and backend will drift out of sync.
- Keep the alert rule engine in its own file with pure functions and unit tests — this is the part most likely to need tuning after real hardware testing (thresholds will need adjusting based on actual sensor noise).
