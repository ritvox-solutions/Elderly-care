// Formatting helpers — copied from backend/static/index.html
export const pad = (n: number) => String(n).padStart(2, '0');

function validDate(ts: string | null | undefined): Date {
  const d = new Date(ts ?? '');
  if (isNaN(d.getTime()) || d.getFullYear() < 2020) return new Date();
  return d;
}

/** HH:MM:SS */
export function fmtT(ts: string | null | undefined): string {
  if (!ts) return '--';
  const d = validDate(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "Oct 12 09:15:00" style full stamp */
export function fmtF(ts: string | null | undefined): string {
  if (!ts) return '--';
  const d = validDate(ts);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${fmtT(ts)}`;
}

export function ago(ts: string | null | undefined): string {
  if (!ts) return '--';
  const d = new Date(ts);
  if (isNaN(d.getTime()) || d.getFullYear() < 2020) return 'just now';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/** Normalize any incoming timestamp to a valid ISO string (real-time clock sync). */
export function validTs(ts: unknown): string {
  if (typeof ts !== 'string') return new Date().toISOString();
  const d = new Date(ts);
  if (isNaN(d.getTime()) || d.getFullYear() < 2020) return new Date().toISOString();
  return ts;
}
