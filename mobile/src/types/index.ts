export interface LatestReading {
  value: number | null;
  timestamp: string | null;
}

export interface LatestResponse {
  device_id: string;
  wearable_device_id?: string | null;
  temperature: LatestReading | null;
  humidity: LatestReading | null;
  motion_detected: LatestReading | null;
  heart_rate: LatestReading | null;
  spo2: LatestReading | null;
  cardio_temp: LatestReading | null;
  last_seen: string | null;
}

export interface TelemetryPoint {
  t: number;
  timeStr: string;
  heartRate?: number;
  spo2?: number;
  roomTemp?: number;
  humidity?: number;
  bodyTemp?: number;
  motion?: number;
}

export interface AlertItem {
  id: string;
  type: 'FALL' | 'CARDIAC' | 'ENVIRONMENT' | 'DEVICE_OFFLINE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: string;
  deviceId: string;
  patientName?: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledgedBy?: string;
  resolutionNotes?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: 'Female' | 'Male' | 'Other';
  roomNumber: string;
  condition: string;
  email?: string;
  dateOfBirth?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
    email?: string;
  };
  medicalNotes: string;
  assignedCaregiver: string;
  roomDeviceId: string;
  wearableDeviceId: string;
  status: 'STABLE' | 'ATTENTION' | 'CRITICAL';
}

export interface DeviceItem {
  id: string;
  identifier: string;
  name: string;
  type: 'ROOM_KIT' | 'WEARABLE';
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: string;
  batteryPercent?: number;
  firmware: string;
  assignedPatientId?: string;
  assignedPatientName?: string;
  ipAddress?: string;
  rssi?: string;
}

export interface ActivityTimelineItem {
  id: string;
  timestamp: string;
  type: 'MOTION' | 'VITAL_CHECK' | 'FALL_EVENT' | 'DEVICE_STATUS' | 'ALERT_RESOLVED';
  title: string;
  description: string;
  severity?: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface Thresholds {
  hrMin: number;
  hrMax: number;
  spo2Min: number;
  roomTempMin: number;
  roomTempMax: number;
  fallThresholdG: number;
}
