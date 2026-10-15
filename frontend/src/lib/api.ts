import type { LatestResponse, Thresholds } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function get(path: string) {
  // Prefer same-origin (Vite proxy) then fall back to explicit backend URL.
  try {
    const r = await fetch(`${API_BASE}${path}`);
    if (r.ok) return r.json();
  } catch {
    /* fall through */
  }
  const fallback = `http://localhost:8000${path}`;
  const r2 = await fetch(fallback);
  if (!r2.ok) throw new Error(`GET ${path} failed: ${r2.status}`);
  return r2.json();
}

export async function fetchLatest(deviceId: string): Promise<LatestResponse> {
  return get(`/readings/latest?device_id=${encodeURIComponent(deviceId)}`);
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
  let r = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!r || !r.ok) {
    r = await fetch(`http://localhost:8000${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
  }

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
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${proto}://${host}/ws/live`;
}
