import { ago, fmtF } from '../lib/format';
import type { useCardio } from '../lib/useCardio';
import type { useRoom } from '../lib/useRoom';
import type { FallState } from './CardioView';

// VIEW 3: DUAL OVERVIEW — DOM copied from backend/static/index.html
export default function DualView({
  room,
  cardio,
  fall,
  now,
}: {
  room: ReturnType<typeof useRoom>;
  cardio: ReturnType<typeof useCardio>;
  fall: FallState | null;
  now: Date;
}) {
  const stale = room.lastSeenTs ? now.getTime() - new Date(room.lastSeenTs).getTime() > 90000 : true;
  const link = { text: stale ? 'Stale' : 'Online', cls: stale ? 'badge stale' : 'badge ok' };
  const riskText = fall ? 'CRITICAL: FALL!' : cardio.risk;
  const riskStyle = fall ? { color: '#b4232a' } : { color: cardio.riskColor };

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>Dual Patient Overview</h1>
        <span className="page-desc">Simultaneous Room &amp; Cardiac Monitoring</span>
      </div>

      <div className="dual-grid">
        <div>
          <div className="dual-section-title">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />
            </svg>
            Cardiac Vitals Telemetry
          </div>
          <div className="kpis">
            <div className="kpi">
              <div className="kpi-label">Heart Rate</div>
              <div className="kpi-value-row">
                <span className="kpi-value">{cardio.hr > 0 ? cardio.hr : '--'}</span>
                <span className="kpi-unit">bpm</span>
              </div>
              <div className="kpi-foot">
                <span className={`badge ${cardio.bpmBadge.cls}`}>{cardio.bpmBadge.text}</span>
                <span className="delta">Wearable</span>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Oxygen (SpO2)</div>
              <div className="kpi-value-row">
                <span className="kpi-value">{cardio.spo2 > 0 ? cardio.spo2 : '--'}</span>
                <span className="kpi-unit">%</span>
              </div>
              <div className="kpi-foot">
                <span className={`badge ${cardio.spo2Badge.cls}`}>{cardio.spo2Badge.text}</span>
                <span className="delta">Pulse-Ox</span>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Sensor Temp</div>
              <div className="kpi-value-row">
                <span className="kpi-value">{cardio.temp.toFixed(1)}</span>
                <span className="kpi-unit">°C</span>
              </div>
              <div className="kpi-foot">
                <span className="delta">Skin Temp</span>
                <span className="delta">Celsius</span>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Clinical Risk</div>
              <div className="kpi-value-row">
                <span className="kpi-value" style={{ fontSize: 24, ...riskStyle }}>
                  {riskText}
                </span>
              </div>
              <div className="kpi-foot">
                <span className="delta">{cardio.lastUpdate}</span>
                <span className="delta">Risk score</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="dual-section-title">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            Room Environmental Telemetry
          </div>
          <div className="kpis">
            <div className="kpi">
              <div className="kpi-label">Temperature</div>
              <div className="kpi-value-row">
                <span className="kpi-value">
                  {room.temp !== null ? (
                    <>
                      {room.temp.toFixed(1)}
                      <span className="unit"> °C</span>
                    </>
                  ) : (
                    <>
                      --<span className="unit"> °C</span>
                    </>
                  )}
                </span>
              </div>
              <div className="kpi-foot">
                <span className={room.tempTrendCls}>{room.tempTrend}</span>
                <span className={room.tempFlag.cls}>{room.tempFlag.text}</span>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Humidity</div>
              <div className="kpi-value-row">
                <span className="kpi-value">
                  {room.hum !== null ? (
                    <>
                      {room.hum.toFixed(1)}
                      <span className="unit"> %</span>
                    </>
                  ) : (
                    <>
                      --<span className="unit"> %</span>
                    </>
                  )}
                </span>
              </div>
              <div className="kpi-foot">
                <span className="delta">{room.humDelta}</span>
                <span className={room.humFlag.cls}>{room.humFlag.text}</span>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Motion Presence</div>
              <div className="kpi-value-row">
                <span className="kpi-value" style={{ fontSize: 22 }}>
                  {room.motion === null ? '--' : room.motion > 0.5 ? 'Detected' : 'No motion'}
                </span>
              </div>
              <div className="kpi-foot">
                <span className="delta">
                  {room.lastMotionTs ? `last event ${ago(room.lastMotionTs)}` : 'no events'}
                </span>
                <span className={room.motionBadge.cls}>{room.motionBadge.text}</span>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Unit Status</div>
              <div className="kpi-value-row">
                <span className="kpi-value" style={{ fontSize: 18 }}>
                  {room.lastSeenTs ? fmtF(room.lastSeenTs) : '--'}
                </span>
              </div>
              <div className="kpi-foot">
                <span className={link.cls}>{link.text}</span>
                <span className="delta">
                  {room.lastSeenTs ? `updated ${ago(room.lastSeenTs)}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
