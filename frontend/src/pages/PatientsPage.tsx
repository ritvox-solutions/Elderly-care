import { useState, useEffect } from 'react';
import { DEMO_PATIENTS, useApp } from '../lib/store';
import { fetchPatients } from '../lib/api';
import type { Patient } from '../lib/types';
import type { useCardio } from '../lib/useCardio';
import type { useRoom } from '../lib/useRoom';
import type { FallState } from '../views/CardioView';
import PatientMonitor from '../views/PatientMonitor';
import PatientOnboardingForm from '../components/PatientOnboardingForm';

export default function PatientsPage({
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
  const { authUser, selectedPatient, setSelectedPatient } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'STABLE' | 'ATTENTION' | 'CRITICAL'>('ALL');
  // Local drill-down state: when set, the combined Room + Wearable monitor
  // for this patient is rendered in place of the directory (same page).
  const [viewing, setViewing] = useState<Patient | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>(DEMO_PATIENTS);

  useEffect(() => {
    if (authUser?.token) fetchPatients(authUser.token).then(setPatients).catch(() => {});
  }, [authUser?.token]);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.roomNumber.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q);

    const matchesFilter = filter === 'ALL' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    // Open the combined Room Unit + Wearable monitor for this patient
    // inline on this page (the old separate Dual Overview page is gone).
    setViewing(patient);
  };

  // Selected patient's monitor: room unit data (left) + wearable data (right)
  if (viewing) {
    return (
      <PatientMonitor
        room={room}
        cardio={cardio}
        fall={fall}
        now={now}
        patient={viewing}
        onBack={() => setViewing(null)}
      />
    );
  }

  if ((showOnboarding || editing) && authUser?.token) {
    return (
      <div className="view-section active">
        <PatientOnboardingForm
          token={authUser.token}
          patient={editing || undefined}
          onCancel={() => { setShowOnboarding(false); setEditing(null); }}
          onCreated={(patient) => {
            setPatients((current) => editing
              ? current.map((item) => item.id === patient.id ? patient : item)
              : [patient, ...current.filter((item) => item.id !== patient.id)]);
            setSelectedPatient(patient);
            setShowOnboarding(false);
            setEditing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="view-section active">
      <div className="page-head">
        <div>
          <h1>Patients Directory</h1>
          {!authUser?.token && <p>Sign in with a caregiver account to add patients.</p>}
        </div>
        <button
          type="button"
          className="ct-btn patient-add-btn"
          disabled={!authUser?.token}
          title={!authUser?.token ? 'A verified caregiver login is required' : undefined}
          onClick={() => setShowOnboarding(true)}
        >
          + Add Patient
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="patient-toolbar">
        <input
          type="text"
          className="ct-input patient-search-input"
          placeholder="Search by name, room, or medical condition..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filter-pill-group">
          {(['ALL', 'STABLE', 'ATTENTION', 'CRITICAL'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`filter-pill-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === 'ALL' ? `All Patients (${patients.length})` : s}
            </button>
          ))}
        </div>
      </div>

      {/* Patients Grid */}
      <div className="patients-grid">
        {filtered.map((p) => {
          const isSelected = selectedPatient?.id === p.id;
          const statusCls = p.status === 'CRITICAL' ? 'bad' : p.status === 'ATTENTION' ? 'warn' : 'ok';
          const statusText = p.status === 'CRITICAL' ? 'High Fall Risk' : p.status === 'ATTENTION' ? 'Needs Attention' : 'Vitals Stable';

          return (
            <div
              key={p.id}
              className={`patient-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(p)}
            >
              <div>
                <div className="patient-card-header">
                  <div className="patient-card-user">
                    <div className={`patient-avatar ${statusCls}`}>
                      {p.firstName[0]}
                    </div>
                    <div>
                      <h3 className="patient-card-name">
                        {p.firstName} {p.lastName}
                      </h3>
                      <div className="patient-card-sub">
                        {p.age} yrs • {p.gender}
                      </div>
                    </div>
                  </div>
                  <div className="patient-room-badge">
                    {p.roomNumber}
                  </div>
                </div>

                <div className="patient-condition-text">
                  {p.condition}
                </div>

                <div className="patient-snapshot-grid">
                  <div className="patient-snapshot-item">
                    <span className="snapshot-label">Wearable Vitals</span>
                    <span className="snapshot-value">
                      ❤️ {p.vitals?.hr || '—'} bpm • SpO2: {p.vitals?.spo2 || '—'}%
                    </span>
                  </div>
                  <div className="patient-snapshot-item">
                    <span className="snapshot-label">Room Environment</span>
                    <span className="snapshot-value">
                      🌡️ {p.roomEnv?.temp || '—'}°C • {p.roomEnv?.humidity || '—'}% Hum
                    </span>
                  </div>
                </div>
              </div>

              <div className="patient-card-footer">
                <span className={`status-badge-text ${statusCls}`}>
                  ● {statusText}
                </span>
                <div className="patient-card-actions">
                {authUser?.token && <button type="button" className="ct-btn-ghost" onClick={(e) => { e.stopPropagation(); setEditing(p); }}>Edit</button>}
                <button
                  type="button"
                  className="ct-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(p);
                  }}
                >
                  {isSelected ? 'Currently Monitoring ✓' : 'Monitor Patient →'}
                </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
