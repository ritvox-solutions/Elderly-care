import { useMemo, useState } from 'react';
import HistoryChart from '../components/HistoryChart';
import type { useCardio } from '../lib/useCardio';
import type { useRoom } from '../lib/useRoom';

const METRICS = [
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', color: '#b4232a' },
  { key: 'spo2', label: 'SpO2', unit: '%', color: '#1a5c4c' },
  { key: 'temperature', label: 'Room Temp', unit: '°C', color: '#92600a' },
  { key: 'humidity', label: 'Humidity', unit: '%', color: '#4b5f5a' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

export default function History({
  room,
  cardio,
}: {
  room: ReturnType<typeof useRoom>;
  cardio: ReturnType<typeof useCardio>;
}) {
  const [metric, setMetric] = useState<MetricKey>('heart_rate');
  const [range, setRange] = useState<'all' | '30' | '60'>('all');

  const meta = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  const points = useMemo(() => {
    let pts: { t: number; v: number }[] = [];
    if (metric === 'heart_rate') pts = cardio.buffer.map((p) => ({ t: p.t, v: p.hr }));
    else if (metric === 'spo2') pts = cardio.buffer.map((p) => ({ t: p.t, v: p.spo2 }));
    else if (metric === 'temperature')
      pts = room.buffer.filter((p) => p.temp !== undefined).map((p) => ({ t: p.t, v: p.temp as number }));
    else pts = room.buffer.filter((p) => p.hum !== undefined).map((p) => ({ t: p.t, v: p.hum as number }));
    if (range !== 'all') pts = pts.slice(-Number(range));
    return pts;
  }, [metric, range, cardio.buffer, room.buffer]);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const vs = points.map((p) => p.v);
    return {
      min: Math.min(...vs),
      max: Math.max(...vs),
      avg: vs.reduce((a, b) => a + b, 0) / vs.length,
      n: vs.length,
    };
  }, [points]);

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>History</h1>
        <span className="page-desc">Session buffer · min / avg / max per metric</span>
        <div className="meta">
          <span>
            {points.length} sample{points.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Metrics" style={{ marginBottom: 12, alignSelf: 'flex-start' }}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`nav-tab${metric === m.key ? ' active' : ''}`}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {(['all', '30', '60'] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={`nav-tab${range === r ? ' active' : ''}`}
            onClick={() => setRange(r)}
          >
            {r === 'all' ? 'All' : `Last ${r}`}
          </button>
        ))}
      </nav>

      <section className="charts-grid" style={{ marginTop: 0 }}>
        <div className="chart-card">
          <div className="card-header">
            <span className="card-label">
              {meta.label} ({meta.unit})
            </span>
          </div>
          <div className="chart-container">
            {points.length < 2 ? (
              <div className="log-empty">
                No buffered points for {meta.label} yet — keep a monitor tab open while the
                simulator publishes.
              </div>
            ) : (
              <HistoryChart points={points} color={meta.color} label={`${meta.label} (${meta.unit})`} />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Summary</h2>
          </div>
          {stats ? (
            <div className="kv">
              <div className="kv-row">
                <span className="k">Min</span>
                <span className="v">
                  {stats.min.toFixed(1)} {meta.unit}
                </span>
              </div>
              <div className="kv-row">
                <span className="k">Average</span>
                <span className="v">
                  {stats.avg.toFixed(1)} {meta.unit}
                </span>
              </div>
              <div className="kv-row">
                <span className="k">Max</span>
                <span className="v">
                  {stats.max.toFixed(1)} {meta.unit}
                </span>
              </div>
              <div className="kv-row">
                <span className="k">Samples</span>
                <span className="v">{stats.n}</span>
              </div>
            </div>
          ) : (
            <div className="fresh-note">Awaiting samples…</div>
          )}
        </div>
      </section>

      <footer className="meta">
        <span>note: FastAPI currently exposes only GET /readings/latest</span>
        <span>history here is the live session buffer (last 120 points)</span>
      </footer>
    </div>
  );
}
