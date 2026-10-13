import Spark from '../components/Spark';
import { ago, fmtF, fmtT } from '../lib/format';
import type { useRoom } from '../lib/useRoom';

type Room = ReturnType<typeof useRoom>;

// VIEW 1: ROOM UNIT — DOM copied from backend/static/index.html
export default function RoomView({
  room,
  deviceId,
  clock,
  tz,
  sessionSince,
  now,
}: {
  room: Room;
  deviceId: string;
  clock: string;
  tz: string;
  sessionSince: string;
  now: Date;
}) {
  const stale = room.lastSeenTs ? now.getTime() - new Date(room.lastSeenTs).getTime() > 90000 : true;
  const link = { text: stale ? 'Stale' : 'Online', cls: stale ? 'badge stale' : 'badge ok' };

  return (
    <div className="view-section active">
      <div className="page-head">
        <h1>Room Overview · {deviceId}</h1>
        <span className="page-desc">Environmental &amp; presence telemetry</span>
        <div className="meta">
          <span>{clock}</span>
          <span>{tz}</span>
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
          <div className="kpi-sub">{room.tempTs ? `sensor · ${fmtT(room.tempTs)}` : 'no data yet'}</div>
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
          <div className="kpi-sub">{room.humTs ? `sensor · ${fmtT(room.humTs)}` : 'no data yet'}</div>
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
          <div className="kpi-sub">{room.motionTs ? `sensor · ${fmtT(room.motionTs)}` : 'no data yet'}</div>
          <div className="kpi-foot">
            <span className="delta">
              {room.lastMotionTs ? `last event ${ago(room.lastMotionTs)}` : 'no events'}
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span>Room Link</span>
            <span className={link.cls}>{link.text}</span>
          </div>
          <div className="kpi-value-row">
            <div
              className="kpi-value"
              style={{ fontSize: 18, paddingTop: 6, fontFamily: 'var(--mono)', fontWeight: 600 }}
            >
              {room.lastSeenTs ? fmtF(room.lastSeenTs) : '--'}
            </div>
          </div>
          <div className="kpi-sub">
            {room.lastSeenTs ? `updated ${ago(room.lastSeenTs)}` : 'awaiting first message'}
          </div>
          <div className="kpi-foot">
            <span className="delta">{room.devStatusTs}</span>
            <span className="delta">Live Stream</span>
          </div>
        </div>
      </section>

      <section className="panels">
        <div className="panel">
          <div className="panel-head">
            <h2>Recent Room Events</h2>
            <span className="hint">
              {room.feedCount} event{room.feedCount === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
            <table className="log" aria-label="Recent readings">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Time</th>
                  <th>Metric</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {room.events.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="fresh-note">
                      Connecting to room unit… Data streams via WebSocket from backend.
                    </td>
                  </tr>
                ) : (
                  room.events.map((e, i) => (
                    <tr key={`${e.time}-${e.metric}-${i}`} className={i === 0 ? 'fresh' : undefined}>
                      <td className="time">{fmtT(e.time)}</td>
                      <td className="metric">{e.metric}</td>
                      <td className="val" style={{ textAlign: 'right' }}>
                        {e.value}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Unit Information</h2>
          </div>
          <div className="kv">
            <div className="kv-row">
              <span className="k">Active Device ID</span>
              <span className="v">{deviceId}</span>
            </div>
            <div className="kv-row">
              <span className="k">Room Topic</span>
              <span className="v">caretrack/{deviceId}/room/environment</span>
            </div>
            <div className="kv-row">
              <span className="k">Motion Topic</span>
              <span className="v">caretrack/{deviceId}/room/motion</span>
            </div>
            <div className="kv-row">
              <span className="k">Link Status</span>
              <span className="v">Live Stream</span>
            </div>
            <div className="kv-row">
              <span className="k">Session Started</span>
              <span className="v">{sessionSince}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
