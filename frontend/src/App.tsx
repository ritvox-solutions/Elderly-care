import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
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
import CardioView, { type FallState } from './views/CardioView';
import DualView from './views/DualView';
import RoomView from './views/RoomView';

function Shell() {
  const { deviceId, setDeviceId } = useApp();
  const [activeId, setActiveId] = useState(deviceId);
  const [fall, setFall] = useState<FallState | null>(null);
  const lastFallRef = useRef(0);
  const feedRowRef = useRef<((metric: string, value: string, ts: string) => void) | null>(null);

  // showFallAlert() — copied from backend/static/index.html (5s debounce + alarm)
  const handleFall = useCallback((magnitude: number) => {
    const now = Date.now();
    if (now - lastFallRef.current < 5000) return; // skip duplicates
    lastFallRef.current = now;
    const at = new Date().toISOString();
    setFall({ magnitude, at });
    playEmergencyAlarm();
    feedRowRef.current?.('FALL_DETECTED', `${magnitude.toFixed(2)} SHOCK`, at);
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

  return (
    <>
      <Chrome
        deviceId={activeId}
        onConnect={(id) => {
          setDeviceId(id);
          setActiveId(id.trim() || 'room-unit-01');
        }}
        connText={room.conn.text}
        connMode={room.conn.mode}
        mqttText={cardio.mqttConn.text}
        mqttMode={cardio.mqttConn.mode}
      />
      {fall && (
        <FallBanner magnitude={fall.magnitude} at={fall.at} onDismiss={() => setFall(null)} />
      )}
      <main>
        <Routes>
          <Route
            path="/"
            element={
              <RoomView
                room={room}
                deviceId={activeId}
                clock={clockStr(now)}
                tz={tz}
                sessionSince={sessionSince}
                now={now}
              />
            }
          />
          <Route path="/cardio" element={<CardioView cardio={cardio} clock={clockStr(now)} fall={fall} />} />
          <Route path="/dual" element={<DualView room={room} cardio={cardio} fall={fall} now={now} />} />
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
