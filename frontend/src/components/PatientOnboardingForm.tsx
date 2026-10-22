import { useState, type FormEvent } from 'react';
import { createPatient, updatePatient, type PatientOnboardingInput } from '../lib/api';
import type { Patient } from '../lib/types';


const EMPTY_FORM: PatientOnboardingInput = {
  first_name: '',
  last_name: '',
  email: '',
  date_of_birth: '',
  gender: '',
  room_number: '',
  medical_notes: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_email: '',
  room_device_id: '',
  wearable_device_id: '',
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function PatientOnboardingForm({
  token,
  onCreated,
  onCancel,
  patient,
  onDelete,
  deleting = false,
}: {
  token: string;
  onCreated: (patient: Patient) => void;
  onCancel: () => void;
  patient?: Patient;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const [form, setForm] = useState<PatientOnboardingInput>(() => patient ? {
    ...EMPTY_FORM,
    first_name: patient.firstName,
    last_name: patient.lastName,
    email: patient.email || '',
    date_of_birth: patient.dateOfBirth || '',
    gender: patient.gender,
    room_number: patient.roomNumber,
    medical_notes: patient.medicalNotes || patient.condition,
    emergency_contact_name: patient.emergencyContact?.name || '',
    emergency_contact_phone: patient.emergencyContact?.phone || '',
    emergency_contact_email: patient.emergencyContact?.email || '',
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof PatientOnboardingInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      onCreated(patient ? await updatePatient(patient.id, form, token) : await createPatient(form, token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not onboard patient');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="patient-onboarding" onSubmit={submit}>
      <div className="patient-onboarding-head">
        <div>
          <h2>{patient ? 'Edit Patient' : 'Onboard Patient'}</h2>
          <p>{patient ? 'Update patient and family emergency contact details.' : 'Add the patient, devices, and family contact used for emergency email alerts.'}</p>
        </div>
        <button type="button" className="ct-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>

      <fieldset>
        <legend>Patient details</legend>
        <div className="patient-form-grid">
          <label>First name<input className="ct-input" required value={form.first_name} onChange={(e) => update('first_name', e.target.value)} /></label>
          <label>Last name<input className="ct-input" required value={form.last_name} onChange={(e) => update('last_name', e.target.value)} /></label>
          <label>Patient email<input className="ct-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
          <label>Date of birth<input className="ct-input" type="date" max={TODAY} required value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} /></label>
          <label>Gender<select className="ct-input" required value={form.gender} onChange={(e) => update('gender', e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></label>
          <label>Room number<input className="ct-input" required placeholder="Room 204" value={form.room_number} onChange={(e) => update('room_number', e.target.value)} /></label>
          <label className="patient-form-wide">Medical notes<textarea className="ct-input" rows={3} placeholder="Conditions, medication, mobility or fall risks" value={form.medical_notes} onChange={(e) => update('medical_notes', e.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Family emergency contact</legend>
        <div className="patient-form-grid">
          <label>Full name<input className="ct-input" required value={form.emergency_contact_name} onChange={(e) => update('emergency_contact_name', e.target.value)} /></label>
          <label>Phone number<input className="ct-input" type="tel" required minLength={5} value={form.emergency_contact_phone} onChange={(e) => update('emergency_contact_phone', e.target.value)} /></label>
          <label className="patient-form-wide">Email for emergency alerts<input className="ct-input" type="email" required value={form.emergency_contact_email} onChange={(e) => update('emergency_contact_email', e.target.value)} /></label>
        </div>
      </fieldset>

      {!patient && <fieldset>
        <legend>Device pairing</legend>
        <div className="patient-form-grid">
          <label>Room unit ID<input className="ct-input" required placeholder="room-unit-04" value={form.room_device_id} onChange={(e) => update('room_device_id', e.target.value)} /></label>
          <label>Wearable ID<input className="ct-input" required placeholder="ESP32-CardiacMonitor-04" value={form.wearable_device_id} onChange={(e) => update('wearable_device_id', e.target.value)} /></label>
        </div>
      </fieldset>}

      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="patient-form-actions">
        {patient && onDelete && <button type="button" className="ct-btn-danger" disabled={saving || deleting} onClick={onDelete}>{deleting ? 'Deleting...' : 'Delete Patient'}</button>}
        <button type="button" className="ct-btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="ct-btn" disabled={saving}>{saving ? 'Saving...' : patient ? 'Save Changes' : 'Add Patient'}</button>
      </div>
    </form>
  );
}
