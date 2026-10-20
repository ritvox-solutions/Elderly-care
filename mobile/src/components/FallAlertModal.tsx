import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface FallAlertModalProps {
  visible: boolean;
  magnitude: number;
  heightM?: number;
  category?: string;
  timestamp: string;
  patientName: string;
  roomNumber: string;
  onSilence: () => void;
  onConfirm: () => void;
}

export const FallAlertModal: React.FC<FallAlertModalProps> = ({
  visible,
  magnitude,
  heightM,
  category,
  timestamp,
  patientName,
  roomNumber,
  onSilence,
  onConfirm,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={onSilence}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🚨 CRITICAL: FALL DETECTED!</Text>
            <Text style={styles.headerSubtitle}>Immediate bedside assistance required</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Patient:</Text>
              <Text style={styles.value}>{patientName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Location:</Text>
              <Text style={[styles.value, { color: '#2dd4bf' }]}>{roomNumber}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Impact Magnitude:</Text>
              <Text style={[styles.value, { color: '#f43f5e', fontWeight: 'bold' }]}>
                {magnitude.toFixed(2)}g Shock
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Estimated Fall Height:</Text>
              <Text style={[styles.value, { color: '#fbbf24', fontWeight: 'bold' }]}>
                {heightM ? `${heightM.toFixed(2)} m (~${(heightM * 3.28084).toFixed(1)} ft)` : '~0.85 m (Bed/Chair)'}
              </Text>
            </View>

            {category ? (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Severity Level:</Text>
                <Text style={[styles.value, { color: '#38bdf8', fontWeight: '600' }]}>{category}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.label}>Detected At:</Text>
              <Text style={styles.value}>
                {new Date(timestamp).toLocaleTimeString()}
              </Text>
            </View>

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                Confirmed by wearable 3-axis MPU-6050 accelerometer vector analysis. 
                Emergency siren is sounding on monitoring terminals.
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn, styles.silenceBtn]}
                onPress={onSilence}
              >
                <Text style={styles.silenceText}>Silence</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.confirmBtn]}
                onPress={onConfirm}
              >
                <Text style={styles.confirmText}>Dispatch Nurse</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e11d48',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#e11d48',
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#ffe4e6',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  body: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
  },
  value: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  disclaimerBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  disclaimerText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  silenceBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  silenceText: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#e11d48',
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
