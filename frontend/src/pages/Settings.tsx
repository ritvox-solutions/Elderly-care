import { useState } from 'react';
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
  const { thresholds, setThresholds, profileName, setProfileName, setDeviceId, role } = useApp();
  const [draft, setDraft] = useState(thresholds);
  const [name, setName] = useState(profileName);
  const [dev, setDev] = useState(deviceId);
  const [saved, setSaved] = useState(false);
  const [threshSaved, setThreshSaved] = useState(false);

  const isCaregiver = role === 'CAREGIVER';

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
            <h2>{isCaregiver ? 'Patient Profile & Device Pairing' : 'My Profile & Wearable Info'}</h2>
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
                  disabled={!isCaregiver}
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
                if (dev.trim() && isCaregiver) setDeviceId(dev.trim());
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
            <span className="hint">
              {isCaregiver
                ? 'Care Taker access: calibrated safety thresholds for alerts'
                : 'Managed by Care Taker (view-only)'}
            </span>
          </div>

          <div style={{ padding: '10px 16px 0 16px' }}>
            <div className="role-note-banner">
              <span>
                {isCaregiver
                  ? '🩺 Care Taker Authorization: You have access to configure sensor value ranges and alert trigger thresholds.'
                  : '👤 Patient Portal: Thresholds are calibrated by your assigned Care Taker. You can review your safe ranges below.'}
              </span>
            </div>
          </div>

          <div className="kv">
            <div className="kv-row">
              <span className="k">Heart rate safe min (bpm)</span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  value={draft.hrMin}
                  disabled={!isCaregiver}
                  onChange={(e) => setDraft({ ...draft, hrMin: num(e.target.value, draft.hrMin) })}
                  style={{ maxWidth: 120, opacity: isCaregiver ? 1 : 0.75 }}
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
                  disabled={!isCaregiver}
                  onChange={(e) => setDraft({ ...draft, hrMax: num(e.target.value, draft.hrMax) })}
                  style={{ maxWidth: 120, opacity: isCaregiver ? 1 : 0.75 }}
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
                  disabled={!isCaregiver}
                  onChange={(e) => setDraft({ ...draft, spo2Min: num(e.target.value, draft.spo2Min) })}
                  style={{ maxWidth: 120, opacity: isCaregiver ? 1 : 0.75 }}
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
                  disabled={!isCaregiver}
                  onChange={(e) => setDraft({ ...draft, roomTempMin: num(e.target.value, draft.roomTempMin) })}
                  style={{ maxWidth: 80, opacity: isCaregiver ? 1 : 0.75 }}
                />{' '}
                —{' '}
                <input
                  className="ct-input"
                  type="number"
                  value={draft.roomTempMax}
                  disabled={!isCaregiver}
                  onChange={(e) => setDraft({ ...draft, roomTempMax: num(e.target.value, draft.roomTempMax) })}
                  style={{ maxWidth: 80, opacity: isCaregiver ? 1 : 0.75 }}
                />
              </span>
            </div>
          </div>
          <div className="alert-actions">
            {isCaregiver ? (
              <>
                <button
                  type="button"
                  className="ct-btn"
                  onClick={() => {
                    setThresholds(draft);
                    setThreshSaved(true);
                    window.setTimeout(() => setThreshSaved(false), 2000);
                  }}
                >
                  Save thresholds
                </button>
                {threshSaved && <span className="delta rising">Thresholds updated ✓</span>}
              </>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                Threshold configuration is restricted to Care Takers.
              </span>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Connection &amp; Sensor Status</h2>
          </div>
          <div className="kv">
            <div className="kv-row">
              <span className="k">Room Environmental Monitor</span>
              <span className="v">{connected ? '🟢 Connected (Online)' : '🟡 Connecting...'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Wearable Cardiac &amp; Fall Sensor</span>
              <span className="v">{mqttLive ? '🟢 Connected (Live Stream)' : '🟡 Connecting...'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Cloud Telemetry Service</span>
              <span className="v">🟢 Secure &amp; Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
