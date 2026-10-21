import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Search,
  UserCheck,
  ChevronRight,
} from 'lucide-react-native';
import type { Patient } from '../types';
import { theme } from '../theme';

interface PatientsScreenProps {
  patients: Patient[];
  caregiverName: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectPatient: (patient: Patient) => void;
  onEditPatient: (patient: Patient) => void;
  selectedPatientId?: string;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  patients,
  caregiverName,
  loading,
  error,
  onRetry,
  onSelectPatient,
  onEditPatient,
  selectedPatientId,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'STABLE' | 'ATTENTION' | 'CRITICAL'>('ALL');

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.roomNumber.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q);

    const matchesFilter = filter === 'ALL' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Ward Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assigned Patients Directory</Text>
        <Text style={styles.headerSubtitle}>
          Attending Care Taker: {caregiverName} • Tap any patient to monitor their live room unit &amp; wearable telemetry
        </Text>
      </View>

      {/* Ward Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{patients.length}</Text>
          <Text style={styles.statLabel}>Assigned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: theme.ok }]}>{patients.filter((p) => p.status === 'STABLE').length}</Text>
          <Text style={styles.statLabel}>Stable</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: theme.warn }]}>{patients.filter((p) => p.status === 'ATTENTION').length}</Text>
          <Text style={styles.statLabel}>Attention</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: theme.bad }]}>{patients.filter((p) => p.status === 'CRITICAL').length}</Text>
          <Text style={styles.statLabel}>High Risk</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Search size={16} color={theme.text3} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, room, or condition..."
          placeholderTextColor={theme.text3}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'STABLE', 'ATTENTION', 'CRITICAL'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, filter === s && styles.filterChipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.filterChipText, filter === s && styles.filterChipTextActive]}>
              {s === 'ALL' ? `All (${patients.length})` : s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Patients Card List */}
      <View style={styles.cardList}>
        {loading && <ActivityIndicator color={theme.accent} />}
        {!loading && error && (
          <TouchableOpacity style={styles.messageCard} onPress={onRetry}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
        {!loading && !error && filtered.length === 0 && (
          <Text style={styles.emptyText}>No patients found.</Text>
        )}
        {filtered.map((patient) => {
          const isSelected = selectedPatientId === patient.id;
          const isCritical = patient.status === 'CRITICAL';
          const isAttention = patient.status === 'ATTENTION';

          const statusColor = isCritical ? theme.bad : isAttention ? theme.warn : theme.ok;
          const statusBg = isCritical ? theme.badBg : isAttention ? theme.warnBg : theme.okBg;
          const statusBorder = isCritical ? theme.badBorder : isAttention ? theme.warnBorder : theme.okBorder;
          const statusLabel = isCritical ? 'High Fall Risk' : isAttention ? 'Requires Check' : 'Vitals Stable';

          return (
            <TouchableOpacity
              key={patient.id}
              style={[
                styles.patientCard,
                isSelected && styles.patientCardSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => onSelectPatient(patient)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <View style={[styles.avatar, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                    <Text style={[styles.avatarText, { color: statusColor }]}>
                      {patient.firstName[0]}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.patientName}>
                      {patient.firstName} {patient.lastName}
                    </Text>
                    <Text style={styles.patientMeta}>
                      {patient.age} yrs • {patient.gender}
                    </Text>
                  </View>
                </View>

                <View style={styles.roomPill}>
                  <Text style={styles.roomPillText}>{patient.roomNumber}</Text>
                </View>
              </View>

              <Text style={styles.conditionText} numberOfLines={2}>
                {patient.condition}
              </Text>

              {/* Card Footer with CTA */}
              <View style={styles.cardFooter}>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {statusLabel}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                <TouchableOpacity style={styles.editButton} onPress={() => onEditPatient(patient)}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.ctaButton}>
                  <Text style={styles.ctaText}>
                    {isSelected ? 'Monitoring Active' : 'Monitor Patient'}
                  </Text>
                  <ChevronRight size={14} color="#ffffff" />
                </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.text2,
    marginTop: 3,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.text3,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: theme.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.text2,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  cardList: {
    gap: 12,
    minHeight: 80,
  },
  messageCard: {
    backgroundColor: theme.badBg,
    borderColor: theme.badBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    color: theme.bad,
    fontSize: 12,
    textAlign: 'center',
  },
  retryText: {
    color: theme.bad,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyText: {
    color: theme.text3,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
  patientCard: {
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  patientCardSelected: {
    borderColor: theme.accent,
    backgroundColor: '#fbfdfc',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  patientMeta: {
    fontSize: 11.5,
    color: theme.text3,
    marginTop: 1,
  },
  roomPill: {
    backgroundColor: theme.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  roomPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent,
  },
  conditionText: {
    fontSize: 12,
    color: theme.text2,
    lineHeight: 16,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editButton: { paddingVertical: 6, paddingHorizontal: 10 },
  editText: { color: theme.accent, fontSize: 11.5, fontWeight: '700' },
  ctaText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ffffff',
  },
});
