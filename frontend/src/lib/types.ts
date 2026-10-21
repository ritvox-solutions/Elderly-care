export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  roomNumber: string;
  condition: string;
  email?: string;
  dateOfBirth?: string;
  medicalNotes?: string;
  emergencyContact?: { name: string; phone: string; email?: string };
  status: 'STABLE' | 'ATTENTION' | 'CRITICAL';
  roomDeviceId: string;
  wearableDeviceId: string;
  vitals?: {
    hr: number;
    spo2: number;
    temp: number;
  };
  roomEnv?: {
    temp: number;
    humidity: number;
  };
}

export type SensorType = 'room' | 'wearable' | string;

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

// WebSocket messages from backend/main.py on_message():
// 1. Bundle: { device_id, sensor, timestamp, data: {...}, fall_detected }
// 2. Per-metric: { device_id, sensor, timestamp, metric, value, fall_detected }
export interface WsBundleMessage {
  device_id: string;
  sensor?: string;
  timestamp: string;
  data: Record<string, number | string | boolean>;
  fall_detected?: boolean;
}

export interface WsMetricMessage {
  device_id: string;
  sensor?: string;
  timestamp: string;
  metric: string;
  value: number | string | boolean;
  fall_detected?: boolean;
}

export interface WsAlertMessage {
  type: 'alert';
  alert_id: string;
  device_id: string;
  timestamp: string;
  category: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metric: string;
  value?: number;
  message: string;
}

export type WsMessage = WsBundleMessage | WsMetricMessage | WsAlertMessage;

export function isAlert(m: WsMessage): m is WsAlertMessage {
  return (m as WsAlertMessage).type === 'alert';
}

export function isBundle(m: WsMessage): m is WsBundleMessage {
  return (m as WsBundleMessage).data !== undefined;
}

export interface TelemetryPoint {
  t: number; // epoch ms
  iso: string;
  temperature?: number;
  humidity?: number;
  motion?: number;
  heart_rate?: number;
  spo2?: number;
  body_temp?: number;
  accel?: number;
  fall?: boolean;
}

export type Status = 'normal' | 'watch' | 'critical' | 'idle' | 'offline';

export interface AlertItem {
  id: string;
  type: string;
  severity: 'WATCH' | 'CRITICAL';
  message: string;
  timestamp: string;
  deviceId: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  note?: string;
}

export interface Thresholds {
  patientId?: string;
  hrMin: number;
  hrMax: number;
  spo2Min: number;
  fallG?: number;
  roomTempMin: number;
  roomTempMax: number;
  inactivityHours?: number;
}
