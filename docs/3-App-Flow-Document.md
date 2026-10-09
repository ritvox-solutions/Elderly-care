# App Flow Document
## CareTrack — IoT Based Elderly Health Monitoring Companion App

This document maps every screen and the transitions between them, so an AI coding agent can scaffold navigation without guessing structure.

---

## 1. Navigation Structure (React Navigation)

```
RootNavigator (stack)
├── AuthStack (if not logged in)
│   ├── WelcomeScreen
│   ├── SignupScreen
│   ├── LoginScreen
│   └── OTPVerificationScreen (optional, P1)
│
└── MainStack (if logged in)
    ├── OnboardingStack (if no linked profile yet)
    │   ├── AddElderlyProfileScreen
    │   ├── PairDeviceScreen
    │   └── InviteOrJoinChoiceScreen
    │
    └── TabNavigator (if profile linked)
        ├── Tab: DashboardScreen (home)
        ├── Tab: HistoryScreen
        ├── Tab: AlertsScreen
        └── Tab: SettingsScreen
            ├── ProfileDetailsScreen
            ├── ThresholdSettingsScreen
            ├── ManageCaregiversScreen
            └── DeviceStatusScreen

Global overlay (not in tab stack):
    └── AlertDetailModal (triggered from push notification tap or Alerts tab)
```

---

## 2. Screen-by-Screen Flow

### 2.1 Welcome Screen
- **Purpose:** First launch entry point.
- **Elements:** App logo, tagline ("Watch over your loved ones, wherever you are"), "Sign Up" and "Log In" buttons.
- **Transitions:** → SignupScreen or LoginScreen.

### 2.2 Signup Screen
- **Fields:** Full name, email, password, confirm password.
- **Validation:** Email format, password ≥ 8 chars.
- **On submit:** `POST /auth/signup` → on success, auto-login → check if user has any linked profile.
- **Transitions:**
  - No linked profile → OnboardingStack (AddElderlyProfileScreen or InviteOrJoinChoiceScreen)
  - Has linked profile (rare on fresh signup) → TabNavigator

### 2.3 Login Screen
- **Fields:** Email, password.
- **On submit:** `POST /auth/login` → store JWT in SecureStore.
- **Transitions:** Same branching as Signup based on profile-link status.

### 2.4 Invite-or-Join Choice Screen
- **Purpose:** Distinguish "I'm setting up a new elderly profile + device" (primary caregiver) vs. "I have an invite code from a family member" (secondary caregiver).
- **Elements:** Two large buttons: "Set Up New Monitoring" / "Join with Invite Code".
- **Transitions:**
  - Set Up New → AddElderlyProfileScreen
  - Join with Invite Code → JoinWithCodeScreen (enter code) → on success, TabNavigator

### 2.5 Add Elderly Profile Screen
- **Fields:** Elderly person's name, age, gender (optional), known conditions (optional free text), emergency contact name + phone.
- **On submit:** `POST /profiles` → returns `profile_id`.
- **Transitions:** → PairDeviceScreen

### 2.6 Pair Device Screen
- **Elements:** Instructions ("Scan the QR code on your CareTrack device" or "Enter Device ID manually"), camera scanner (Expo Camera / barcode scanner) or text input fallback.
- **On submit:** `POST /devices/pair` with `device_id` + `profile_id`.
- **Success state:** Confirmation animation, "Waiting for first reading..." status, auto-advances once first MQTT reading arrives (poll or WebSocket) or after a "Skip, I'll check later" option (device may take a minute to boot).
- **Transitions:** → TabNavigator (DashboardScreen)

### 2.7 Dashboard Screen (Home Tab)
- **Purpose:** Primary screen — at-a-glance current state.
- **Elements (top to bottom):**
  - Elderly profile name + photo placeholder + device online/offline badge.
  - 4 vital cards in a grid: Heart Rate, SpO₂, Temperature, Room Motion (each with current value, unit, and status color: green/yellow/red).
  - "Last updated X seconds ago" timestamp.
  - Active alert banner (if any `WATCH` or `CRITICAL` alert is currently open) — tappable → AlertDetailModal.
  - Pull-to-refresh.
- **Data source:** WebSocket subscription for live updates + REST fallback (`GET /profiles/{id}/readings/latest`) on screen mount/reconnect.
- **Transitions:** Tap any vital card → HistoryScreen (pre-filtered to that metric). Tap alert banner → AlertDetailModal.

### 2.8 History Screen
- **Elements:** Metric selector (Heart Rate / SpO₂ / Temperature / Motion), time range toggle (24h / 7d / 30d), line chart, min/max/avg summary stats below chart.
- **Data source:** `GET /profiles/{id}/readings/history?range=...&metric=...`
- **Transitions:** None outbound (leaf screen).

### 2.9 Alerts Screen
- **Elements:** Reverse-chronological list of alerts. Each row: severity icon (yellow/red), alert type (e.g., "Fall Detected", "Low SpO₂"), timestamp, status (Active / Acknowledged / Resolved).
- **Filter:** Toggle "Active only" vs "All history".
- **Transitions:** Tap any row → AlertDetailModal.

### 2.10 Alert Detail Modal
- **Elements:** Alert type + severity, timestamp, the specific reading(s) that triggered it, elderly profile name, action buttons: "I'm Responding" (marks acknowledged by this caregiver) and "Mark Resolved" (only after responding — closes the alert), optional note field.
- **On action:** `POST /alerts/{id}/acknowledge` or `/resolve`.
- **Real-time behavior:** If another caregiver acknowledges first, this modal updates live (via WebSocket) to show "Ramesh is responding" so caregivers don't duplicate effort.
- **Transitions:** Dismiss → back to whichever screen opened it (Dashboard/Alerts) or, if opened from a push notification while app was closed, dismiss → DashboardScreen.

### 2.11 Settings Tab
- **Elements:** List of settings sections — Profile Details, Threshold Settings, Manage Caregivers, Device Status, Log Out.

### 2.12 Profile Details Screen
- **Elements:** Editable fields from AddElderlyProfileScreen (name, age, conditions, emergency contact).

### 2.13 Threshold Settings Screen
- **Purpose:** Let primary caregiver adjust alert sensitivity.
- **Elements:** Sliders/inputs for: Heart rate safe range (min/max), SpO₂ minimum threshold, Inactivity window (hours), toggle for temperature alerts.
- **Permission:** Only primary caregiver role can edit; secondary caregivers see read-only.
- **On submit:** `PATCH /profiles/{id}/thresholds`.

### 2.14 Manage Caregivers Screen
- **Elements:** List of linked caregivers (name, role: primary/secondary), "Generate Invite Code" button (shows shareable code/link), "Remove caregiver" option (primary only).

### 2.15 Device Status Screen
- **Elements:** Device ID, online/offline status, last-seen timestamp, battery level (if firmware reports it — optional), "Re-pair device" option.

---

## 3. Critical Flow: Fall Detection → Alert → Resolution (end-to-end)

1. Wearable ESP32 detects fall via MPU6050 accelerometer threshold breach → publishes to `caretrack/{device_id}/wearable/motion` with `fall_detected: true`.
2. Backend MQTT subscriber receives message → alert rule engine immediately classifies as `CRITICAL` (Rule 1 in TRD) → writes alert document to MongoDB → broadcasts on WebSocket to any connected app instances → triggers Expo push notification to **all** linked caregivers simultaneously.
3. Caregiver's phone shows push notification even if app is closed: "⚠️ Fall detected — [Elderly Name]".
4. Caregiver taps notification → app opens directly to AlertDetailModal (deep link).
5. Caregiver taps "I'm Responding" → all other caregivers' open app instances update in real time showing this caregiver is handling it.
6. Once resolved (in person or by phone), caregiver taps "Mark Resolved" + optional note ("False alarm — dropped phone" or "Fell, helped up, okay").
7. Alert moves from "Active" to "Resolved" in AlertsScreen history for all caregivers.

This flow is the single most important thing to get right — it should be the first thing built and tested end-to-end (even with mocked hardware) before polishing other screens.

---

## 4. Error & Edge-Case Flows

- **Device offline > 5 minutes:** Dashboard shows "Device Offline" banner instead of stale data; no fake "last known good" data displayed without a clear "last seen" timestamp.
- **No linked device yet:** Dashboard shows an empty-state prompting re-entry into PairDeviceScreen.
- **Invite code expired/invalid:** JoinWithCodeScreen shows inline error, does not crash to a blank screen.
- **Network loss on mobile app:** React Query shows cached last-known data with a "You're offline" indicator, retries automatically on reconnect.
- **Simultaneous acknowledgment race** (two caregivers tap "Responding" within the same second): backend accepts both, UI shows both names — no error state needed, this is a non-issue by design.
