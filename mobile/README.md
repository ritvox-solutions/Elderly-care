# CareTrack Mobile Companion App (React Native / Expo)

A caregiver companion mobile application providing real-time physiological & environmental telemetry monitoring with **immediate pop-up emergency notification for fall detection**.

---

## 📱 Features

1. **Pop-Up Fall Alert Modal (`FallAlertModal.tsx`)**:
   - Urgent pop-up overlay when the wearable MPU6050 detects a high-G acceleration shock.
   - Shows impact magnitude, patient name, room location, and detection timestamp.
   - 1-click **Silence** and **Dispatch Nurse** emergency response.
   - High-priority OS notification when the app is backgrounded or closed.
2. **Real-time Vitals & Room Climate Cards**:
   - Continuous Heart Rate (BPM) & Blood Oxygen (SpO2 %) tracking.
   - Ambient room temperature (°C) & relative humidity (% RH) from NodeMCU DHT11.
   - Room occupancy detection from HC-SR501 PIR sensor.
3. **Patient Profile Summary**:
   - Demographics, care ward/room, and clinical watch notes.

---

## 🚀 How to Run the App

1. Ensure Node.js (v18+) is installed.
2. In your terminal:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
   Set `EXPO_PUBLIC_API_BASE_URL` before starting Expo. Use `http://10.0.2.2:8000` for the Android emulator, or your computer's LAN address for Expo Go on a physical phone:
   ```powershell
   $env:EXPO_PUBLIC_API_BASE_URL='http://192.168.1.10:8000'
   $env:EXPO_PUBLIC_EAS_PROJECT_ID='your-eas-project-uuid'
   npx expo start
   ```
   For a deployed build, set `EXPO_PUBLIC_API_BASE_URL` to the public HTTPS backend URL. The URL must be accessible without Vercel Deployment Protection because native apps cannot complete Vercel's browser sign-in flow.
   Remote push notifications require an EAS-linked development or production build and a real caregiver sign-in so the Expo token can be registered with the backend. The one-tap mock login can show foreground alerts through backend polling, but it has no authentication token for closed-app push. Expo Go on Android does not support remote push notifications. Run `npx eas-cli login`, `npx eas-cli init`, configure FCM credentials, then create an installable test APK with `npx eas-cli build --platform android --profile preview`.
3. Open on your device:
   - **Android**: Press `a` or scan the QR code with **Expo Go**.
   - **iOS**: Scan the QR code with your iPhone camera via **Expo Go**.
   - **Web Preview**: Press `w`.
