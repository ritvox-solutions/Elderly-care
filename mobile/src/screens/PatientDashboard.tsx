import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Activity, ArrowLeft, CloudSun, Heart, Home, Pencil, Radio, Settings, ShieldCheck, Thermometer, Wifi, X } from 'lucide-react-native';
import { MetricCard } from '../components/MetricCard';
import { TelemetryChart } from '../components/TelemetryChart';
import { theme } from '../theme';
import type { Patient, TelemetryPoint } from '../types';

interface PatientDashboardProps {
  patient: Patient;
  heartRate: number | null;
  spo2: number | null;
  sensorTemp: number | null;
  roomTemp: number | null;
  humidity: number | null;
  motionDetected: boolean | null;
  history: TelemetryPoint[];
  roomUpdatedAt: string | null;
  wearableUpdatedAt: string | null;
  error: string | null;
  onBack: () => void;
  onEdit?: () => void;
}

const reading = (value: number | null, decimals = 0) =>
  value == null ? '--' : value.toFixed(decimals);

export function PatientDashboard({
  patient,
  heartRate,
  spo2,
  sensorTemp,
  roomTemp,
  humidity,
  motionDetected,
  history,
  roomUpdatedAt,
  wearableUpdatedAt,
  error,
  onBack,
  onEdit,
}: PatientDashboardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 760;
  const patientStatus = heartRate != null && spo2 != null && (heartRate < 50 || heartRate > 110 || spo2 < 92)
    ? 'Needs attention'
    : heartRate == null || spo2 == null
      ? 'Waiting'
      : 'Normal';
  const formatTime = (timestamp: string | null) => timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--';
  const roomUpdatedLabel = formatTime(roomUpdatedAt);
  const wearableUpdatedLabel = formatTime(wearableUpdatedAt);
  const hasRoomData = roomTemp != null || humidity != null || motionDetected != null;
  const hasWearableData = heartRate != null || spo2 != null || sensorTemp != null;

  return (
    <View>
      <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={onBack}>
        <ArrowLeft size={15} color={theme.accent} />
        <Text style={styles.backText}>Patients Directory</Text>
      </TouchableOpacity>

      <View style={styles.patientHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{patient.firstName[0]}{patient.lastName[0]}</Text>
        </View>
        <View style={styles.patientIdentity}>
          <View style={styles.nameRow}>
            <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
            <View style={styles.roomBadge}><Text style={styles.roomBadgeText}>{patient.roomNumber}</Text></View>
          </View>
          <Text style={styles.patientMeta}>{patient.age} yrs · {patient.gender} · {patient.condition}</Text>
        </View>
        <View style={styles.stableBadge}><Text style={styles.stableText}>● {patient.status}</Text></View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open patient settings"
        style={styles.settingsToggle}
        onPress={() => setShowSettings(true)}
      >
        <Settings size={15} color={theme.accent} />
        <Text style={styles.settingsToggleText}>Patient Settings</Text>
      </TouchableOpacity>

      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)} accessibilityViewIsModal>
        <View style={styles.settingsModal}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close patient settings" activeOpacity={1} style={styles.settingsBackdrop} onPress={() => setShowSettings(false)} />
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <View style={styles.settingsHeading}>
                <Text style={styles.settingsTitle}>Patient Settings</Text>
                <Text style={styles.settingsHelp}>Details and emergency alert contact</Text>
              </View>
              <View style={styles.settingsActions}>
                {onEdit ? (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit patient details" style={styles.editButton} onPress={() => { setShowSettings(false); onEdit(); }}>
                    <Pencil size={13} color={theme.accent} />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close patient settings" style={styles.closeButton} onPress={() => setShowSettings(false)}>
                  <X size={16} color={theme.text2} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}><Text style={styles.detailLabel}>Patient email</Text><Text style={styles.detailValue}>{patient.email || 'Not provided'}</Text></View>
              <View style={styles.detailItem}><Text style={styles.detailLabel}>Date of birth</Text><Text style={styles.detailValue}>{patient.dateOfBirth || 'Not provided'}</Text></View>
              <View style={styles.detailItem}><Text style={styles.detailLabel}>Medical notes</Text><Text style={styles.detailValue}>{patient.medicalNotes || patient.condition || 'None'}</Text></View>
              <View style={styles.detailItem}><Text style={styles.detailLabel}>Emergency contact</Text><Text style={styles.detailValue}>{patient.emergencyContact.name || 'Not provided'}</Text></View>
              <View style={styles.detailItem}><Text style={styles.detailLabel}>Contact phone</Text><Text style={styles.detailValue}>{patient.emergencyContact.phone || 'Not provided'}</Text></View>
              <View style={styles.detailItem}><Text style={styles.detailLabel}>Contact email</Text><Text style={styles.detailValue}>{patient.emergencyContact.email || 'Not provided'}</Text></View>
            </View>
          </View>
        </View>
      </Modal>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Telemetry unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.deviceColumns, isTablet && styles.deviceColumnsTablet]}>
        <View style={[styles.devicePanel, isTablet && styles.devicePanelTablet]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionIcon}><Home size={17} color={theme.accent} /></View>
              <View>
                <Text style={styles.sectionTitle}>Room Overview</Text>
                <Text style={styles.sectionSub}>Temperature, humidity and movement</Text>
              </View>
            </View>
            <View style={[styles.linkBadge, error ? styles.linkBadgeOffline : styles.linkBadgeOnline]}>
              <Text style={[styles.linkText, error ? styles.linkTextOffline : styles.linkTextOnline]}>
                {error ? 'OFFLINE' : hasRoomData ? 'UPDATED' : 'WAITING'}
              </Text>
            </View>
          </View>

          <View style={styles.kpiGrid}>
            <MetricCard label="Temperature" value={reading(roomTemp, 1)} unit="°C" statusText={roomTemp == null ? 'Waiting' : roomTemp > 28 ? 'High' : 'Comfortable'} statusVariant={roomTemp == null ? 'neutral' : roomTemp > 28 ? 'warn' : 'ok'} icon={Thermometer} />
            <MetricCard label="Humidity" value={reading(humidity, 1)} unit="%" statusText={humidity == null ? 'Waiting' : humidity > 65 ? 'Humid' : 'Optimal'} statusVariant={humidity == null ? 'neutral' : humidity > 65 ? 'warn' : 'ok'} icon={CloudSun} />
            <MetricCard label="Motion Presence" value={motionDetected == null ? '--' : motionDetected ? 'Detected' : 'Clear'} statusText={motionDetected == null ? 'Waiting' : motionDetected ? 'Active motion' : 'No motion'} statusVariant={motionDetected == null ? 'neutral' : motionDetected ? 'warn' : 'ok'} icon={Radio} />
            <MetricCard label="Room Status" value={error ? 'Offline' : hasRoomData ? 'Up to date' : 'Waiting'} statusText={`Updated ${roomUpdatedLabel}`} statusVariant={error ? 'bad' : hasRoomData ? 'ok' : 'neutral'} icon={Wifi} />
          </View>
        </View>

        <View style={[styles.devicePanel, isTablet && styles.devicePanelTablet]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionIcon}><Heart size={17} color={theme.accent} /></View>
              <View>
                <Text style={styles.sectionTitle}>Cardiac Telemetry</Text>
                <Text style={styles.sectionSub}>Heart rate, oxygen and temperature</Text>
              </View>
            </View>
            <View style={[styles.linkBadge, error ? styles.linkBadgeOffline : styles.linkBadgeOnline]}>
              <Text style={[styles.linkText, error ? styles.linkTextOffline : styles.linkTextOnline]}>
                {error ? 'OFFLINE' : hasWearableData ? 'UPDATED' : 'WAITING'}
              </Text>
            </View>
          </View>

          <View style={styles.kpiGrid}>
            <MetricCard label="Heart Rate" value={reading(heartRate)} unit="bpm" statusText={heartRate == null ? 'Waiting' : 'Resting rhythm'} statusVariant={heartRate == null ? 'neutral' : 'ok'} icon={Heart} />
            <MetricCard label="Oxygen (SpO2)" value={reading(spo2)} unit="%" statusText={spo2 == null ? 'Waiting' : spo2 < 92 ? 'Low' : 'Optimal'} statusVariant={spo2 == null ? 'neutral' : spo2 < 92 ? 'bad' : 'ok'} icon={Activity} />
            <MetricCard label="Sensor Temp" value={reading(sensorTemp, 1)} unit="°C" statusText={sensorTemp == null ? 'Waiting' : sensorTemp >= 35 && sensorTemp <= 38 ? 'Normal' : 'Check sensor'} statusVariant={sensorTemp == null ? 'neutral' : sensorTemp >= 35 && sensorTemp <= 38 ? 'ok' : 'warn'} icon={Thermometer} />
            <MetricCard label="Patient Status" value={patientStatus} statusText={`Recorded ${wearableUpdatedLabel}`} statusVariant={patientStatus === 'Needs attention' ? 'bad' : patientStatus === 'Waiting' ? 'neutral' : 'ok'} icon={ShieldCheck} />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Telemetry History</Text>
            {history.length ? <TelemetryChart data={history} height={160} /> : <Text style={styles.emptyText}>No history available yet.</Text>}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginBottom: 12, minHeight: 32 },
  backText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  patientHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, marginBottom: 14 },
  avatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  patientIdentity: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  patientName: { color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  patientMeta: { color: theme.text2, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  roomBadge: { backgroundColor: theme.accentLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  roomBadgeText: { color: theme.accent, fontSize: 9.5, fontWeight: '800' },
  stableBadge: { marginLeft: 6 },
  stableText: { color: theme.ok, fontSize: 9, fontWeight: '800' },
  settingsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 10, paddingVertical: 10, marginBottom: 14 },
  settingsToggleText: { color: theme.accent, fontSize: 11.5, fontWeight: '800' },
  settingsModal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  settingsBackdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,.58)' },
  settingsCard: { width: '100%', maxWidth: 620, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 16 },
  settingsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  settingsHeading: { flex: 1 },
  settingsTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  settingsHelp: { color: theme.text3, fontSize: 10, marginTop: 2 },
  settingsActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  editButtonText: { color: theme.accent, fontSize: 11, fontWeight: '800' },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 8 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailItem: { width: '47%' },
  detailLabel: { color: theme.text3, fontSize: 9.5, marginBottom: 2 },
  detailValue: { color: theme.text, fontSize: 11, fontWeight: '600' },
  errorBanner: { backgroundColor: theme.badBg, borderWidth: 1, borderColor: theme.badBorder, borderRadius: 10, padding: 11, marginBottom: 12 },
  errorTitle: { color: theme.bad, fontSize: 12, fontWeight: '800' },
  errorText: { color: theme.bad, fontSize: 10.5, marginTop: 2 },
  deviceColumns: { gap: 14 },
  deviceColumnsTablet: { flexDirection: 'row', alignItems: 'flex-start' },
  devicePanel: { flex: 1 },
  devicePanelTablet: { minWidth: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  sectionIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: theme.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  sectionTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
  sectionSub: { color: theme.text3, fontSize: 9.5, marginTop: 1 },
  linkBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  linkBadgeOnline: { backgroundColor: theme.okBg, borderColor: theme.okBorder },
  linkBadgeOffline: { backgroundColor: theme.badBg, borderColor: theme.badBorder },
  linkText: { fontSize: 8.5, fontWeight: '800' },
  linkTextOnline: { color: theme.ok },
  linkTextOffline: { color: theme.bad },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 10 },
  infoCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { color: theme.text, fontSize: 12.5, fontWeight: '800', marginBottom: 9 },
  emptyText: { color: theme.text3, fontSize: 11, textAlign: 'center', paddingVertical: 28 },
});
