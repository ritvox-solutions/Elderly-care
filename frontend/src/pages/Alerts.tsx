import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import type { FallState } from '../views/CardioView';

interface AlertItem {
  id: string;
  type: string;
  severity: 'WATCH' | 'CRITICAL';
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
}

function loadAlerts(): AlertItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem('caretrack.alerts') ?? '[]') as AlertItem[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function Alerts({
  fall,
  hr,
  spo2,
  deviceId,
}: {
  fall: FallState | null;
  hr: number;
  spo2: number;
  deviceId: string;
}) {
  const { thresholds } = useApp();
  const [alerts, setAlerts] = useState<AlertItem[]>(loadAlerts);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [responder, setResponder] = useState('Caregiver');

  useEffect(() => {
    try {
      localStorage.setItem('caretrack.alerts', JSON.stringify(alerts.slice(0, 100)));
    } catch {
      /* storage unavailable */
    }
  }, [alerts]);

  // Fall → CRITICAL alert (same trigger as the banner)
  useEffect(() => {
    if (!fall) return;
    setAlerts((prev) => {
      if (prev.some((a) => a.id === `fall-${fall.at}`)) return prev;
      return [
        {
          id: `fall-${fall.at}`,
          type: 'Fall Detected',
          severity: 'CRITICAL' as const,
          message: `High-G impact fall (${fall.magnitude.toFixed(2)}g) on ${deviceId}. Immediate caregiver response dispatched!`,
          timestamp: fall.at,
          status: 'active' as const,
        },
        ...prev,
      ].slice(0, 100);
    });
  }, [fall, deviceId]);

  // Threshold engine — CRITICAL on fixed clinical floors, WATCH on caregiver thresholds
  useEffect(() => {
    const now = new Date().toISOString();
    setAlerts((prev) => {
      const next = [...prev];
      const has = (t: string) => next.some((a) => a.type === t && a.status === 'active');
      if (hr > 0 && (hr < 40 || hr > 130) && !has('Abnormal Heart Rate')) {
        next.unshift({
          id: `hr-${now}`,
          type: 'Abnormal Heart Rate',
          severity: 'CRITICAL' as const,
          message: `Heart rate ${hr} bpm outside survivable bounds on ${deviceId}.`,
          timestamp: now,
          status: 'active' as const,
        });
      } else if (
        hr > 0 &&
        (hr < thresholds.hrMin || hr > thresholds.hrMax) &&
        !has('Heart Rate Watch')
      ) {
        next.unshift({
          id: `hrw-${now}`,
          type: 'Heart Rate Watch',
          severity: 'WATCH' as const,
          message: `Heart rate ${hr} bpm outside safe range ${thresholds.hrMin}–${thresholds.hrMax} bpm.`,
          timestamp: now,
          status: 'active' as const,
        });
      }
      if (spo2 > 0 && spo2 < 90 && !has('Low SpO2')) {
        next.unshift({
          id: `spo2-${now}`,
          type: 'Low SpO2',
          severity: 'CRITICAL' as const,
          message: `SpO2 ${spo2}% below critical floor (90%) on ${deviceId}.`,
          timestamp: now,
          status: 'active' as const,
        });
      } else if (spo2 > 0 && spo2 < thresholds.spo2Min && !has('SpO2 Watch')) {
        next.unshift({
          id: `spo2w-${now}`,
          type: 'SpO2 Watch',
          severity: 'WATCH' as const,
          message: `SpO2 ${spo2}% below watch threshold (${thresholds.spo2Min}%).`,
          timestamp: now,
          status: 'active' as const,
        });
      }
      return next.slice(0, 100);
    });
  }, [hr, spo2, thresholds, deviceId]);

  const visible = alerts.filter((a) => (filter === 'all' ? true : a.status !== 'resolved'));

  const setStatus = (id: string, status: AlertItem['status']) =>
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status, acknowledgedBy: status === 'active' ? undefined : responder } : a,
      ),
    );

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>Alerts</h1>
        <span className="page-desc">Direct, calm, factual — fall, SpO2 and heart-rate watch</span>
        <div className="meta">
          <span>
            {alerts.filter((a) => a.status !== 'resolved').length} open
          </span>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Alert filter" style={{ marginBottom: 12, alignSelf: 'flex-start' }}>
        <button
          type="button"
          className={`nav-tab${filter === 'active' ? ' active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active only
        </button>
        <button
          type="button"
          className={`nav-tab${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All history
        </button>
      </nav>

      {visible.length === 0 ? (
        <div className="panel">
          <div className="fresh-note">No alerts — everything&apos;s been steady.</div>
        </div>
      ) : (
        <div className="stack">
          {visible.map((a) => (
            <div className="panel" key={a.id}>
              <div className="panel-head">
                <h2>
                  {a.severity === 'CRITICAL' ? '🔴' : '🟡'} {a.type}
                </h2>
                <span className="hint">{new Date(a.timestamp).toLocaleString()}</span>
                <span className={`badge ${a.severity === 'CRITICAL' ? 'alert' : 'stale'}`}>
                  {a.severity}
                </span>
                <span
                  className={`badge ${
                    a.status === 'resolved' ? 'idle' : a.status === 'acknowledged' ? 'stale' : 'alert'
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <div className="kv">
                <div className="kv-row">
                  <span className="k">Detail</span>
                  <span className="v" style={{ fontFamily: 'inherit', fontSize: 13 }}>
                    {a.message}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">Device</span>
                  <span className="v">{deviceId}</span>
                </div>
                {a.acknowledgedBy && (
                  <div className="kv-row">
                    <span className="k">Responder</span>
                    <span className="v">Got it — {a.acknowledgedBy} is responding.</span>
                  </div>
                )}
                {a.status === 'active' && (
                  <div className="kv-row">
                    <span className="k">Your name</span>
                    <span className="v">
                      <input
                        className="ct-input"
                        value={responder}
                        onChange={(e) => setResponder(e.target.value)}
                        style={{ maxWidth: 160, textAlign: 'right' }}
                      />
                    </span>
                  </div>
                )}
              </div>
              {a.status !== 'resolved' && (
                <div className="alert-actions">
                  {a.status === 'active' && (
                    <button type="button" className="ct-btn" onClick={() => setStatus(a.id, 'acknowledged')}>
                      I&apos;m Responding
                    </button>
                  )}
                  {a.status === 'acknowledged' && (
                    <button
                      type="button"
                      className="ct-btn-ghost"
                      onClick={() => setStatus(a.id, 'resolved')}
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
