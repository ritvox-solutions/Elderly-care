import { useEffect, useState } from 'react';
import { pad } from './format';

/** Ticking wall clock (replaces tickClock + renderAgo intervals in the HTML). */
export function useNow(stepMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), stepMs);
    return () => window.clearInterval(t);
  }, [stepMs]);
  return now;
}

export function clockStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function tzName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}
