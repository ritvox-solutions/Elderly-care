# UI/UX Design Brief
## CareTrack — IoT Based Elderly Health Monitoring Companion App

---

## 1. Design Principles

This app is used by **worried family members**, often checking it in moments of anxiety. Design decisions should optimize for:

1. **Calm, not clinical.** Avoid stark hospital-monitor aesthetics (harsh reds/black backgrounds, alarm-siren imagery). Use warm, reassuring visuals when everything is normal; reserve strong red only for genuine `CRITICAL` states.
2. **Glanceability.** The most important information (is everything okay right now?) must be readable in under 2 seconds of looking at the Dashboard.
3. **Zero ambiguity during an alert.** When something is wrong, the UI should never make the caregiver hunt for what happened or what to do next.
4. **Low cognitive load.** Caregivers may be older adults themselves (spouses) or busy professionals — no jargon, minimal steps, large tap targets.

---

## 2. Brand Direction

**Assumption:** No existing brand identity was specified for this app (unlike your EDVOLS/Print Point ventures which have defined palettes). The following is a recommended new direction suited to a health/care product — change if you want to reuse an existing brand system.

**Color palette:**
- Primary (trust, calm): Soft teal — `#2A7F7E`
- Secondary (warmth): Warm sand/cream background — `#FAF6F0`
- Status — Normal: `#3FA34D` (green)
- Status — Watch: `#E8A33D` (amber)
- Status — Critical: `#D64545` (red — used sparingly, only for active critical alerts)
- Text primary: `#243B3B` (near-black teal-tinted, softer than pure black)
- Text secondary: `#6B7A7A`

**Typography:**
- Use a rounded, humanist sans-serif (e.g., **Inter** or **Nunito Sans** — both free, available via `expo-font` or Google Fonts).
- Headings: Semi-bold, generous size (vitals numbers should be the largest text on any screen — they're the reason someone opened the app).
- Body: Regular weight, minimum 15px for readability by older secondary users.

**Iconography:** Rounded, filled icons (not thin-line) for better visibility — recommend `lucide-react-native` or `phosphor-react-native` icon sets in their "duotone" or "fill" variants.

---

## 3. Screen-Specific Design Notes

### Dashboard (most important screen)
- Vital cards use a 2x2 grid on phone-width screens. Each card:
  - Large number (value), smaller unit label, small trend arrow (↑↓) if changed from previous reading.
  - Colored left border or background tint indicating status (green/amber/red) rather than colored text alone (accessibility — don't rely on color-only signaling; pair with an icon: checkmark / exclamation / alert-triangle).
  - Tapping a card gives haptic feedback (`expo-haptics`) before navigating to History — reinforces responsiveness.
- Device online/offline indicator as a small dot + label near the profile name, not a full banner unless offline > 5 minutes (avoid noisy negative-space alarms for brief drops).
- Active alert banner (if present) should visually dominate the top of the screen — full-width, status color background, bold text, single primary action button ("View Details").

### Alert Detail Modal
- This is the single highest-stakes screen in the app. Design for a caregiver's hands possibly shaking or in a hurry:
  - Severity + alert type as the largest text on screen.
  - Timestamp in relative format ("2 minutes ago") plus exact time below in smaller text.
  - Primary action button ("I'm Responding") should be the single largest tappable element on the modal, full-width, high-contrast.
  - Secondary actions (notes, resolve) appear only after "I'm Responding" is tapped, to avoid decision paralysis in the first second of seeing the alert.

### History Screen
- Chart should use the same status-color logic as Dashboard cards (shade the danger zone bands lightly on the chart background so caregivers can see when a line entered a risky range, not just the raw number).
- Keep chart interactions simple: tap-and-drag to see a specific point's value/time, no complex pinch-zoom required for v1.

### Onboarding (Add Profile / Pair Device)
- Should feel like setting up a new phone, not filling out a hospital admission form — use a simple step indicator (Step 1 of 3) at the top, one focused question/action per screen, large "Continue" button anchored at the bottom.

### Empty States
- No device paired yet: friendly illustration + "Let's get your first device connected" + single CTA button — never an empty gray screen.
- No alerts yet (Alerts tab): reassuring message ("No alerts — everything's been steady") rather than a blank list, which can read as broken.

---

## 4. Accessibility Requirements

- Minimum tap target size: 44x44dp.
- Do not rely on color alone to convey status — always pair with icon/text label (relevant since some caregivers may be colorblind or older with reduced color discrimination).
- Support system font-scaling (respect OS-level "larger text" accessibility settings — avoid fixed-height text containers that clip scaled text).
- All push notifications should include descriptive text, not just a generic "New Alert" (screen readers and notification previews should convey the actual situation).

---

## 5. Tone of Voice (copy guidelines)

- Alerts: **Direct, calm, factual.** e.g., "Fall detected for [Name] at 10:32 AM" — not "OH NO! Something terrible may have happened!!"
- Confirmations: **Warm, brief.** e.g., "Got it — Ramesh is on it."
- Empty/idle states: **Reassuring.** e.g., "All steady. Last check-in 2 minutes ago."
- Never use humor or casual slang in alert-related copy — this is the one place in the app where tone must stay serious regardless of the app's otherwise warm personality elsewhere.

---

## 6. Design Deliverable Recommendation for the AI Coding Agent

Since no existing Figma file is assumed, instruct the coding agent to:
1. Build with `nativewind` (Tailwind for React Native) or plain `StyleSheet` using a centralized `theme.ts` file containing the palette/typography tokens above — so colors are defined once and reused, not hardcoded per-screen.
2. Build the Dashboard and Alert Detail Modal first and get design sign-off (visually) before building the remaining lower-stakes screens (Settings, Manage Caregivers) — these two screens carry the most UX risk.
