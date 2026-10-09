# Product Requirements Document (PRD)
## CareTrack — IoT Based Elderly Health Monitoring Companion App

**Version:** 1.0
**Based on:** "IoT Based Elderly Health Monitoring System" — VTU Project Synopsis, Alva's Institute of Engineering & Technology
**Prepared for:** AI coding agent build (Cursor / Claude / Bolt / Replit / Lovable)

---

## 0. Assumptions Made (read this first)

The synopsis describes the *hardware system* (wearable + room unit + cloud alerts) but not the software app itself. To make this buildable without back-and-forth, the following assumptions are locked in for all 6 documents. Change any of these upfront if wrong — everything downstream depends on them.

| # | Assumption | Rationale |
|---|---|---|
| A1 | "The app" = a mobile app named **CareTrack** used by **caregivers/family members** (not the elderly person) to view vitals, receive alerts, and see history. | Synopsis says alerts go to "caregivers or family members through a mobile app, SMS, or notification." |
| A2 | The elderly person does **not** operate a UI. They only wear the device / stay in the room. | Matches real-world constraint — elderly users often can't manage apps. |
| A3 | Hardware → Cloud path: ESP32 (wearable) + NodeMCU (room unit) → **MQTT broker** → **FastAPI backend** → **MongoDB**. | Matches your existing project architecture notes. |
| A4 | Mobile app built with **React Native (Expo)**. Backend in **FastAPI (Python)**. Database **MongoDB**. Real-time push via **MQTT-to-WebSocket bridge** or Firebase Cloud Messaging (FCM) for alerts. | Matches your standard stack + synopsis's existing architecture. |
| A5 | One elderly person can have **multiple caregivers** (e.g., son, daughter, nurse) linked to one device. | Realistic multi-caregiver household pattern. |
| A6 | This is a **student/demo project**, not a certified medical device. No claim of clinical diagnosis accuracy. | Keeps scope realistic for a VTU final-year project; avoids regulatory overreach. |
| A7 | SMS alerts (mentioned in synopsis) are **out of scope for v1** — push notification + in-app alert only, SMS listed as a stretch goal via Twilio. | Keeps v1 buildable in project timeframe; SMS gateway costs/setup are a distraction from core demo. |
| A8 | Single elderly profile per device for v1 (no multi-tenant elderly-per-caregiver-org complexity). | Matches scope of a monitoring system, not a hospital SaaS. |

If any of A1–A8 is wrong, correct it before generating code — it changes the schema and flows.

---

## 1. Product Overview

**Product name:** CareTrack
**One-line description:** A mobile app that lets family members and caregivers remotely monitor an elderly person's vital signs, detect falls, and receive instant emergency alerts — fed by a low-cost IoT wearable and room sensor unit.

**Target users:**
- **Primary:** Adult children / family caregivers of elderly parents living alone or semi-independently.
- **Secondary:** Professional caregivers, nurses, or old-age home staff monitoring multiple residents (future scope).

**Core value proposition:** Replaces manual "panic button" style monitoring (which fails if the person is unconscious) with automatic, continuous, multi-parameter monitoring that reduces false alarms and speeds up emergency response.

---

## 2. Problem Statement

Elderly individuals living alone face delayed medical assistance during emergencies (falls, cardiac events, unconsciousness). Existing solutions either:
- Require the person to actively press a button (fails if unconscious), or
- Generate excessive false alarms from single-sensor triggers.

**This app must solve:** Give caregivers real-time visibility into vitals + activity, and only alert them when multiple signals agree something is actually wrong.

---

## 3. Goals & Non-Goals

### Goals (v1)
- Real-time display of heart rate, SpO₂, body temperature, and room activity/motion.
- Automatic fall detection with immediate caregiver alert.
- Multi-parameter verification before triggering "critical" alerts (reduce false positives).
- Historical trend view (last 24h / 7d / 30d) per vital.
- Multi-caregiver notification (all linked caregivers notified simultaneously).
- Simple onboarding: pair device → link elderly profile → invite caregivers.
- Offline-safe device buffering (device retries sending if WiFi drops briefly).

### Non-Goals (explicitly out of scope for v1)
- Clinical/medical-grade diagnosis or FDA/CE-style certification claims.
- Video/audio monitoring (privacy-sensitive, not in synopsis).
- Multi-elderly-person management under one caregiver (one device = one elderly profile for v1).
- SMS gateway integration (stretch goal only).
- Billing/subscriptions (assume free/demo for now).
- Voice assistant / chatbot interface.

---

## 4. User Personas

**Persona 1 — Anjali (Primary Caregiver, daughter, 34)**
Lives in a different city from her mother. Checks the app once a day out of habit, but needs **instant push alerts** if something is wrong. Not tech-illiterate but wants a simple, calm UI — not a hospital dashboard.

**Persona 2 — Ramesh (Secondary Caregiver, son, 40)**
Lives nearby, is the "on the ground" responder. Needs the alert plus a **clear location/context** (e.g., "fall detected in bedroom") so he can act fast.

**Persona 3 — Elderly user (passive, 68+)**
Wears the device and lives in the monitored room. Has **no app interaction**. Success = they don't have to think about the system at all.

---

## 5. Feature List (Prioritized)

### P0 — Must have for demo/MVP
1. Caregiver signup/login (email + password; OTP optional).
2. Device pairing (enter device ID / scan QR printed on device).
3. Elderly profile creation (name, age, known conditions, emergency contacts).
4. Real-time vitals dashboard: heart rate, SpO₂, temperature, motion status.
5. Fall detection alert (push notification + in-app banner + alert log entry).
6. Abnormal vital alert (heart rate/SpO₂/temp out of configurable safe range).
7. Inactivity alert (no motion detected for a configurable threshold, e.g., 4 hours during waking hours).
8. Alert acknowledgment flow (caregiver taps "Responding" / "False Alarm").
9. Historical charts (24h/7d/30d) per vital.
10. Multi-caregiver invite (share access via invite code/link).

### P1 — Should have
11. Configurable alert thresholds per elderly profile.
12. Alert history log with timestamps and resolution notes.
13. Device connectivity status (online/offline/last seen).
14. Basic caregiver roles (primary vs. secondary — primary can edit thresholds).

### P2 — Nice to have / stretch
15. SMS fallback alert via Twilio if push fails.
16. Export health report as PDF (weekly summary).
17. AI-based anomaly prediction (mentioned as future scope in synopsis).
18. ECG monitoring integration (future scope in synopsis).

---

## 6. Key User Stories (with acceptance criteria)

**US-1: Real-time monitoring**
_As a caregiver, I want to see my parent's current vitals at a glance, so I know they're okay right now._
- AC: Dashboard shows heart rate, SpO₂, temperature, and last-motion-detected timestamp, refreshed within 10 seconds of new sensor data.
- AC: Each vital shows a visual status (normal/warning/critical) based on configured thresholds.

**US-2: Fall alert**
_As a caregiver, I want to be notified immediately if my parent falls, so I can respond fast._
- AC: On fall detection event from device, push notification sent to all linked caregivers within 5 seconds.
- AC: Notification includes elderly person's name and "Fall detected" + timestamp.
- AC: Tapping notification opens app directly to the Alert Detail screen.

**US-3: Reduce false alarms**
_As a caregiver, I don't want to be spammed by false alerts, so I still trust the system._
- AC: A "critical" alert is only raised if 2+ independent signals cross thresholds within a defined time window (e.g., fall + no subsequent motion, OR abnormal HR + abnormal SpO₂), OR a single unambiguous signal (fall detected) fires directly. Single borderline vital reading (e.g., HR slightly elevated once) logs as "watch" not "critical."

**US-4: Historical trends**
_As a caregiver, I want to see how vitals have trended, so I can notice gradual decline._
- AC: Line chart for each vital, switchable between 24h/7d/30d.

**US-5: Multi-caregiver access**
_As a primary caregiver, I want to invite my sibling to also monitor, so we share responsibility._
- AC: Primary caregiver can generate an invite code/link; secondary caregiver signs up and enters code to join the same elderly profile.

**US-6: Alert acknowledgment**
_As a caregiver, I want to mark an alert as handled, so others know it's being addressed._
- AC: Any caregiver can tap "I'm on it" on an active alert; this updates status for all caregivers viewing it in real time.

---

## 7. Success Metrics (for demo/evaluation purposes)

- Alert delivery latency < 5 seconds from sensor event to push notification.
- False-positive rate reduced via multi-parameter verification (demonstrable in project viva by comparing single-sensor vs. multi-sensor logic).
- Dashboard data freshness ≤ 10 seconds old at all times when device is online.
- Successful onboarding flow completed in under 5 taps/screens.

---

## 8. Constraints

- Must work with ESP32 (wearable: MAX30102 + MPU6050) and NodeMCU (room: PIR + DHT11) as the only hardware inputs — no other sensors assumed.
- WiFi-dependent; no cellular/LTE fallback in v1.
- Must be buildable by a 4-person student team within a college project timeline — favor simplicity over enterprise robustness.
- Free-tier cloud services preferred (MongoDB Atlas free tier, free MQTT broker like HiveMQ Cloud, Expo push notifications — all free).

---

## 9. Open Question to Confirm

The synopsis frames this as an academic submission (VTU project with guide signature). Confirm: is the goal (a) a working demo good enough for project evaluation/viva, or (b) a genuinely deployable product you intend to keep building post-submission? This affects how much "production hardening" (auth security depth, error handling, tests) the Implementation Plan should include. **Default assumption used below: (a) demo-quality but clean/extensible code**, since that's most likely for a VTU synopsis — flag if you want (b) instead.
