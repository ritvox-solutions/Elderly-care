import type { LatestResponse } from './types';

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

export async function fetchHealth(): Promise<{ status: string }> {
  return get('/health');
}

export async function fetchLatest(deviceId: string): Promise<LatestResponse> {
  return get(`/readings/latest?device_id=${encodeURIComponent(deviceId)}`);
}

export function wsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  // In dev, Vite proxies /ws -> backend. In prod behind FastAPI static, same-origin works.
  // If running Vite on :5173, same-origin /ws/live hits the proxy.
  return `${proto}://${host}/ws/live`;
}
