import { useState } from 'react';
import type { Patient } from '../lib/types';
import type { useCardio } from '../lib/useCardio';
import type { useRoom } from '../lib/useRoom';
import { clockStr } from '../lib/useNow';
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
  onEdit,
}: {
  room: ReturnType<typeof useRoom>;
  cardio: ReturnType<typeof useCardio>;
  fall: FallState | null;
  now: Date;
  patient: Patient;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
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
        <button
          type="button"
          className="ct-btn-ghost patient-settings-toggle"
          aria-haspopup="dialog"
          onClick={() => setShowSettings(true)}
        >
          Patient Settings
        </button>
      </div>

      {showSettings && <div className="patient-settings-modal" onMouseDown={() => setShowSettings(false)}>
        <section
          className="patient-settings-card patient-settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-settings-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="patient-settings-head">
            <div>
              <h2 id="patient-settings-title">Patient Settings</h2>
              <p>Personal details and the family contact used for emergency alerts.</p>
            </div>
            <div className="patient-settings-actions">
              <button type="button" className="ct-btn-ghost" onClick={() => { setShowSettings(false); onEdit(); }}>Edit details</button>
              <button type="button" className="ct-btn-ghost" onClick={() => setShowSettings(false)}>Close</button>
            </div>
          </div>
          <dl className="patient-settings-grid">
            <div><dt>Patient email</dt><dd>{patient.email || 'Not provided'}</dd></div>
            <div><dt>Date of birth</dt><dd>{patient.dateOfBirth || 'Not provided'}</dd></div>
            <div><dt>Medical notes</dt><dd>{patient.medicalNotes || patient.condition || 'None'}</dd></div>
            <div><dt>Emergency contact</dt><dd>{patient.emergencyContact?.name || 'Not provided'}</dd></div>
            <div><dt>Contact phone</dt><dd>{patient.emergencyContact?.phone || 'Not provided'}</dd></div>
            <div><dt>Contact email</dt><dd>{patient.emergencyContact?.email || 'Not provided'}</dd></div>
          </dl>
        </section>
      </div>}

      <div className="patient-monitor-grid">
        {/* LEFT: Room unit telemetry — same UI as the old Room Unit page */}
        <RoomView
          room={room}
          clock={clock}
          now={now}
        />

        {/* RIGHT: Wearable cardiac telemetry — same UI as the old Cardiac page */}
        <CardioView cardio={cardio} clock={clock} fall={fall} />
      </div>
    </div>
  );
}
