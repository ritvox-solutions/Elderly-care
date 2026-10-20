import { useEffect, useState } from 'react';
import type { WsAlertMessage } from '../lib/types';

interface AlertItem {
  id: string;
  type: string;
  severity: 'WATCH' | 'CRITICAL';
  message: string;
  timestamp: string;
  deviceId?: string;
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
  backendAlert,
}: {
  backendAlert: WsAlertMessage | null;
}) {
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

  useEffect(() => {
    if (!backendAlert) return;
    setAlerts((previous) => {
      if (previous.some((alert) => alert.id === backendAlert.alert_id)) return previous;
      return [
        {
          id: backendAlert.alert_id,
          type: backendAlert.metric === 'ampv_verified'
            ? 'AMPV Verified Emergency'
            : backendAlert.metric.replaceAll('_', ' '),
          severity: backendAlert.severity === 'CRITICAL' ? 'CRITICAL' as const : 'WATCH' as const,
          message: backendAlert.message,
          timestamp: backendAlert.timestamp,
          deviceId: backendAlert.device_id,
          status: 'active' as const,
        },
        ...previous,
      ].slice(0, 100);
    });
  }, [backendAlert]);

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
