import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Thresholds, Patient } from './types';
import { fetchPatientThresholds } from './api';

export type UserRole = 'PATIENT' | 'CAREGIVER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  token?: string;
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
    status: 'STABLE',
    roomDeviceId: 'room-unit-01',
    wearableDeviceId: 'ESP32-CardiacMonitor',
    vitals: { hr: 76, spo2: 98, temp: 36.6 },
    roomEnv: { temp: 23.5, humidity: 48 },
  },
  {
    id: 'p-002',
    firstName: 'Arthur',
    lastName: 'Pendleton',
    age: 79,
    gender: 'Male',
    roomNumber: 'Room 108',
    condition: 'Arrhythmia history, pacemaker, type 2 diabetes',
    status: 'ATTENTION',
    roomDeviceId: 'room-unit-02',
    wearableDeviceId: 'ESP32-CardiacMonitor-02',
    vitals: { hr: 88, spo2: 94, temp: 36.8 },
    roomEnv: { temp: 24.1, humidity: 52 },
  },
  {
    id: 'p-003',
    firstName: 'Eleanor',
    lastName: 'Vance',
    age: 91,
    gender: 'Female',
    roomNumber: 'Room 312',
    condition: 'Severe osteoporosis, chronic COPD, high fall risk',
    status: 'CRITICAL',
    roomDeviceId: 'room-unit-03',
    wearableDeviceId: 'ESP32-CardiacMonitor-03',
    vitals: { hr: 64, spo2: 91, temp: 36.4 },
    roomEnv: { temp: 22.8, humidity: 45 },
  },
];





export const DEMO_USERS: Record<UserRole, AuthUser> = {
  CAREGIVER: {
    id: 'usr-caregiver-01',
    email: 'caregiver@caretrack.health',
    fullName: 'Dr. Sarah Jenkins',
    role: 'CAREGIVER',
  },
  PATIENT: {
    id: 'usr-patient-01',
    email: 'patient@caretrack.health',
    fullName: 'Margaret Thatcher',
    role: 'PATIENT',
  },
};

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
  role: UserRole;
  setRole: (r: UserRole) => void;
  authUser: AuthUser | null;
  lastUser: AuthUser | null;
  selectedPatient: Patient;
  setSelectedPatient: (p: Patient) => void;
  login: (user: AuthUser) => void;
  logout: () => void;
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
  const [selectedPatient, setSelectedPatientState] = useState<Patient>(() => {
    return load<Patient>('caretrack.selectedPatient', DEMO_PATIENTS[0]);
  });
  const [deviceId, setDeviceIdState] = useState(() => selectedPatient?.roomDeviceId || 'room-unit-01');
  const [thresholds, setThresholdsState] = useState<Thresholds>(() => load('caretrack.thresholds', DEFAULTS));
  const [profileName, setProfileNameState] = useState(() => load('caretrack.profile', 'Elderly Member') as string);
  
  // Last user remembered from previous login
  const [lastUser, setLastUserState] = useState<AuthUser | null>(() => {
    return load<AuthUser | null>('caretrack.lastLogin', null);
  });

  const [authUser, setAuthUserState] = useState<AuthUser | null>(() => {
    return load<AuthUser | null>('caretrack.authUser', null);
  });

  const [role, setRoleState] = useState<UserRole>(() => authUser?.role || lastUser?.role || 'CAREGIVER');

  useEffect(() => localStorage.setItem('caretrack.deviceId', JSON.stringify(deviceId)), [deviceId]);
  useEffect(() => localStorage.setItem('caretrack.thresholds', JSON.stringify(thresholds)), [thresholds]);
  useEffect(() => localStorage.setItem('caretrack.profile', JSON.stringify(profileName)), [profileName]);

  // Auto-sync patient thresholds from database whenever selected patient changes
  useEffect(() => {
    if (selectedPatient?.id) {
      fetchPatientThresholds(selectedPatient.id)
        .then((data) => {
          if (data) {
            setThresholdsState(data);
            localStorage.setItem('caretrack.thresholds', JSON.stringify(data));
          }
        })
        .catch(() => {});
    }
  }, [selectedPatient?.id]);

  
  useEffect(() => {
    if (authUser) {
      localStorage.setItem('caretrack.authUser', JSON.stringify(authUser));
      localStorage.setItem('caretrack.lastLogin', JSON.stringify(authUser));
      localStorage.setItem('caretrack.role', JSON.stringify(authUser.role));
      setLastUserState(authUser);
    } else {
      localStorage.removeItem('caretrack.authUser');
    }
  }, [authUser]);

  const setSelectedPatient = (p: Patient) => {
    setSelectedPatientState(p);
    setDeviceIdState(p.roomDeviceId);
    setProfileNameState(`${p.firstName} ${p.lastName}`);
    localStorage.setItem('caretrack.selectedPatient', JSON.stringify(p));
  };
  const setDeviceId = (d: string) => setDeviceIdState(d.trim() || 'room-unit-01');
  const setThresholds = (t: Thresholds) => setThresholdsState(t);
  const setProfileName = (n: string) => setProfileNameState(n);
  const setRole = (r: UserRole) => {
    setRoleState(r);
    if (authUser) {
      setAuthUserState({ ...authUser, role: r });
    }
  };

  const login = (user: AuthUser) => {
    setAuthUserState(user);
    setLastUserState(user);
    setRoleState(user.role);
    setProfileNameState(user.fullName);
    localStorage.setItem('caretrack.lastLogin', JSON.stringify(user));
  };

  const logout = () => {
    setAuthUserState(null);
    localStorage.removeItem('caretrack.authUser');
  };

  return (
    <Ctx.Provider
      value={{
        deviceId,
        setDeviceId,
        thresholds,
        setThresholds,
        profileName,
        setProfileName,
        role,
        setRole,
        authUser,
        lastUser,
        selectedPatient,
        setSelectedPatient,
        login,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
