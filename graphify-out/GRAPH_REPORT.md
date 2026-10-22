# Graph Report - dhruva  (2026-10-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 688 nodes · 1556 edges · 49 communities (30 shown, 19 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.92)
- Token cost: 15,684 input · 628 output

## Graph Freshness
- Built from commit: `0db925ce`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Database Migrations & Alerting
- Authentication & Authorization
- Telemetry Processing & WebSocket
- Mobile App UI Components
- Frontend Type Definitions
- Patient Onboarding & API
- Frontend App Shell & Alerts
- Frontend Navigation & State
- Frontend TypeScript Config
- Alembic Migrations & Push Service
- Emergency Alert Pipeline
- Frontend Package Config
- Cardio Charts & History
- Node TypeScript Config
- UI Utilities & Patient Monitor
- Android Main Application
- Emergency Detection & Tests
- Expo App Configuration
- Mobile Package Dependencies
- Android Build & Activity
- AMPV Decision Engine
- Frontend Dev Dependencies
- Mobile Runtime Dependencies
- SMTP Email Transport
- Alert Email Service
- Test Configuration & Fixtures
- Fake SMTP Test Helper
- Patient API Tests
- Oxlint Configuration
- Frontend Runtime Dependencies
- Frontend Build Scripts
- Mobile Dev Dependencies
- Mobile Platform Scripts
- Mobile TypeScript Config
- Alert Email Template
- Frontend TS Config References
- Vercel Rewrite Config
- Backend Root

## God Nodes (most connected - your core abstractions)
1. `process_emergency()` - 25 edges
2. `User` - 24 edges
3. `GUID` - 22 edges
4. `parse_telemetry()` - 20 edges
5. `DevicePairing` - 19 edges
6. `compilerOptions` - 18 edges
7. `Shell()` - 16 edges
8. `UserRole` - 15 edges
9. `TelemetryEvent` - 15 edges
10. `useApp()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `require_role()` --uses--> `UserRole`  [INFERRED]
  backend/core/dependencies.py → backend/models/enums.py
- `User` --uses--> `UserRole`  [INFERRED]
  backend/models/user.py → backend/models/enums.py
- `update_thresholds()` --uses--> `UserRole`  [INFERRED]
  backend/routers/thresholds.py → backend/models/enums.py
- `UserRegisterRequest` --uses--> `UserRole`  [INFERRED]
  backend/schemas/auth.py → backend/models/enums.py
- `AuditLog` --uses--> `GUID`  [INFERRED]
  backend/models/audit_log.py → backend/models/user.py

## Import Cycles
- None detected.

## Communities (49 total, 19 thin omitted)

### Community 0 - "Database Migrations & Alerting"
Cohesion: 0.07
Nodes (33): upgrade(), upgrade(), downgrade(), upgrade(), Alert, AlertRule, CaregiverAssignment, Device (+25 more)

### Community 1 - "Authentication & Authorization"
Cohesion: 0.07
Nodes (35): get_current_active_user(), get_current_user(), get_token_from_request(), require_role(), create_access_token(), decode_access_token(), hash_password(), verify_password() (+27 more)

### Community 2 - "Telemetry Processing & WebSocket"
Cohesion: 0.06
Nodes (32): alert_worker(), broadcast_messages(), ConnectionManager, health(), ingest_telemetry_http(), latest(), lifespan(), on_message() (+24 more)

### Community 3 - "Mobile App UI Components"
Cohesion: 0.07
Nodes (49): App(), displayReading(), NavTab, styles, FallAlertModal(), FallAlertModalProps, styles, MetricCard() (+41 more)

### Community 4 - "Frontend Type Definitions"
Cohesion: 0.13
Nodes (20): wsUrl(), validTs(), AlertItem, isAlert(), isBundle(), LatestReading, LatestResponse, SensorType (+12 more)

### Community 5 - "Patient Onboarding & API"
Cohesion: 0.20
Nodes (17): EMPTY_FORM, PatientOnboardingForm(), TODAY, createPatient(), fetchLatest(), fetchPatients(), fetchPatientThresholds(), get() (+9 more)

### Community 6 - "Frontend App Shell & Alerts"
Cohesion: 0.20
Nodes (13): App(), Shell(), FallBanner(), playEmergencyAlarm(), useApp(), useNow(), AlertItem, Alerts() (+5 more)

### Community 7 - "Frontend Navigation & State"
Cohesion: 0.16
Nodes (16): BellIcon(), Chrome(), GearIcon(), HeartIcon(), HistoryIcon(), UsersIcon(), AppProvider(), AppState (+8 more)

### Community 8 - "Frontend TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 10 - "Emergency Alert Pipeline"
Cohesion: 0.17
Nodes (10): _patient_context(), process_emergency(), _recent_sensor_context(), resolve_recipients(), alert_message(), fall_event(), test_cooldown_suppresses_repeat_falls(), test_process_emergency_persists_alert_and_delivers_email() (+2 more)

### Community 11 - "Frontend Package Config"
Cohesion: 0.12
Nodes (15): react, name, private, type, version, @types/react, typescript, oxlint (+7 more)

### Community 12 - "Cardio Charts & History"
Cohesion: 0.18
Nodes (12): CardioChart(), HistoryChart(), HistoryPoint, BadgeKind, CardioFeedRow, CardioPoint, pick(), useCardio() (+4 more)

### Community 13 - "Node TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 14 - "UI Utilities & Patient Monitor"
Cohesion: 0.33
Nodes (11): Spark(), ago(), fmtF(), fmtT(), pad(), validDate(), clockStr(), tzName() (+3 more)

### Community 16 - "Emergency Detection & Tests"
Cohesion: 0.23
Nodes (10): detect_emergencies(), reset_cooldowns(), clean_cooldowns(), test_detect_emergencies_consolidates_verified_ampv_event(), test_fall_detection_is_critical_emergency(), test_multiple_breaches_batch_into_one_email(), test_normal_vitals_trigger_no_emergency(), test_room_temperature_breach_is_environment_warning() (+2 more)

### Community 17 - "Expo App Configuration"
Cohesion: 0.13
Nodes (14): backgroundColor, adaptiveIcon, package, expo, android, ios, name, orientation (+6 more)

### Community 18 - "Mobile Package Dependencies"
Cohesion: 0.14
Nodes (13): react, main, name, private, version, @babel/core, expo, expo-constants (+5 more)

### Community 20 - "AMPV Decision Engine"
Cohesion: 0.22
Nodes (4): AMPVDecision, evaluate_ampv(), test_ampv_rejects_single_ambiguous_signal(), test_ampv_verifies_multi_sensor_emergencies()

### Community 21 - "Frontend Dev Dependencies"
Cohesion: 0.20
Nodes (10): devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+2 more)

### Community 22 - "Mobile Runtime Dependencies"
Cohesion: 0.20
Nodes (10): dependencies, expo, expo-constants, expo-notifications, expo-status-bar, lucide-react-native, react, react-native (+2 more)

### Community 23 - "SMTP Email Transport"
Cohesion: 0.25
Nodes (3): send_smtp_mail(), test_send_smtp_mail_builds_and_delivers_message(), test_send_smtp_mail_reports_connection_errors()

### Community 24 - "Alert Email Service"
Cohesion: 0.25
Nodes (4): send_alert_email(), Settings, test_send_alert_email_requires_smtp_host(), test_send_alert_email_respects_disable_flag()

### Community 25 - "Test Configuration & Fixtures"
Cohesion: 0.28
Nodes (3): client(), db_session(), setup_test_db()

### Community 27 - "Patient API Tests"
Cohesion: 0.67
Nodes (5): _caregiver_token(), _patient_payload(), test_caregiver_can_onboard_patient_and_pair_devices(), test_patient_onboarding_rejects_duplicate_room(), test_patient_onboarding_requires_real_caregiver_login()

### Community 28 - "Oxlint Configuration"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 29 - "Frontend Runtime Dependencies"
Cohesion: 0.40
Nodes (5): dependencies, chart.js, react, react-dom, react-router-dom

### Community 30 - "Frontend Build Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 31 - "Mobile Dev Dependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @babel/core, hermes-parser, @types/react, typescript

### Community 32 - "Mobile Platform Scripts"
Cohesion: 0.40
Nodes (5): scripts, android, ios, start, web

### Community 35 - "Mobile TypeScript Config"
Cohesion: 0.50
Nodes (3): compilerOptions, extends, expo/tsconfig.base

## Knowledge Gaps
- **14 isolated node(s):** `react`, `oxlint`, `tailwindcss`, `@tailwindcss/vite`, `@types/node` (+9 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 273 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-router-dom` connect `Frontend Navigation & State` to `Frontend Package Config`, `Frontend App Shell & Alerts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `User` (e.g. with `get_current_active_user()` and `get_current_user()`) actually correct?**
  _`User` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `react`, `oxlint`, `tailwindcss` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database Migrations & Alerting` be split into smaller, more focused modules?**
  _Cohesion score 0.0694249649368864 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `Mobile App UI Components` to `Mobile Package Dependencies`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `GUID` (e.g. with `Alert` and `AlertRule`) actually correct?**
  _`GUID` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Should `Authentication & Authorization` be split into smaller, more focused modules?**
  _Cohesion score 0.06716417910447761 - nodes in this community are weakly interconnected._