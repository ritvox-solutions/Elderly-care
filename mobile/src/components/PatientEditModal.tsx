import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Patient } from '../types';
import { theme } from '../theme';

export function PatientEditModal({ patient, saving, deleting, onClose, onSave, onDelete }: {
  patient: Patient | null;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
}) {
  const [draft, setDraft] = useState<Patient | null>(patient);
  useEffect(() => setDraft(patient), [patient]);
  if (!draft) return null;

  const field = (label: string, value: string, change: (value: string) => void, type?: 'email-address') => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={change} keyboardType={type} autoCapitalize={type ? 'none' : 'sentences'} />
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Edit Patient</Text>
          <Text style={styles.help}>Family email receives emergency alerts.</Text>
          <ScrollView>
            {field('First name', draft.firstName, (firstName) => setDraft({ ...draft, firstName }))}
            {field('Last name', draft.lastName, (lastName) => setDraft({ ...draft, lastName }))}
            {field('Date of birth (YYYY-MM-DD)', draft.dateOfBirth || '', (dateOfBirth) => setDraft({ ...draft, dateOfBirth }))}
            {field('Patient email', draft.email || '', (email) => setDraft({ ...draft, email }), 'email-address')}
            {field('Room', draft.roomNumber, (roomNumber) => setDraft({ ...draft, roomNumber }))}
            {field('Medical notes', draft.medicalNotes, (medicalNotes) => setDraft({ ...draft, medicalNotes, condition: medicalNotes }))}
            {field('Family contact name', draft.emergencyContact.name, (name) => setDraft({ ...draft, emergencyContact: { ...draft.emergencyContact, name } }))}
            {field('Family contact phone', draft.emergencyContact.phone, (phone) => setDraft({ ...draft, emergencyContact: { ...draft.emergencyContact, phone } }))}
            {field('Family contact email', draft.emergencyContact.email || '', (email) => setDraft({ ...draft, emergencyContact: { ...draft.emergencyContact, email } }), 'email-address')}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.delete} disabled={saving || deleting} onPress={() => onDelete(draft)}><Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete Patient'}</Text></TouchableOpacity>
            <View style={styles.secondaryActions}>
              <TouchableOpacity style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.save} disabled={saving || deleting} onPress={() => onSave(draft)}><Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.5)' },
  card: { maxHeight: '90%', backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: theme.text },
  help: { fontSize: 12, color: theme.text2, marginTop: 3, marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: theme.text2, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, color: theme.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 12 },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  delete: { borderWidth: 1, borderColor: theme.bad, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  deleteText: { color: theme.bad, fontWeight: '800' },
  cancel: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: theme.text2, fontWeight: '700' },
  save: { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  saveText: { color: '#fff', fontWeight: '800' },
});
