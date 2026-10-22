import type { LatestResponse, Patient, Thresholds } from '../types';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://elderly-care-api.vercel.app'
).replace(/\/$/, '');

interface BackendUser {
  id: string;
  email: string;
  full_name: string;
  role: 'PATIENT' | 'CAREGIVER';
}

interface LoginResponse {
  access_token: string;
  user: BackendUser;
}

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  room_number: string;
  condition: string;
  email: string | null;
  date_of_birth: string;
  medical_notes: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_email: string | null;
  status: string;
  room_device_id: string;
  wearable_device_id: string;
}

interface ThresholdRow {
  patient_id: string;
  hr_min: number;
  hr_max: number;
  spo2_min: number;
  fall_g: number;
  room_temp_min: number;
  room_temp_max: number;
}

export interface LiveAlert {
  type: 'alert';
  alert_id: string;
  device_id: string;
  timestamp: string;
  category: string;
  severity: string;
  metric: string;
  value: number;
  message: string;
  patient_name?: string | null;
  room_number?: string | null;
}

function apiErrorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => typeof item?.msg === 'string' ? item.msg : '')
      .filter(Boolean)
      .join(', ') || fallback;
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error(`Cannot reach the CareTrack backend at ${API_BASE_URL}.`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(apiErrorMessage(body, `Backend request failed (${response.status}).`));
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export function registerUser(input: {
  email: string;
  password: string;
  full_name: string;
  role: 'PATIENT' | 'CAREGIVER';
  phone_number: string | null;
}) {
  return request<BackendUser>('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function loginUser(email: string, password: string) {
  return request<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function loginDemoCaregiver() {
  return request<LoginResponse>('/api/v1/auth/demo-login', { method: 'POST' });
}

export function registerPushToken(token: string, accessToken: string) {
  return request<{ status: string }>('/api/v1/auth/push-token', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token }),
  });
}

export function subscribeToAlerts(deviceIds: string[], onAlert: (alert: LiveAlert) => void) {
  const url = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/live`;
  // Recover alerts raised shortly before the app opened or resumed.
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const seen = new Set<string>();
  let stopped = false;
  let socket: WebSocket | null = null;
  let reconnect: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let polling: ReturnType<typeof setInterval> | null = null;

  const deliver = (alert: LiveAlert) => {
    if (seen.has(alert.alert_id)) return;
    if (seen.size > 200) seen.clear();
    seen.add(alert.alert_id);
    onAlert(alert);
  };

  const poll = () => {
    const query = new URLSearchParams({ device_ids: deviceIds.join(','), since });
    request<LiveAlert[]>(`/api/v1/alerts/latest?${query}`)
      .then((alerts) => alerts.reverse().forEach(deliver))
      .catch(() => {});
  };

  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(url);
    socket.onopen = () => {
      heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send('ping'), 20000);
    };
    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(String(data));
        if (message.type === 'alert') deliver(message as LiveAlert);
      } catch {
        // Ignore malformed or non-JSON telemetry frames.
      }
    };
    socket.onclose = () => {
      if (heartbeat) clearInterval(heartbeat);
      if (!stopped) reconnect = setTimeout(connect, 3000);
    };
  };

  connect();
  poll();
  polling = setInterval(poll, 2000);
  return () => {
    stopped = true;
    if (reconnect) clearTimeout(reconnect);
    if (heartbeat) clearInterval(heartbeat);
    if (polling) clearInterval(polling);
    socket?.close();
  };
}

export async function fetchPatients(token?: string): Promise<Patient[]> {
  const rows = await request<PatientRow[]>('/api/v1/patients', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  return rows.map((row) => ({
    id: String(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    age: row.age,
    gender: row.gender === 'Female' || row.gender === 'Male' ? row.gender : 'Other',
    roomNumber: row.room_number,
    condition: row.condition,
    email: row.email || undefined,
    dateOfBirth: row.date_of_birth,
    emergencyContact: {
      name: row.emergency_contact_name,
      phone: row.emergency_contact_phone,
      email: row.emergency_contact_email || undefined,
      relationship: '',
    },
    medicalNotes: row.medical_notes || row.condition,
    assignedCaregiver: '',
    roomDeviceId: row.room_device_id,
    wearableDeviceId: row.wearable_device_id,
    status:
      row.status === 'STABLE' || row.status === 'CRITICAL' ? row.status : 'ATTENTION',
  }));
}

export async function updatePatient(patient: Patient, token: string): Promise<Patient> {
  const row = await request<PatientRow>(`/api/v1/patients/${encodeURIComponent(patient.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      first_name: patient.firstName,
      last_name: patient.lastName,
      email: patient.email || null,
      date_of_birth: patient.dateOfBirth,
      gender: patient.gender,
      room_number: patient.roomNumber,
      medical_notes: patient.medicalNotes,
      emergency_contact_name: patient.emergencyContact.name,
      emergency_contact_phone: patient.emergencyContact.phone,
      emergency_contact_email: patient.emergencyContact.email || null,
    }),
  });
  return (await fetchPatients(token)).find((item) => item.id === String(row.id))!;
}

export function deletePatient(patientId: string, token: string) {
  return request<void>(`/api/v1/patients/${encodeURIComponent(patientId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mapThresholds(row: ThresholdRow): Thresholds {
  return {
    hrMin: Number(row.hr_min),
    hrMax: Number(row.hr_max),
    spo2Min: Number(row.spo2_min),
    fallThresholdG: Number(row.fall_g),
    roomTempMin: Number(row.room_temp_min),
    roomTempMax: Number(row.room_temp_max),
  };
}

export async function fetchPatientThresholds(patientId: string, token: string): Promise<Thresholds> {
  const query = new URLSearchParams({ patient_id: patientId });
  const row = await request<ThresholdRow>(`/api/v1/thresholds?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return mapThresholds(row);
}

export async function savePatientThresholds(patientId: string, thresholds: Thresholds, token: string): Promise<Thresholds> {
  const query = new URLSearchParams({ patient_id: patientId });
  const row = await request<ThresholdRow>(`/api/v1/thresholds?${query}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      patient_id: patientId,
      hr_min: thresholds.hrMin,
      hr_max: thresholds.hrMax,
      spo2_min: thresholds.spo2Min,
      fall_g: thresholds.fallThresholdG,
      room_temp_min: thresholds.roomTempMin,
      room_temp_max: thresholds.roomTempMax,
    }),
  });
  return mapThresholds(row);
}

export async function fetchLatest(roomDeviceId: string, wearableDeviceId: string): Promise<LatestResponse> {
  const query = new URLSearchParams({
    device_id: roomDeviceId,
    wearable_device_id: wearableDeviceId,
  });
  return request<LatestResponse>(`/readings/latest?${query}`);
}
