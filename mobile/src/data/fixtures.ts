import type { AlertItem, TelemetryPoint, Patient } from '../types';

export const DEMO_ALERTS: AlertItem[] = [
  {
    id: 'alt-001',
    type: 'FALL',
    severity: 'CRITICAL',
    title: 'Sudden Fall Impact Detected',
    message: 'High-G acceleration shock (3.85g) detected on wearable in the monitored room. Immediate response required.',
    timestamp: '12 mins ago',
    deviceId: 'ESP32-CardiacMonitor',
    patientName: 'Patient',
    status: 'ACTIVE',
  },
  {
    id: 'alt-002',
    type: 'CARDIAC',
    severity: 'WARNING',
    title: 'Elevated Tachycardia Warning',
    message: 'Resting heart rate measured at 112 BPM for over 4 continuous minutes.',
    timestamp: '42 mins ago',
    deviceId: 'ESP32-CardiacMonitor',
    patientName: 'Patient',
    status: 'ACKNOWLEDGED',
    acknowledgedBy: 'Care Taker',
  },
  {
    id: 'alt-003',
    type: 'ENVIRONMENT',
    severity: 'INFO',
    title: 'Room Humidity Below Comfort Level',
    message: 'Room humidity dropped to 28% RH. Air humidifier check recommended.',
    timestamp: '2 hours ago',
    deviceId: 'room-unit-01',
    patientName: 'Patient',
    status: 'RESOLVED',
    acknowledgedBy: 'Care Taker',
    resolutionNotes: 'Humidifier refilled and adjusted to 45%.',
  },
];

export function generateHistoricalData(pointsCount: number = 24): TelemetryPoint[] {
  const result: TelemetryPoint[] = [];
  const now = Date.now();
  const stepMs = (24 * 3600 * 1000) / pointsCount;

  for (let i = pointsCount - 1; i >= 0; i--) {
    const t = now - i * stepMs;
    const date = new Date(t);
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    const hour = date.getHours();
    const baseHr = hour >= 23 || hour <= 6 ? 62 : 75;
    const hrNoise = Math.sin(i * 0.5) * 6 + (Math.random() * 4 - 2);
    const hr = Math.round(baseHr + hrNoise);

    const spo2 = Math.min(100, Math.max(94, Math.round(98 + Math.sin(i * 0.3) * 1.5 + (Math.random() * 1 - 0.5))));
    const roomTemp = parseFloat((23.0 + Math.sin(i * 0.2) * 1.8 + (Math.random() * 0.4 - 0.2)).toFixed(1));
    const humidity = parseFloat((48.0 + Math.cos(i * 0.2) * 5.0 + (Math.random() * 2 - 1)).toFixed(1));
    const bodyTemp = parseFloat((36.5 + Math.sin(i * 0.4) * 0.25).toFixed(1));

    result.push({
      t,
      timeStr,
      heartRate: hr,
      spo2,
      roomTemp,
      humidity,
      bodyTemp,
      motion: Math.random() > 0.4 ? 1 : 0,
    });
  }
  return result;
}

export const DEMO_PATIENTS: Patient[] = [
  {
    id: 'p-001',
    firstName: 'Margaret',
    lastName: 'Thatcher',
    age: 84,
    gender: 'Female',
    roomNumber: 'Room 204',
    condition: 'Post-cardiac stent, mobility risk, mild hypertension',
    emergencyContact: {
      name: 'Mark Thatcher',
      phone: '+1 (555) 234-8901',
      relationship: 'Son',
    },
    medicalNotes: 'Keep wearable fitted snug on left wrist. Monitor nightly SpO2 dips.',
    assignedCaregiver: 'Dr. Sarah Jenkins',
    roomDeviceId: 'room-unit-01',
    wearableDeviceId: 'ESP32-CardiacMonitor',
    status: 'STABLE',
  },
  {
    id: 'p-002',
    firstName: 'Arthur',
    lastName: 'Pendleton',
    age: 79,
    gender: 'Male',
    roomNumber: 'Room 108',
    condition: 'Arrhythmia history, pacemaker, type 2 diabetes',
    emergencyContact: {
      name: 'Clara Pendleton',
      phone: '+1 (555) 456-7890',
      relationship: 'Spouse',
    },
    medicalNotes: 'Tachycardia alert threshold set to 105 BPM. Check daily glycemic levels.',
    assignedCaregiver: 'Dr. Sarah Jenkins',
    roomDeviceId: 'room-unit-02',
    wearableDeviceId: 'ESP32-CardiacMonitor-02',
    status: 'ATTENTION',
  },
  {
    id: 'p-003',
    firstName: 'Eleanor',
    lastName: 'Vance',
    age: 91,
    gender: 'Female',
    roomNumber: 'Room 312',
    condition: 'Severe osteoporosis, chronic COPD, high fall risk',
    emergencyContact: {
      name: 'David Vance',
      phone: '+1 (555) 678-9012',
      relationship: 'Son',
    },
    medicalNotes: 'High fall risk protocol active. Fall detection accelerometer at 2.5G trigger.',
    assignedCaregiver: 'Dr. Sarah Jenkins',
    roomDeviceId: 'room-unit-03',
    wearableDeviceId: 'ESP32-CardiacMonitor-03',
    status: 'CRITICAL',
  },
];
