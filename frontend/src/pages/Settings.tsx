import { useState, useEffect } from 'react';
import { useApp, DEMO_PATIENTS } from '../lib/store';
import { fetchPatientThresholds, savePatientThresholds } from '../lib/api';
import type { Thresholds } from '../lib/types';

export default function Settings({
  connected,
  mqttLive,
  deviceId,
}: {
  connected: boolean;
  mqttLive: boolean;
  deviceId: string;
}) {
  const { setThresholds, profileName, setProfileName, setDeviceId, role, authUser, selectedPatient, setSelectedPatient } = useApp();

  const isCaregiver = role === 'CAREGIVER';

  // Target patient for threshold configuration
  const [targetPatientId, setTargetPatientId] = useState<string>(() => {
    if (!isCaregiver && authUser?.role === 'PATIENT') {
      return 'p-001';
    }
    return selectedPatient?.id || 'p-001';
  });

  const activePatient = DEMO_PATIENTS.find((p) => p.id === targetPatientId) || DEMO_PATIENTS[0];

  // Threshold draft state for the selected patient
  const [draft, setDraft] = useState<Thresholds>({
    patientId: activePatient.id,
    hrMin: 50,
    hrMax: 110,
    spo2Min: 92,
    fallG: 3.0,
    roomTempMin: 18,
    roomTempMax: 28,
  });

  const [loadingThresholds, setLoadingThresholds] = useState<boolean>(false);
  const [savingThresholds, setSavingThresholds] = useState<boolean>(false);
  const [threshSavedMsg, setThreshSavedMsg] = useState<string | null>(null);
  const [threshError, setThreshError] = useState<string | null>(null);

  const [name, setName] = useState(profileName);
  const [dev, setDev] = useState(deviceId);
  const [saved, setSaved] = useState(false);

  // When target patient changes, fetch their tailored thresholds from PostgreSQL
  useEffect(() => {
    let cancelled = false;
    async function loadThresholds() {
      setLoadingThresholds(true);
      setThreshError(null);
      setThreshSavedMsg(null);
      try {
        const data = await fetchPatientThresholds(targetPatientId);
        if (!cancelled) {
          setDraft(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('[Settings] Failed to fetch thresholds from backend, using default fallback:', err);
          // Fallback to active state
          setDraft((prev) => ({
            ...prev,
            patientId: targetPatientId,
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingThresholds(false);
        }
      }
    }
    loadThresholds();
    return () => {
      cancelled = true;
    };
  }, [targetPatientId]);

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const handleSaveThresholds = async () => {
    if (draft.hrMin >= draft.hrMax) {
      setThreshError('Minimum heart rate must be less than maximum heart rate');
      return;
    }
    if (draft.roomTempMin >= draft.roomTempMax) {
      setThreshError('Minimum room temperature must be less than maximum room temperature');
      return;
    }

    setSavingThresholds(true);
    setThreshError(null);
    setThreshSavedMsg(null);
    try {
      const updated = await savePatientThresholds(targetPatientId, draft, authUser?.token);
      setDraft(updated);
      // Instantly sync active in-memory app store thresholds
      setThresholds(updated);
      setThreshSavedMsg(`Thresholds saved in database for ${activePatient.firstName} ${activePatient.lastName}`);
      window.setTimeout(() => setThreshSavedMsg(null), 4000);
    } catch (err: any) {
      const errStr = typeof err === 'string' ? err : err?.message || 'Failed to persist thresholds';
      setThreshError(String(errStr));
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleResetDefaults = () => {
    // Clinically tailored baselines
    let recommended: Thresholds;
    if (targetPatientId === 'p-001') {
      recommended = { patientId: 'p-001', hrMin: 55, hrMax: 100, spo2Min: 94, fallG: 2.8, roomTempMin: 19.0, roomTempMax: 26.0 };
    } else if (targetPatientId === 'p-002') {
      recommended = { patientId: 'p-002', hrMin: 50, hrMax: 95, spo2Min: 92, fallG: 3.0, roomTempMin: 20.0, roomTempMax: 27.0 };
    } else if (targetPatientId === 'p-003') {
      recommended = { patientId: 'p-003', hrMin: 60, hrMax: 110, spo2Min: 90, fallG: 2.2, roomTempMin: 21.0, roomTempMax: 26.5 };
    } else {
      recommended = { patientId: targetPatientId, hrMin: 50, hrMax: 110, spo2Min: 92, fallG: 3.0, roomTempMin: 18.0, roomTempMax: 28.0 };
    }
    setDraft(recommended);
  };

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>Settings</h1>
        <span className="page-desc">Profile, individual patient alert thresholds, and device connection status</span>
      </div>

      <div className="stack">
        {/* Profile & Pairing Panel */}
        <div className="panel">
          <div className="panel-head">
            <h2>{isCaregiver ? 'Caregiver Profile & Active Device' : 'My Profile & Wearable Info'}</h2>
          </div>
          <div className="kv">
            <div className="kv-row">
              <span className="k">Profile name</span>
              <span className="v">
                <input className="ct-input" value={name} onChange={(e) => setName(e.target.value)} />
              </span>
            </div>
            <div className="kv-row">
              <span className="k">Active Room Device ID</span>
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

        {/* Patient Vitals Range & Threshold Settings Panel */}
        <div className="panel">
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <h2>Patient Sensor Thresholds &amp; Safety Ranges</h2>
                <span className="hint">
                  {isCaregiver
                    ? 'Individual patient thresholds stored in database — calibrated for each condition'
                    : 'Your personal safety ranges (calibrated by your Care Taker)'}
                </span>
              </div>
              <span className="db-badge">
                <span className="db-dot"></span> PostgreSQL Synced
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 16px 0 16px' }}>
            <div className="role-note-banner">
              <span>
                {isCaregiver
                  ? '🩺 Care Taker Authorization: Select each patient to configure custom vital sign thresholds. Changes persist directly into the database.'
                  : '👤 Patient Portal: Thresholds are calibrated specifically for your medical condition by your Care Taker.'}
              </span>
            </div>
          </div>

          {/* Patient Selection Dropdown */}
          <div className="patient-selector-section">
            <div className="selector-bar">
              <div className="selector-title">
                <label htmlFor="patient-dropdown-select">
                  <strong>Select Patient:</strong>
                </label>
              </div>
              <div className="selector-input-wrap">
                <select
                  id="patient-dropdown-select"
                  className="ct-select patient-select-dropdown"
                  value={targetPatientId}
                  disabled={!isCaregiver}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setTargetPatientId(pid);
                    const p = DEMO_PATIENTS.find((item) => item.id === pid);
                    if (p && isCaregiver) {
                      // Also switch active patient context for monitoring
                      setSelectedPatient(p);
                    }
                  }}
                >
                  {DEMO_PATIENTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} — {p.roomNumber} ({p.condition.split(',')[0]})
                    </option>
                  ))}
                </select>
                {loadingThresholds && <span className="loading-badge">Loading DB...</span>}
              </div>
            </div>

            {/* Active Patient Snapshot Card */}
            <div className="patient-snapshot-card">
              <div className="snapshot-main">
                <span className="snapshot-avatar">
                  {activePatient.gender === 'Female' ? '👵' : '👴'}
                </span>
                <div className="snapshot-info">
                  <div className="snapshot-name">
                    <strong>{activePatient.firstName} {activePatient.lastName}</strong>
                    <span className="snapshot-room">{activePatient.roomNumber}</span>
                    <span className={`status-pill ${activePatient.status.toLowerCase()}`}>
                      {activePatient.status}
                    </span>
                  </div>
                  <div className="snapshot-condition">{activePatient.condition}</div>
                </div>
              </div>
              <div className="snapshot-meta">
                <div className="meta-item">
                  <span className="meta-label">Patient ID:</span>
                  <span className="meta-val">{activePatient.id}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Wearable:</span>
                  <span className="meta-val">{activePatient.wearableDeviceId}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Room Unit:</span>
                  <span className="meta-val">{activePatient.roomDeviceId}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Threshold Inputs */}
          <div className="kv" style={{ marginTop: '12px' }}>
            <div className="kv-row">
              <span className="k">
                <strong>Heart Rate Safe Floor (bpm)</strong>
                <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '11px' }}>
                  Alerts if resting heart rate drops below this level
                </small>
              </span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  min="30"
                  max="120"
                  value={draft.hrMin}
                  disabled={!isCaregiver || loadingThresholds}
                  onChange={(e) => setDraft({ ...draft, hrMin: num(e.target.value, draft.hrMin) })}
                  style={{ maxWidth: 120, opacity: isCaregiver ? 1 : 0.75 }}
                />{' '}
                <span className="unit-label">bpm</span>
              </span>
            </div>

            <div className="kv-row">
              <span className="k">
                <strong>Heart Rate Safe Ceiling (bpm)</strong>
                <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '11px' }}>
                  Alerts if resting heart rate exceeds this level
                </small>
              </span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  min="80"
                  max="220"
                  value={draft.hrMax}
                  disabled={!isCaregiver || loadingThresholds}
                  onChange={(e) => setDraft({ ...draft, hrMax: num(e.target.value, draft.hrMax) })}
                  style={{ maxWidth: 120, opacity: isCaregiver ? 1 : 0.75 }}
                />{' '}
                <span className="unit-label">bpm</span>
              </span>
            </div>

            <div className="kv-row">
              <span className="k">
                <strong>SpO2 Blood Oxygen Floor (%)</strong>
                <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '11px' }}>
                  Critical hypoxemia alarm triggers if SpO2 drops below this
                </small>
              </span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  min="70"
                  max="99"
                  value={draft.spo2Min}
                  disabled={!isCaregiver || loadingThresholds}
                  onChange={(e) => setDraft({ ...draft, spo2Min: num(e.target.value, draft.spo2Min) })}
                  style={{ maxWidth: 120, opacity: isCaregiver ? 1 : 0.75 }}
                />{' '}
                <span className="unit-label">%</span>
              </span>
            </div>

            <div className="kv-row">
              <span className="k">
                <strong>Fall Shock Impact Threshold (g-force)</strong>
                <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '11px' }}>
                  Accelerometer impact sensitivity (Lower = more sensitive for osteoporotic patients)
                </small>
              </span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  step="0.1"
                  min="1.5"
                  max="8.0"
                  value={draft.fallG ?? 3.0}
                  disabled={!isCaregiver || loadingThresholds}
                  onChange={(e) => setDraft({ ...draft, fallG: num(e.target.value, draft.fallG ?? 3.0) })}
                  style={{ maxWidth: 120, opacity: isCaregiver ? 1 : 0.75 }}
                />{' '}
                <span className="unit-label">g</span>
              </span>
            </div>

            <div className="kv-row">
              <span className="k">
                <strong>Room Comfort Temp Range (°C)</strong>
                <small style={{ display: 'block', color: 'var(--text-3)', fontSize: '11px' }}>
                  Ambient thermal comfort limits for hypothermia/heat-stress
                </small>
              </span>
              <span className="v">
                <input
                  className="ct-input"
                  type="number"
                  step="0.5"
                  value={draft.roomTempMin}
                  disabled={!isCaregiver || loadingThresholds}
                  onChange={(e) => setDraft({ ...draft, roomTempMin: num(e.target.value, draft.roomTempMin) })}
                  style={{ maxWidth: 80, opacity: isCaregiver ? 1 : 0.75 }}
                />{' '}
                —{' '}
                <input
                  className="ct-input"
                  type="number"
                  step="0.5"
                  value={draft.roomTempMax}
                  disabled={!isCaregiver || loadingThresholds}
                  onChange={(e) => setDraft({ ...draft, roomTempMax: num(e.target.value, draft.roomTempMax) })}
                  style={{ maxWidth: 80, opacity: isCaregiver ? 1 : 0.75 }}
                />{' '}
                <span className="unit-label">°C</span>
              </span>
            </div>
          </div>

          <div className="alert-actions" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {isCaregiver ? (
              <>
                <button
                  type="button"
                  className="ct-btn"
                  disabled={savingThresholds || loadingThresholds}
                  onClick={handleSaveThresholds}
                >
                  {savingThresholds ? 'Saving to Database...' : `Save Thresholds for ${activePatient.firstName}`}
                </button>
                <button
                  type="button"
                  className="ct-btn ct-btn-outline"
                  disabled={savingThresholds || loadingThresholds}
                  onClick={handleResetDefaults}
                  title="Reset to recommended clinical defaults for this condition"
                >
                  Clinical Baseline
                </button>
                {threshSavedMsg && <span className="delta rising">{threshSavedMsg} ✓</span>}
                {threshError && <span className="delta falling" style={{ color: '#ef4444' }}>{String(threshError)}</span>}
              </>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                Threshold configuration is restricted to Care Takers.
              </span>
            )}
          </div>
        </div>

        {/* Connection Status Panel */}
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
              <span className="k">Database Storage</span>
              <span className="v">🟢 Connected (PostgreSQL / Neon)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
