import CardioChart from '../components/CardioChart';
import type { useCardio } from '../lib/useCardio';

type Cardio = ReturnType<typeof useCardio>;

export interface FallState {
  magnitude: number;
  at: string;
  heightM?: number;
  category?: string;
}

// VIEW 2: CARDIAC TELEMETRY — DOM copied from backend/static/index.html
export default function CardioView({
  cardio,
  clock,
  fall,
}: {
  cardio: Cardio;
  clock: string;
  fall: FallState | null;
}) {
  const hasVitals = cardio.hr > 0 && cardio.spo2 > 0;
  const riskText = fall ? 'CRITICAL: FALL!' : hasVitals ? cardio.risk : 'Waiting';
  const riskStyle = fall
    ? { color: '#b4232a' }
    : hasVitals
      ? { color: cardio.riskColor }
      : { color: 'var(--text-3)' };

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>Wearable Vitals</h1>
        <span className="page-desc">Heart rate, oxygen and body temperature</span>
        <div className="meta">
          <span>{clock}</span>
          <span className="badge badge-normal">
            Online
          </span>
        </div>
      </div>

      <section className="kpis" aria-label="Cardiac vital readings">
        <div className="kpi card-heart">
          <div className="kpi-label">
            <span>Heart Rate</span>
            <div className="kpi-icon" aria-hidden="true">
              <svg
                className={cardio.pulsing ? 'pulsing' : undefined}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#134135"
                strokeWidth="2"
              >
                <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{cardio.hr > 0 ? cardio.hr : '--'}</span>
            <span className="kpi-unit">bpm</span>
          </div>
          <div className="kpi-foot">
            <span className={`badge ${cardio.hr > 0 ? cardio.bpmBadge.cls : 'idle'}`}>
              {cardio.hr > 0 ? cardio.bpmBadge.text : 'Waiting'}
            </span>
          </div>
        </div>

        <div className="kpi card-spo2">
          <div className="kpi-label">
            <span>Oxygen (SpO2)</span>
            <div className="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="#134135" strokeWidth="2">
                <path d="M3 12h3l2-5 3 10 2.5-7 1.5 2H21" />
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{cardio.spo2 > 0 ? cardio.spo2 : '--'}</span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-foot">
            <span className={`badge ${cardio.spo2 > 0 ? cardio.spo2Badge.cls : 'idle'}`}>
              {cardio.spo2 > 0 ? cardio.spo2Badge.text : 'Waiting'}
            </span>
          </div>
        </div>

        <div className="kpi card-temp">
          <div className="kpi-label">
            <span>Wearable Temperature</span>
            <div className="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="#134135" strokeWidth="2">
                <path d="M14 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z" />
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{cardio.temp > 0 ? cardio.temp.toFixed(1) : '--'}</span>
            <span className="kpi-unit">°C</span>
          </div>
          <div className="kpi-foot">
            <span className={`badge ${cardio.tempBadge.cls}`}>{cardio.tempBadge.text}</span>
          </div>
        </div>

        <div className="kpi card-risk">
          <div className="kpi-label">
            <span>Patient Status</span>
            <div className="kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="#134135" strokeWidth="2">
                <path d="M12 3 5 6v5c0 5 3.4 8.4 7 10 3.6-1.6 7-5 7-10V6l-7-3Z" />
                <path d="m9.5 12 1.8 1.8 3.2-3.6" />
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ fontSize: 24, ...riskStyle }}>
              {riskText}
            </span>
          </div>
          <div className="kpi-foot">
            <span className="delta">{cardio.lastUpdate}</span>
          </div>
        </div>
      </section>

      <section className="charts-grid single">
        <div className="chart-card">
          <div className="card-header">
            <span className="card-label">Telemetry History</span>
          </div>
          <div className="chart-container">
            <CardioChart points={cardio.points} />
          </div>
        </div>
      </section>
    </div>
  );
}
