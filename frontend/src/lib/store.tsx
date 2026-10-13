import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Thresholds } from './types';

const DEFAULTS: Thresholds = {
  hrMin: 60,
  hrMax: 100,
  spo2Min: 95,
  roomTempMin: 18,
  roomTempMax: 27,
  inactivityHours: 6,
};

interface AppState {
  deviceId: string;
  setDeviceId: (d: string) => void;
  thresholds: Thresholds;
  setThresholds: (t: Thresholds) => void;
  profileName: string;
  setProfileName: (n: string) => void;
}

const Ctx = createContext<AppState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceIdState] = useState(() => load('caretrack.deviceId', 'room-unit-01') as string);
  const [thresholds, setThresholdsState] = useState<Thresholds>(() => load('caretrack.thresholds', DEFAULTS));
  const [profileName, setProfileNameState] = useState(() => load('caretrack.profile', 'Elderly Member') as string);

  useEffect(() => localStorage.setItem('caretrack.deviceId', JSON.stringify(deviceId)), [deviceId]);
  useEffect(() => localStorage.setItem('caretrack.thresholds', JSON.stringify(thresholds)), [thresholds]);
  useEffect(() => localStorage.setItem('caretrack.profile', JSON.stringify(profileName)), [profileName]);

  const setDeviceId = (d: string) => setDeviceIdState(d.trim() || 'room-unit-01');
  const setThresholds = (t: Thresholds) => setThresholdsState(t);
  const setProfileName = (n: string) => setProfileNameState(n);

  return (
    <Ctx.Provider value={{ deviceId, setDeviceId, thresholds, setThresholds, profileName, setProfileName }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
