# CareTrack Mobile Companion App (React Native / Expo)

A caregiver companion mobile application providing real-time physiological & environmental telemetry monitoring with **immediate pop-up emergency notification for fall detection**.

---

## 📱 Features

1. **Pop-Up Fall Alert Modal (`FallAlertModal.tsx`)**:
   - Urgent pop-up overlay when the wearable MPU6050 detects a high-G acceleration shock.
   - Shows impact magnitude, patient name, room location, and detection timestamp.
   - 1-click **Silence** and **Dispatch Nurse** emergency response.
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
3. Open on your device:
   - **Android**: Press `a` or scan the QR code with **Expo Go**.
   - **iOS**: Scan the QR code with your iPhone camera via **Expo Go**.
   - **Web Preview**: Press `w`.
