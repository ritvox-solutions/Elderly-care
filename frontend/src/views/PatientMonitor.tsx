import { useState } from 'react';
import { pad } from '../lib/format';
import type { Patient } from '../lib/types';
import type { useCardio } from '../lib/useCardio';
import type { useRoom } from '../lib/useRoom';
import { clockStr, tzName } from '../lib/useNow';
import CardioView, { type FallState } from './CardioView';
import RoomView from './RoomView';

// Inline patient monitor shown on the Patients Directory page when a
// patient card is clicked. It reuses the exact RoomView (left) and
// CardioView (right) components — the same UI they had when they were
// separate pages — side by side, with no page navigation.
export default function PatientMonitor({
  room,
  cardio,
  fall,
  now,
  patient,
  onBack,
}: {
  room: ReturnType<typeof useRoom>;
  cardio: ReturnType<typeof useCardio>;
  fall: FallState | null;
  now: Date;
  patient: Patient;
  onBack: () => void;
}) {
  const [tz] = useState(tzName);
  const [sessionSince] = useState(() => {
    const d = new Date();
    return `since ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const statusCls = patient.status === 'CRITICAL' ? 'bad' : patient.status === 'ATTENTION' ? 'warn' : 'ok';
  const statusText =
    patient.status === 'CRITICAL' ? 'High Fall Risk' : patient.status === 'ATTENTION' ? 'Needs Attention' : 'Vitals Stable';
  const clock = clockStr(now);

  return (
    <div className="view-section active">
      <div className="patient-monitor-head">
        <button type="button" className="ct-btn-ghost" onClick={onBack}>
          ← Back to Directory
        </button>
        <div className="patient-monitor-title">
          <div className="patient-monitor-heading-row">
            <h1>
              {patient.firstName} {patient.lastName}
            </h1>
            <span className="patient-room-badge">{patient.roomNumber}</span>
            <span className={`status-badge-text ${statusCls}`}>● {statusText}</span>
          </div>
          <span className="patient-monitor-sub">
            {patient.age} yrs • {patient.gender} · {patient.condition}
          </span>
        </div>
      </div>

      <div className="patient-monitor-grid">
        {/* LEFT: Room unit telemetry — same UI as the old Room Unit page */}
        <RoomView
          room={room}
          deviceId={patient.roomDeviceId}
          clock={clock}
          tz={tz}
          sessionSince={sessionSince}
          now={now}
        />

        {/* RIGHT: Wearable cardiac telemetry — same UI as the old Cardiac page */}
        <CardioView cardio={cardio} clock={clock} fall={fall} />
      </div>
    </div>
  );
}
