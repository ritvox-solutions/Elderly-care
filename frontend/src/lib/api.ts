import type { LatestResponse, Patient, Thresholds, WsAlertMessage } from './types';

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'https://elderly-care-api.vercel.app'
).replace(/\/$/, '');

interface PatientApiResponse {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  room_number: string;
  condition: string;
  status: Patient['status'];
  room_device_id: string;
  wearable_device_id: string;
  vitals: Patient['vitals'];
  room_env: Patient['roomEnv'];
}

export interface PatientOnboardingInput {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  room_number: string;
  medical_notes: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_email: string;
  room_device_id: string;
  wearable_device_id: string;
}

function mapPatient(data: PatientApiResponse): Patient {
  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    age: data.age,
    gender: data.gender,
    roomNumber: data.room_number,
    condition: data.condition,
    status: data.status,
    roomDeviceId: data.room_device_id,
    wearableDeviceId: data.wearable_device_id,
    vitals: data.vitals,
    roomEnv: data.room_env,
  };
}

async function get(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return response.json();
}

export async function fetchLatest(deviceId: string, wearableDeviceId?: string): Promise<LatestResponse> {
  const wearable = wearableDeviceId
    ? `&wearable_device_id=${encodeURIComponent(wearableDeviceId)}`
    : '';
  return get(`/readings/latest?device_id=${encodeURIComponent(deviceId)}${wearable}`);
}

export function fetchLatestAlerts(
  deviceIds: string[],
  since: string,
): Promise<WsAlertMessage[]> {
  const query = new URLSearchParams({ device_ids: deviceIds.join(','), since });
  return get(`/api/v1/alerts/latest?${query}`);
}

export async function fetchPatients(): Promise<Patient[]> {
  const data = (await get('/api/v1/patients')) as PatientApiResponse[];
  return data.map(mapPatient);
}

export async function createPatient(input: PatientOnboardingInput, token: string): Promise<Patient> {
  const response = await fetch(`${API_BASE_URL}/api/v1/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = Array.isArray(error.detail)
      ? error.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(', ')
      : error.detail;
    throw new Error(detail || `Patient onboarding failed (${response.status})`);
  }
  return mapPatient((await response.json()) as PatientApiResponse);
}

export async function fetchPatientThresholds(patientId: string): Promise<Thresholds> {
  const data = await get(`/api/v1/thresholds?patient_id=${encodeURIComponent(patientId)}`);
  return {
    patientId: data.patient_id,
    hrMin: Number(data.hr_min),
    hrMax: Number(data.hr_max),
    spo2Min: Number(data.spo2_min),
    fallG: Number(data.fall_g ?? 3.0),
    roomTempMin: Number(data.room_temp_min),
    roomTempMax: Number(data.room_temp_max),
    inactivityHours: 6,
  };
}

export async function savePatientThresholds(
  patientId: string,
  thresholds: Thresholds,
  token?: string
): Promise<Thresholds> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const payload = {
    patient_id: patientId,
    hr_min: thresholds.hrMin,
    hr_max: thresholds.hrMax,
    spo2_min: thresholds.spo2Min,
    fall_g: thresholds.fallG ?? 3.0,
    room_temp_min: thresholds.roomTempMin,
    room_temp_max: thresholds.roomTempMax,
  };

  const endpoint = `/api/v1/thresholds?patient_id=${encodeURIComponent(patientId)}`;
  const r = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    let msg = `Failed to update patient thresholds (${r.status})`;
    if (typeof err.detail === 'string') {
      msg = err.detail;
    } else if (Array.isArray(err.detail) && err.detail.length > 0) {
      msg = err.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
    } else if (err.message) {
      msg = err.message;
    }
    throw new Error(msg);
  }

  const data = await r.json();
  return {
    patientId: data.patient_id,
    hrMin: Number(data.hr_min),
    hrMax: Number(data.hr_max),
    spo2Min: Number(data.spo2_min),
    fallG: Number(data.fall_g ?? 3.0),
    roomTempMin: Number(data.room_temp_min),
    roomTempMax: Number(data.room_temp_max),
    inactivityHours: 6,
  };
}

export function wsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  return `${API_BASE_URL.replace(/^http/, 'ws')}/ws/live`;
}
