import { useApp } from '../lib/store';
import Spark from '../components/Spark';
import { ago, fmtT } from '../lib/format';
import type { useRoom } from '../lib/useRoom';

type Room = ReturnType<typeof useRoom>;

// VIEW 1: ROOM UNIT — DOM copied from backend/static/index.html
export default function RoomView({
  room,
  clock,
  now,
}: {
  room: Room;
  clock: string;
  now: Date;
}) {
  const { thresholds } = useApp();
  const stale = room.lastSeenTs ? now.getTime() - new Date(room.lastSeenTs).getTime() > 90000 : true;
  const link = { text: stale ? 'Stale' : 'Online', cls: stale ? 'badge stale' : 'badge ok' };

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>Room Environment</h1>
        <span className="page-desc">Temperature, humidity and movement</span>
        <div className="meta">
          <span>{clock}</span>
        </div>
      </div>

      <section className="kpis" aria-label="Room telemetry readings">
        <div className="kpi">
          <div className="kpi-label">
            <span>Temperature</span>
            <span className={room.tempFlag.cls}>{room.tempFlag.text}</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value" aria-live="polite">
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
            </div>
          </div>
          <div className="kpi-sub">
            {room.tempTs ? `Updated ${fmtT(room.tempTs)}` : 'Waiting for data'}
            {thresholds ? ` · Safe: ${thresholds.roomTempMin}–${thresholds.roomTempMax}°C` : ''}
          </div>
          <div className="kpi-foot">
            <span className={room.tempTrendCls}>{room.tempTrend}</span>
            <Spark data={room.tempHist} />
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span>Humidity</span>
            <span className={room.humFlag.cls}>{room.humFlag.text}</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value" aria-live="polite">
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
            </div>
          </div>
          <div className="kpi-sub">{room.humTs ? `Updated ${fmtT(room.humTs)}` : 'Waiting for data'}</div>
          <div className="kpi-foot">
            <span className="delta">{room.humDelta}</span>
            <Spark data={room.humHist} />
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span>Motion Presence</span>
            <span className={room.motionBadge.cls}>{room.motionBadge.text}</span>
          </div>
          <div className="kpi-value-row">
            <div className="kpi-value" aria-live="polite" style={{ fontSize: 24, paddingTop: 4 }}>
              {room.motion === null ? '--' : room.motion > 0.5 ? 'Detected' : 'No motion'}
            </div>
          </div>
          <div className="kpi-sub">{room.motionTs ? `Updated ${fmtT(room.motionTs)}` : 'Waiting for data'}</div>
          <div className="kpi-foot">
            <span className="delta">
              {room.lastMotionTs ? `last event ${ago(room.lastMotionTs)}` : 'no events'}
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span>Room Status</span>
            <span className={link.cls}>{link.text}</span>
          </div>
          <div className="kpi-value-row">
            <div
              className="kpi-value"
              style={{ fontSize: 18, paddingTop: 6, fontFamily: 'var(--mono)', fontWeight: 600 }}
            >
              {room.lastSeenTs ? fmtT(room.lastSeenTs) : '--'}
            </div>
          </div>
          <div className="kpi-sub">
            {room.lastSeenTs ? `Updated ${ago(room.lastSeenTs)}` : 'Waiting for data'}
          </div>
          <div className="kpi-foot" />
        </div>
      </section>
    </div>
  );
}
