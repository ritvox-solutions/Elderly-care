import { useState } from 'react';
import { fetchHealth } from '../lib/api';
import { useApp } from '../lib/store';

export default function Settings({
  connected,
  mqttLive,
  deviceId,
}: {
  connected: boolean;
  mqttLive: boolean;
  deviceId: string;
}) {
  const { thresholds, setThresholds, profileName, setProfileName, setDeviceId } = useApp();
  const [draft, setDraft] = useState(thresholds);
  const [name, setName] = useState(profileName);
  const [dev, setDev] = useState(deviceId);
  const [health, setHealth] = useState('not checked');
  const [saved, setSaved] = useState(false);

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>Settings</h1>
        <span className="page-desc">Profile, alert thresholds, device &amp; backend status</span>
      </div>

      <div className="stack">
        <div className="panel">
          <div className="panel-head">
            <h2>Elderly Profile &amp; Device Pairing</h2>
          </div>
          <div className="kv">
            <div className="kv-row">
              <span className="k">Profile name</span>
              <span className="v">
                <input className="ct-input" value={name} onChange={(e) => setName(e.target.value)} />
              </span>
            </div>
            <div className="kv-row">
              <span className="k">Device ID</span>
              <span className="v">
                <input
                  className="ct-input"
                  value={dev}
                  onChange={(e) => setDev(e.target.value)}
                  placeholder="room-unit-01"
                />
              </span>
            </div>
          </div>
          <div className="alert-actions">
            <button
              type="button"
              className="ct-btn"
              onClick={() => {
                setProfileName(name.trim() || 'Elderly Member');
                if (dev.trim()) setDeviceId(dev.trim());
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2000);
              }}
            >
              Save profile
            </button>
            {saved && <span className="delta rising">Saved ✓</span>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Threshold Settings</h2>
            <span className="hint">drives the Alerts tab watch rules</span>
          </div>
          <div className="kv">
            <div className="kv-row">
              <span className="k">Heart rate safe min (bpm)</span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  value={draft.hrMin}
                  onChange={(e) => setDraft({ ...draft, hrMin: num(e.target.value, draft.hrMin) })}
                  style={{ maxWidth: 120 }}
                />
              </span>
            </div>
            <div className="kv-row">
              <span className="k">Heart rate safe max (bpm)</span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  value={draft.hrMax}
                  onChange={(e) => setDraft({ ...draft, hrMax: num(e.target.value, draft.hrMax) })}
                  style={{ maxWidth: 120 }}
                />
              </span>
            </div>
            <div className="kv-row">
              <span className="k">SpO2 watch threshold (%)</span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  value={draft.spo2Min}
                  onChange={(e) => setDraft({ ...draft, spo2Min: num(e.target.value, draft.spo2Min) })}
                  style={{ maxWidth: 120 }}
                />
              </span>
            </div>
            <div className="kv-row">
              <span className="k">Room temp range (°C)</span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  value={draft.roomTempMin}
                  onChange={(e) => setDraft({ ...draft, roomTempMin: num(e.target.value, draft.roomTempMin) })}
                  style={{ maxWidth: 80 }}
                />{' '}
                –{' '}
                <input
                  className="ct-input"
                  type="number"
                  value={draft.roomTempMax}
                  onChange={(e) => setDraft({ ...draft, roomTempMax: num(e.target.value, draft.roomTempMax) })}
                  style={{ maxWidth: 80 }}
                />
              </span>
            </div>
          </div>
          <div className="alert-actions">
            <button type="button" className="ct-btn" onClick={() => setThresholds(draft)}>
              Save thresholds
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Device Status</h2>
          </div>
          <div className="kv">
            <div className="kv-row">
              <span className="k">Room link (WebSocket /ws/live)</span>
              <span className="v">{connected ? 'Live' : 'Reconnecting…'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Cardiac link (HiveMQ Cloud TLS)</span>
              <span className="v">{mqttLive ? 'HiveMQ Live' : 'Reconnecting…'}</span>
            </div>
            <div className="kv-row">
              <span className="k">REST backend</span>
              <span className="v">{String(import.meta.env.VITE_API_URL || '(same-origin + :8000 fallback)')}</span>
            </div>
            <div className="kv-row">
              <span className="k">GET /health</span>
              <span className="v">{health}</span>
            </div>
          </div>
          <div className="alert-actions">
            <button
              type="button"
              className="ct-btn-ghost"
              onClick={async () => {
                try {
                  setHealth(JSON.stringify(await fetchHealth()));
                } catch (e) {
                  setHealth(`error: ${(e as Error).message}`);
                }
              }}
            >
              Check backend health
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
