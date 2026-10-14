import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Chrome from './components/Chrome';
import FallBanner from './components/FallBanner';
import { playEmergencyAlarm } from './lib/alarm';
import { pad } from './lib/format';
import { useApp } from './lib/store';
import { useCardio } from './lib/useCardio';
import { useNow, clockStr, tzName } from './lib/useNow';
import { useRoom } from './lib/useRoom';
import Alerts from './pages/Alerts';
import History from './pages/History';
import Settings from './pages/Settings';
import PatientsPage from './pages/PatientsPage';
import AuthPage from './pages/AuthPage';
import CardioView, { type FallState } from './views/CardioView';

function Shell() {
  const { deviceId, role, setRole, authUser, selectedPatient, login, logout } = useApp();
  const [activeId, setActiveId] = useState(deviceId);
  const [fall, setFall] = useState<FallState | null>(null);
  const lastFallRef = useRef(0);
  const feedRowRef = useRef<((metric: string, value: string, ts: string) => void) | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // showFallAlert() — 5s debounce + alarm with height estimation
  const handleFall = useCallback((magnitude: number, heightM?: number, category?: string) => {
    const now = Date.now();
    if (now - lastFallRef.current < 5000) return;
    lastFallRef.current = now;
    const at = new Date().toISOString();
    const estHeight = heightM || Math.min(2.2, Math.max(0.3, Math.pow(Math.max(0, magnitude - 1.0), 1.35) * 0.09));
    const estCat = category || (estHeight < 0.5 ? 'Low Level' : estHeight < 0.95 ? 'Bed/Chair Height' : 'Standing Height');
    setFall({ magnitude, at, heightM: estHeight, category: estCat });
    playEmergencyAlarm();
    feedRowRef.current?.('FALL_DETECTED', `${magnitude.toFixed(2)}g (~${estHeight.toFixed(2)}m)`, at);
  }, []);

  const cardio = useCardio(handleFall);
  const room = useRoom(activeId, {
    onFall: handleFall,
    onDbVitals: cardio.hydrateDb,
  });

  useEffect(() => {
    feedRowRef.current = room.addFeedRow;
  });

  useEffect(() => {
    setActiveId(deviceId);
  }, [deviceId]);

  const now = useNow(1000);
  const [tz] = useState(tzName);
  const [sessionSince] = useState(() => {
    const d = new Date();
    return `since ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const toggleRole = () => {
    setRole(role === 'CAREGIVER' ? 'PATIENT' : 'CAREGIVER');
  };

  const isAuthRoute = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup';

  // When visiting http://localhost:5173/ or /login or /signup, ALWAYS show the AuthPage based on previous login
  if (isAuthRoute) {
    return (
      <AuthPage
        onLogin={(user) => {
          login(user);
          navigate(user.role === 'PATIENT' ? '/cardio' : '/patients');
        }}
        initialMode={location.pathname === '/signup' ? 'signup' : 'login'}
      />
    );
  }

  // If on a dashboard route (/room, /cardio, etc.) without an authenticated user, prompt login
  if (!authUser) {
    return (
      <AuthPage
        onLogin={(user) => {
          login(user);
          navigate(user.role === 'PATIENT' ? '/cardio' : '/patients');
        }}
      />
    );
  }

  return (
    <>
      <div className="app-top">
        <Chrome
          connMode={room.conn.mode}
          mqttMode={cardio.mqttConn.mode}
          role={role}
          authUser={authUser}
          selectedPatient={selectedPatient}
          onToggleRole={toggleRole}
          onLogout={() => {
            logout();
            navigate('/');
          }}
        />
        {fall && (
          <FallBanner magnitude={fall.magnitude} at={fall.at} heightM={fall.heightM} category={fall.category} onDismiss={() => setFall(null)} />
        )}
      </div>
      <main>
        <Routes>
          {/* Room Unit & Cardiac pages removed from the caregiver navbar —
              their UI now lives inside the patient data page (PatientMonitor).
              Keep old links working via redirects. */}
          <Route path="/room" element={<Navigate to={role === 'PATIENT' ? '/cardio' : '/patients'} replace />} />
          <Route
            path="/patients"
            element={<PatientsPage room={room} cardio={cardio} fall={fall} now={now} />}
          />
          <Route
            path="/cardio"
            element={
              role === 'PATIENT' ? (
                <CardioView cardio={cardio} clock={clockStr(now)} fall={fall} />
              ) : (
                <Navigate to="/patients" replace />
              )
            }
          />
          {/* Legacy Dual Overview page removed — its content now lives inline
              on the Patients Directory. Keep old links/bookmarks working. */}
          <Route path="/dual" element={<Navigate to="/patients" replace />} />
          <Route path="/history" element={<History room={room} cardio={cardio} />} />
          <Route
            path="/alerts"
            element={<Alerts fall={fall} hr={cardio.hr} spo2={cardio.spo2} deviceId={activeId} />}
          />
          <Route
            path="/settings"
            element={
              <Settings
                connected={room.conn.mode === 'live'}
                mqttLive={cardio.mqttConn.mode === 'live'}
                deviceId={activeId}
              />
            }
          />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
