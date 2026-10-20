import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart,
  Activity,
  ShieldCheck,
  Clock,
  Bell,
  Settings,
  Menu,
  X,
  Check,
  UserCheck,
  Lock,
  User,
  Save,
  LogIn,
  ArrowLeftRight,
} from 'lucide-react-native';

import { theme } from './src/theme';
import { AuthScreen, type AuthUser, type UserRole } from './src/screens/AuthScreen';
import { PatientsScreen } from './src/screens/PatientsScreen';
import { PatientDashboard } from './src/screens/PatientDashboard';
import { DEMO_PATIENTS } from './src/data/fixtures';
import { TelemetryChart } from './src/components/TelemetryChart';
import { FallAlertModal } from './src/components/FallAlertModal';
import { fetchLatest, fetchPatients, subscribeToAlerts } from './src/lib/api';
import {
  enableFallPushNotifications,
  Notifications,
  readFallNotification,
  type FallNotificationData,
} from './src/lib/notifications';
import type { AlertItem, Patient, TelemetryPoint } from './src/types';

// AuthUser & UserRole are imported from ./src/screens/AuthScreen

export type NavTab =
  | 'patients'
  | 'dual'
  | 'history'
  | 'alerts'
  | 'settings';

interface FallDisplay {
  alertId: string;
  magnitude: number;
  timestamp: string;
  patientName: string;
  roomNumber: string;
  deviceId: string;
  message: string;
}

export default function App() {
  // Current Auth User & Role - starts at null so user sees Login / Signup screen
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [lastUser, setLastUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active view tab
  const [currentTab, setCurrentTab] = useState<NavTab>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [patientsReload, setPatientsReload] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(DEMO_PATIENTS[0]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Role permissions (safe navigation if currentUser is null)
  const isCaregiver = currentUser?.role === 'CAREGIVER';

  // Configurable Alert Generation Thresholds (Care Taker Special Access)
  const [hrMin, setHrMin] = useState('50');
  const [hrMax, setHrMax] = useState('110');
  const [spo2Min, setSpo2Min] = useState('92');
  const [fallG, setFallG] = useState('3.0');
  const [roomTempMin, setRoomTempMin] = useState('18.0');
  const [roomTempMax, setRoomTempMax] = useState('28.0');
  const [savedToast, setSavedToast] = useState(false);

  // Real-time telemetry data
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [spo2, setSpo2] = useState<number | null>(null);
  const [sensorTemp, setSensorTemp] = useState<number | null>(null);
  const [roomTemp, setRoomTemp] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [motionDetected, setMotionDetected] = useState<boolean | null>(null);
  const [roomTelemetryAt, setRoomTelemetryAt] = useState<string | null>(null);
  const [wearableTelemetryAt, setWearableTelemetryAt] = useState<string | null>(null);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  // Telemetry stream history
  const [historyData, setHistoryData] = useState<TelemetryPoint[]>([]);

  // Alerts state
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Fall Alert Modal state
  const [fallAlert, setFallAlert] = useState<{
    visible: boolean;
    magnitude: number;
    heightM: number;
    category: string;
    timestamp: string;
    patientName: string;
    roomNumber: string;
  }>({
    visible: false,
    magnitude: 3.85,
    heightM: 0.88,
    category: 'Bed/Chair Height Fall',
    timestamp: new Date().toISOString(),
    patientName: 'Patient',
    roomNumber: 'Unknown room',
  });

  const showFallAlert = useCallback((fall: FallDisplay) => {
    setFallAlert({
      visible: true,
      magnitude: fall.magnitude,
      heightM: 0.88,
      category: 'Critical fall event',
      timestamp: fall.timestamp,
      patientName: fall.patientName,
      roomNumber: fall.roomNumber,
    });
    setAlerts((previous) => previous.some((alert) => alert.id === fall.alertId) ? previous : [
      {
        id: fall.alertId,
        type: 'FALL',
        severity: 'CRITICAL',
        title: 'Fall detected',
        message: fall.message,
        timestamp: fall.timestamp,
        deviceId: fall.deviceId,
        patientName: fall.patientName,
        status: 'ACTIVE',
      },
      ...previous,
    ]);
  }, []);

  useEffect(() => {
    const displayNotification = (data: FallNotificationData | null) => {
      if (!data) return;
      showFallAlert({
        alertId: data.alert_id,
        magnitude: data.magnitude,
        timestamp: data.timestamp,
        patientName: data.patient_name,
        roomNumber: data.room_number,
        deviceId: data.device_id,
        message: `Fall detected on ${data.device_id}. Immediate assistance may be required.`,
      });
    };
    const received = Notifications.addNotificationReceivedListener((notification) => {
      displayNotification(readFallNotification(notification));
    });
    const opened = Notifications.addNotificationResponseReceivedListener((response) => {
      displayNotification(readFallNotification(response.notification));
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        displayNotification(readFallNotification(response.notification));
        Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      received.remove();
      opened.remove();
    };
  }, [showFallAlert]);

  useEffect(() => {
    if (!currentUser?.token) return;
    enableFallPushNotifications(currentUser.token).catch((error) => {
      console.warn('Fall push registration failed:', error);
    });
  }, [currentUser?.token]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeToAlerts([selectedPatient.roomDeviceId, selectedPatient.wearableDeviceId], (alert) => {
      if (alert.category !== 'FALL') return;
      showFallAlert({
        alertId: alert.alert_id,
        magnitude: Number(alert.value || 0),
        timestamp: alert.timestamp,
        patientName: alert.patient_name || `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        roomNumber: alert.room_number || selectedPatient.roomNumber,
        deviceId: alert.device_id,
        message: alert.message,
      });
    });
  }, [currentUser, selectedPatient, showFallAlert]);

  useEffect(() => {
    if (currentUser?.role !== 'CAREGIVER') return;
    let active = true;
    setPatientsLoading(true);
    setPatientsError(null);

    fetchPatients(currentUser.token)
      .then((rows) => {
        if (!active) return;
        setPatients(rows);
        const next = rows.find((row) => row.id === selectedPatient.id) ?? rows[0];
        if (next) {
          setSelectedPatient(next);
        }
      })
      .catch(() => {
        if (active) setPatientsError('Unable to load patients. Tap to retry.');
      })
      .finally(() => {
        if (active) setPatientsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser, patientsReload]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    const loadTelemetry = async () => {
      try {
        const data = await fetchLatest(selectedPatient.roomDeviceId, selectedPatient.wearableDeviceId);
        if (!active) return;

        const hr = data.heart_rate?.value ?? null;
        const oxygen = data.spo2?.value ?? null;
        const bodyTemp = data.cardio_temp?.value ?? null;
        const ambientTemp = data.temperature?.value ?? null;
        const roomHumidity = data.humidity?.value ?? null;
        const motion = data.motion_detected?.value;
        const wearableTimestamps = [
          data.heart_rate?.timestamp,
          data.spo2?.timestamp,
          data.cardio_temp?.timestamp,
        ].filter((value): value is string => Boolean(value));
        const latestWearableTimestamp = wearableTimestamps.sort().at(-1) ?? null;
        const latestTimestamp = latestWearableTimestamp ?? data.last_seen;

        setHeartRate(hr);
        setSpo2(oxygen);
        setSensorTemp(bodyTemp);
        setRoomTemp(ambientTemp);
        setHumidity(roomHumidity);
        setMotionDetected(motion == null ? null : motion > 0);
        setRoomTelemetryAt(data.last_seen);
        setWearableTelemetryAt(latestWearableTimestamp);
        setTelemetryError(null);

        if (latestTimestamp && hr != null && oxygen != null) {
          const t = new Date(latestTimestamp).getTime();
          setHistoryData((previous) => {
            if (previous.at(-1)?.t === t) return previous;
            return [...previous, {
              t,
              timeStr: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              heartRate: hr ?? undefined,
              spo2: oxygen ?? undefined,
              roomTemp: ambientTemp ?? undefined,
              humidity: roomHumidity ?? undefined,
              bodyTemp: bodyTemp ?? undefined,
              motion: motion ?? undefined,
            }].slice(-24);
          });
        }
      } catch {
        if (active) setTelemetryError('Unable to load current readings. Please try again shortly.');
      }
    };

    loadTelemetry();
    const refresh = setInterval(loadTelemetry, 15000);
    return () => {
      active = false;
      clearInterval(refresh);
    };
  }, [currentUser, selectedPatient.roomDeviceId, selectedPatient.wearableDeviceId]);

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'ACKNOWLEDGED' } : a
      )
    );
  };

  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  const selectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    setIsMenuOpen(false);
  };

  const switchRole = (newRole: UserRole) => {
    setCurrentUser((u) => (u ? { ...u, role: newRole } : u));
    setIsAuthModalOpen(false);
    if (newRole === 'PATIENT') setCurrentTab('dual');
  };

  const handleSaveThresholds = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const getTabTitle = (tab: NavTab) => {
    switch (tab) {
      case 'patients':
        return 'Assigned Patients';
      case 'dual':
        return 'Patient Dashboard';
      case 'history':
        return isCaregiver ? 'History & Trends' : 'My Health Analytics';
      case 'alerts':
        return 'Alerts Desk';
      case 'settings':
        return isCaregiver ? 'Thresholds & Settings' : 'My Profile & Settings';
    }
  };

  const connectionLabel = telemetryError
    ? 'Offline'
    : roomTelemetryAt || wearableTelemetryAt
      ? 'Up to date'
      : 'Syncing';
  const isTelemetrySyncing = !telemetryError && !roomTelemetryAt && !wearableTelemetryAt;

  if (!currentUser) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <AuthScreen
            previousUser={lastUser}
            onLogin={(user) => {
              setLastUser(user);
              setCurrentUser(user);
              if (user.role === 'PATIENT') {
                setCurrentTab('dual');
              } else {
                setCurrentTab('patients');
              }
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* 1. TOP HEADER WITH USER ROLE BADGE & HAMBURGER BUTTON */}
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Activity size={18} color="#ffffff" />
              </View>
              <View>
                <View style={styles.brandNameRow}>
                  <Text style={styles.brandName}>CareTrack</Text>
                  <Text style={styles.brandSlash}> / {isCaregiver ? 'Care Taker' : 'Patient'}</Text>
                </View>
                <Text style={styles.brandSub}>
                  {getTabTitle(currentTab)}
                </Text>
              </View>
            </View>

            {/* Header Right: Role Switcher & Hamburger Button */}
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[
                  styles.rolePill,
                  isCaregiver ? styles.rolePillCaretaker : styles.rolePillPatient,
                ]}
                onPress={() => setIsAuthModalOpen(true)}
              >
                <Text
                  style={[
                    styles.rolePillText,
                    isCaregiver ? styles.rolePillTextCaretaker : styles.rolePillTextPatient,
                  ]}
                >
                  {isCaregiver ? 'Care Taker' : 'Patient'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.hamburgerBtn}
                onPress={() => setIsMenuOpen(true)}
                accessibilityLabel="Open Navigation Menu"
              >
                <Menu size={20} color={theme.text} />
                {activeAlertsCount > 0 && isCaregiver && (
                  <View style={styles.hamburgerBadge}>
                    <Text style={styles.hamburgerBadgeText}>
                      {activeAlertsCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Connection Subbar */}
          <View style={styles.connectionBar}>
            <View style={styles.patientUnitBadge}>
              <Text style={styles.patientUnitText}>
                {selectedPatient.firstName} {selectedPatient.lastName} • {selectedPatient.roomNumber}
              </Text>
            </View>

            <View style={[styles.statusPillOk, isTelemetrySyncing && styles.statusPillNeutral, telemetryError && styles.statusPillBad]}>
              <View style={[styles.statusDotOk, isTelemetrySyncing && styles.statusDotNeutral, telemetryError && styles.statusDotBad]} />
              <Text style={[styles.statusTextOk, isTelemetrySyncing && styles.statusTextNeutral, telemetryError && styles.statusTextBad]}>{connectionLabel}</Text>
            </View>
          </View>
        </View>

        {/* 2. ROLE SWITCHER & AUTH MODAL */}
        <Modal
          visible={isAuthModalOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setIsAuthModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setIsAuthModalOpen(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={styles.authModalCard}>
              <View style={styles.authModalHeader}>
                <View style={styles.brandMark}>
                  <Activity size={18} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.authModalTitle}>CareTrack Identity Portal</Text>
                  <Text style={styles.authModalSub}>Select active clinical access role</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setIsAuthModalOpen(false)}
                >
                  <X size={18} color={theme.text2} />
                </TouchableOpacity>
              </View>

              <View style={styles.roleCardList}>
                {/* Patient Role Card */}
                <TouchableOpacity
                  style={[
                    styles.roleSelectCard,
                    currentUser.role === 'PATIENT' && styles.roleSelectCardActive,
                  ]}
                  onPress={() => switchRole('PATIENT')}
                >
                  <View style={styles.roleCardLeft}>
                    <View style={[styles.roleIconWrap, { backgroundColor: '#fdeeee' }]}>
                      <Heart size={20} color="#b4232a" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.roleNameRow}>
                        <Text style={styles.roleTitle}>Patient Portal</Text>
                        <View style={styles.patientPill}>
                          <Text style={styles.patientPillText}>Personal Vitals</Text>
                        </View>
                      </View>
                      <Text style={styles.roleUserName}>
                        {currentUser.fullName}
                      </Text>
                      <Text style={styles.roleDesc}>
                        Wearable cardiac vitals, SpO2 & health trends
                      </Text>
                    </View>
                  </View>
                  {currentUser.role === 'PATIENT' && (
                    <Check size={18} color="#b4232a" />
                  )}
                </TouchableOpacity>

                {/* Care Taker Role Card */}
                <TouchableOpacity
                  style={[
                    styles.roleSelectCard,
                    currentUser.role === 'CAREGIVER' && styles.roleSelectCardActive,
                  ]}
                  onPress={() => switchRole('CAREGIVER')}
                >
                  <View style={styles.roleCardLeft}>
                    <View style={[styles.roleIconWrap, { backgroundColor: '#e9f6ee' }]}>
                      <ShieldCheck size={20} color="#16794a" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.roleNameRow}>
                        <Text style={styles.roleTitle}>Care Taker Portal</Text>
                        <View style={styles.caretakerPill}>
                          <Text style={styles.caretakerPillText}>Special Access</Text>
                        </View>
                      </View>
                      <Text style={styles.roleUserName}>{currentUser.fullName}</Text>
                      <Text style={styles.roleDesc}>
                        Room units, all patients & set alert threshold ranges
                      </Text>
                    </View>
                  </View>
                  {currentUser.role === 'CAREGIVER' && (
                    <Check size={18} color="#16794a" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 3. SLIDE-OVER HAMBURGER DRAWER MENU */}
        <Modal
          visible={isMenuOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setIsMenuOpen(false)}
        >
          <View style={styles.drawerOverlay}>
            <TouchableWithoutFeedback onPress={() => setIsMenuOpen(false)}>
              <View style={styles.drawerBackdrop} />
            </TouchableWithoutFeedback>

            <View style={styles.drawerContainer}>
              {/* Drawer User Card */}
              <View style={styles.drawerUserSection}>
                <View style={styles.drawerUserHeader}>
                  <View
                    style={[
                      styles.drawerAvatar,
                      {
                        backgroundColor: isCaregiver ? '#e9f6ee' : '#fdeeee',
                        borderColor: isCaregiver ? '#bfe3cc' : '#f5c6c8',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.drawerAvatarText,
                        { color: isCaregiver ? '#16794a' : '#b4232a' },
                      ]}
                    >
                      {currentUser.fullName[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerUserName}>{currentUser.fullName}</Text>
                    <Text style={styles.drawerUserRole}>
                      {isCaregiver ? 'Attending Care Taker' : 'Monitored Patient'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setIsMenuOpen(false)}
                  >
                    <X size={18} color={theme.text2} />
                  </TouchableOpacity>
                </View>

                {/* Quick Role Switcher Inside Drawer */}
                <TouchableOpacity
                  style={styles.drawerRoleSwitchBtn}
                  onPress={() => {
                    setIsMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                >
                  <ArrowLeftRight size={13} color={theme.accent} />
                  <Text style={styles.drawerRoleSwitchText}>
                    Switch Identity / Role
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Navigation Menu Links Based on Active Role */}
              <ScrollView style={styles.drawerMenu} contentContainerStyle={styles.drawerMenuContent}>
                <Text style={styles.menuSectionHeader}>
                  {isCaregiver ? 'CARE TAKER ACCESS' : 'PATIENT TELEMETRY'}
                </Text>

                {isCaregiver && (
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      currentTab === 'patients' && styles.menuItemActive,
                    ]}
                    onPress={() => selectTab('patients')}
                  >
                    <View style={styles.menuItemLeft}>
                      <View
                        style={[
                          styles.menuIconBox,
                          currentTab === 'patients' && styles.menuIconBoxActive,
                        ]}
                      >
                        <UserCheck
                          size={16}
                          color={currentTab === 'patients' ? theme.accent : theme.text2}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.menuItemText,
                            currentTab === 'patients' && styles.menuItemTextActive,
                          ]}
                        >
                          Patients Directory
                        </Text>
                        <Text style={styles.menuItemDesc}>
                          View all {patients.length} assigned patients
                        </Text>
                      </View>
                    </View>
                    {currentTab === 'patients' && (
                      <Check size={16} color={theme.accent} />
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.menuItem, currentTab === 'dual' && styles.menuItemActive]}
                  onPress={() => selectTab('dual')}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={[styles.menuIconBox, currentTab === 'dual' && styles.menuIconBoxActive]}>
                      <Activity size={16} color={currentTab === 'dual' ? theme.accent : theme.text2} />
                    </View>
                    <View>
                      <Text style={[styles.menuItemText, currentTab === 'dual' && styles.menuItemTextActive]}>
                        Patient Dashboard
                      </Text>
                      <Text style={styles.menuItemDesc}>Room and wearable readings</Text>
                    </View>
                  </View>
                  {currentTab === 'dual' && <Check size={16} color={theme.accent} />}
                </TouchableOpacity>

                <Text style={[styles.menuSectionHeader, { marginTop: 14 }]}>
                  ANALYTICS & SETTINGS
                </Text>

                {/* History (Accessible by Both) */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    currentTab === 'history' && styles.menuItemActive,
                  ]}
                  onPress={() => selectTab('history')}
                >
                  <View style={styles.menuItemLeft}>
                    <View
                      style={[
                        styles.menuIconBox,
                        currentTab === 'history' && styles.menuIconBoxActive,
                      ]}
                    >
                      <Clock
                        size={16}
                        color={currentTab === 'history' ? theme.accent : theme.text2}
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.menuItemText,
                          currentTab === 'history' && styles.menuItemTextActive,
                        ]}
                      >
                        {isCaregiver ? 'History & Trends' : 'My Health Analytics'}
                      </Text>
                      <Text style={styles.menuItemDesc}>
                        Recent vital-sign trends
                      </Text>
                    </View>
                  </View>
                  {currentTab === 'history' && (
                    <Check size={16} color={theme.accent} />
                  )}
                </TouchableOpacity>

                {/* Alerts Desk (Care Taker Only) */}
                {isCaregiver ? (
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      currentTab === 'alerts' && styles.menuItemActive,
                    ]}
                    onPress={() => selectTab('alerts')}
                  >
                    <View style={styles.menuItemLeft}>
                      <View
                        style={[
                          styles.menuIconBox,
                          currentTab === 'alerts' && styles.menuIconBoxActive,
                        ]}
                      >
                        <Bell
                          size={16}
                          color={currentTab === 'alerts' ? theme.bad : theme.text2}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.menuItemText,
                            currentTab === 'alerts' && styles.menuItemTextActive,
                          ]}
                        >
                          Alerts Desk
                        </Text>
                        <Text style={styles.menuItemDesc}>
                          Incident acknowledgment & notes
                        </Text>
                      </View>
                    </View>
                    {activeAlertsCount > 0 ? (
                      <View style={styles.drawerAlertBadge}>
                        <Text style={styles.drawerAlertBadgeText}>
                          {activeAlertsCount}
                        </Text>
                      </View>
                    ) : currentTab === 'alerts' ? (
                      <Check size={16} color={theme.accent} />
                    ) : null}
                  </TouchableOpacity>
                ) : null}

                {/* Settings / Thresholds */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    currentTab === 'settings' && styles.menuItemActive,
                  ]}
                  onPress={() => selectTab('settings')}
                >
                  <View style={styles.menuItemLeft}>
                    <View
                      style={[
                        styles.menuIconBox,
                        currentTab === 'settings' && styles.menuIconBoxActive,
                      ]}
                    >
                      <Settings
                        size={16}
                        color={currentTab === 'settings' ? theme.accent : theme.text2}
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.menuItemText,
                          currentTab === 'settings' && styles.menuItemTextActive,
                        ]}
                      >
                        {isCaregiver ? 'Thresholds & Settings' : 'My Health Profile'}
                      </Text>
                      <Text style={styles.menuItemDesc}>
                        {isCaregiver
                          ? 'Set sensor ranges & alert rules'
                          : 'Profile & notification preferences'}
                      </Text>
                    </View>
                  </View>
                  {currentTab === 'settings' && (
                    <Check size={16} color={theme.accent} />
                  )}
                </TouchableOpacity>
              </ScrollView>

              {/* Drawer Sign Out Button */}
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
                <TouchableOpacity
                  style={styles.drawerSignOutBtn}
                  onPress={() => {
                    setIsMenuOpen(false);
                    setCurrentUser(null);
                  }}
                >
                  <LogIn size={15} color={theme.bad} />
                  <Text style={styles.drawerSignOutText}>Sign Out of CareTrack</Text>
                </TouchableOpacity>
              </View>

              {/* Drawer Footer */}
              <View style={styles.drawerFooter}>
                <Text style={styles.drawerVersion}>
                  CareTrack Patient & Health Safety
                </Text>
              </View>
            </View>
          </View>
        </Modal>

        {/* 4. MAIN CONTENT BODY */}
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
        >
          {/* VIEW: PATIENTS DIRECTORY (CARE TAKER EXCLUSIVE) */}
          {currentTab === 'patients' && (
            <PatientsScreen
              patients={patients}
              caregiverName={currentUser.fullName}
              loading={patientsLoading}
              error={patientsError}
              onRetry={() => setPatientsReload((value) => value + 1)}
              selectedPatientId={selectedPatient.id}
              onSelectPatient={(p) => {
                setSelectedPatient(p);
                setHeartRate(null);
                setSpo2(null);
                setSensorTemp(null);
                setRoomTemp(null);
                setHumidity(null);
                setMotionDetected(null);
                setRoomTelemetryAt(null);
                setWearableTelemetryAt(null);
                setTelemetryError(null);
                setHistoryData([]);
                setCurrentTab('dual');
              }}
            />
          )}

          {/* Combined room and wearable dashboard */}
          {currentTab === 'dual' && (
            <PatientDashboard
              patient={selectedPatient}
              heartRate={heartRate}
              spo2={spo2}
              sensorTemp={sensorTemp}
              roomTemp={roomTemp}
              humidity={humidity}
              motionDetected={motionDetected}
              history={historyData}
              roomUpdatedAt={roomTelemetryAt}
              wearableUpdatedAt={wearableTelemetryAt}
              error={telemetryError}
              onBack={() => setCurrentTab('patients')}
            />
          )}

          {/* VIEW: HISTORY */}
          {currentTab === 'history' && (
            <View>
              <View style={styles.pageHead}>
                <Text style={styles.pageTitle}>
                  {isCaregiver ? 'Historical Telemetry' : 'My Health Analytics'}
                </Text>
                <Text style={styles.pageDesc}>
                  Recent heart rate and oxygen trends
                </Text>
              </View>

              <View style={styles.cardContainer}>
                <Text style={styles.cardTitle}>Heart Rate & SpO2</Text>
                <TelemetryChart data={historyData} height={180} />
              </View>
            </View>
          )}

          {/* VIEW: ALERTS (CARE TAKER ONLY) */}
          {currentTab === 'alerts' && (
            <View>
              <View style={styles.pageHead}>
                <Text style={styles.pageTitle}>Alerts Desk</Text>
                <Text style={styles.pageDesc}>
                  Patient safety incidents and threshold breaches
                </Text>
              </View>

              {alerts.map((alt) => (
                <View key={alt.id} style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <View
                      style={[
                        styles.severityPill,
                        {
                          backgroundColor:
                            alt.severity === 'CRITICAL'
                              ? theme.badBg
                              : alt.severity === 'WARNING'
                              ? theme.warnBg
                              : theme.okBg,
                          borderColor:
                            alt.severity === 'CRITICAL'
                              ? theme.badBorder
                              : alt.severity === 'WARNING'
                              ? theme.warnBorder
                              : theme.okBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityPillText,
                          {
                            color:
                              alt.severity === 'CRITICAL'
                                ? theme.bad
                                : alt.severity === 'WARNING'
                                ? theme.warn
                                : theme.ok,
                          },
                        ]}
                      >
                        {alt.severity}
                      </Text>
                    </View>
                    <Text style={styles.alertTime}>{alt.timestamp}</Text>
                  </View>

                  <Text style={styles.alertTitleText}>{alt.title}</Text>
                  <Text style={styles.alertMessageText}>{alt.message}</Text>

                  {alt.status === 'ACTIVE' && (
                    <TouchableOpacity
                      style={styles.ackButton}
                      onPress={() => handleAcknowledgeAlert(alt.id)}
                    >
                      <Check size={14} color={theme.accent} />
                      <Text style={styles.ackButtonText}>Acknowledge</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {alerts.length === 0 && (
                <View style={styles.cardContainer}>
                  <Text style={styles.infoNoticeText}>No active alerts.</Text>
                </View>
              )}
            </View>
          )}

          {/* VIEW: SETTINGS & SENSOR THRESHOLD CONFIGURATION */}
          {currentTab === 'settings' && (
            <View>
              <View style={styles.pageHead}>
                <Text style={styles.pageTitle}>
                  {isCaregiver ? 'Thresholds & Settings' : 'My Health Profile'}
                </Text>
                <Text style={styles.pageDesc}>
                  {isCaregiver
                    ? 'Set the ranges used to generate alerts'
                    : 'Personal notification settings and clinical contact profile'}
                </Text>
              </View>

              {/* Feedback toast */}
              {savedToast && (
                <View style={styles.savedToast}>
                  <Check size={14} color="#16794a" />
                  <Text style={styles.savedToastText}>
                    Sensor ranges updated and alert generation rules synchronized!
                  </Text>
                </View>
              )}

              {/* SENSOR VALUE RANGE / THRESHOLDS (CARE TAKER SPECIAL ACCESS) */}
              <View style={styles.cardContainer}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Sensor Alert Boundaries</Text>
                  {isCaregiver ? (
                    <View style={styles.caretakerPill}>
                      <Text style={styles.caretakerPillText}>Special Access</Text>
                    </View>
                  ) : (
                    <View style={styles.lockedPill}>
                      <Lock size={10} color="#b56012" />
                      <Text style={styles.lockedPillText}>Care Taker Only</Text>
                    </View>
                  )}
                </View>

                {!isCaregiver && (
                  <View style={styles.infoNotice}>
                    <Text style={styles.infoNoticeText}>
                      These alert ranges are configured by your assigned care taker. When your wearable detects vitals outside these bounds, your care taker is instantly notified.
                    </Text>
                  </View>
                )}

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Resting Heart Rate Min</Text>
                  {isCaregiver ? (
                    <TextInput
                      style={styles.settingInput}
                      value={hrMin}
                      onChangeText={setHrMin}
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.settingVal}>{hrMin} bpm</Text>
                  )}
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Resting Heart Rate Max</Text>
                  {isCaregiver ? (
                    <TextInput
                      style={styles.settingInput}
                      value={hrMax}
                      onChangeText={setHrMax}
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.settingVal}>{hrMax} bpm</Text>
                  )}
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>SpO2 Critical Floor</Text>
                  {isCaregiver ? (
                    <TextInput
                      style={styles.settingInput}
                      value={spo2Min}
                      onChangeText={setSpo2Min}
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.settingVal}>{spo2Min} %</Text>
                  )}
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Fall Shock Threshold</Text>
                  {isCaregiver ? (
                    <TextInput
                      style={styles.settingInput}
                      value={fallG}
                      onChangeText={setFallG}
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.settingVal}>{fallG} g</Text>
                  )}
                </View>

                {isCaregiver && (
                  <>
                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Room Temp Min (°C)</Text>
                      <TextInput
                        style={styles.settingInput}
                        value={roomTempMin}
                        onChangeText={setRoomTempMin}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Room Temp Max (°C)</Text>
                      <TextInput
                        style={styles.settingInput}
                        value={roomTempMax}
                        onChangeText={setRoomTempMax}
                        keyboardType="numeric"
                      />
                    </View>
                  </>
                )}

                {isCaregiver && (
                  <TouchableOpacity
                    style={styles.saveSettingsBtn}
                    onPress={handleSaveThresholds}
                  >
                    <Save size={14} color="#ffffff" />
                    <Text style={styles.saveSettingsBtnText}>
                      Save Alert Generation Thresholds
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Global Fall Alert Modal */}
        <FallAlertModal
          visible={fallAlert.visible}
          magnitude={fallAlert.magnitude}
          heightM={fallAlert.heightM}
          category={fallAlert.category}
          timestamp={fallAlert.timestamp}
          patientName={fallAlert.patientName}
          roomNumber={fallAlert.roomNumber}
          onSilence={() => setFallAlert((prev) => ({ ...prev, visible: false }))}
          onConfirm={() => setFallAlert((prev) => ({ ...prev, visible: false }))}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 2,
  },
  headerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
  },
  brandSlash: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text2,
  },
  brandSub: {
    fontSize: 10,
    color: theme.text3,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  rolePillCaretaker: {
    backgroundColor: '#e9f6ee',
    borderColor: '#bfe3cc',
  },
  rolePillPatient: {
    backgroundColor: '#fdeeee',
    borderColor: '#f5c6c8',
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rolePillTextCaretaker: {
    color: '#16794a',
  },
  rolePillTextPatient: {
    color: '#b4232a',
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hamburgerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: theme.bad,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  hamburgerBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  connectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
  },
  roomInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 26,
  },
  roomPrefix: {
    fontSize: 10,
    color: theme.text3,
    marginRight: 4,
  },
  roomInput: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.text,
    padding: 0,
    minWidth: 80,
  },
  patientUnitBadge: {
    backgroundColor: theme.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  patientUnitText: {
    fontSize: 10,
    color: theme.text2,
    fontWeight: '600',
  },
  connectBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.okBg,
    borderWidth: 1,
    borderColor: theme.okBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDotOk: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.ok,
  },
  statusTextOk: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.ok,
  },
  statusPillBad: {
    backgroundColor: theme.badBg,
    borderColor: theme.badBorder,
  },
  statusDotBad: {
    backgroundColor: theme.bad,
  },
  statusTextBad: {
    color: theme.bad,
  },
  statusPillNeutral: {
    backgroundColor: theme.bg,
    borderColor: theme.border,
  },
  statusDotNeutral: {
    backgroundColor: theme.text3,
  },
  statusTextNeutral: {
    color: theme.text2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  authModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  authModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  authModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  authModalSub: {
    fontSize: 11,
    color: theme.text3,
    marginTop: 1,
  },
  roleCardList: {
    gap: 12,
  },
  roleSelectCard: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleSelectCardActive: {
    borderColor: theme.accent,
    backgroundColor: theme.surface,
  },
  roleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
  },
  patientPill: {
    backgroundColor: '#fdeeee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  patientPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b4232a',
  },
  caretakerPill: {
    backgroundColor: '#e9f6ee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  caretakerPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16794a',
  },
  roleUserName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text2,
    marginTop: 2,
  },
  roleDesc: {
    fontSize: 10,
    color: theme.text3,
    marginTop: 2,
    lineHeight: 14,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerContainer: {
    width: '78%',
    maxWidth: 320,
    backgroundColor: theme.surface,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    paddingTop: 48,
    display: 'flex',
  },
  drawerUserSection: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  drawerUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  drawerUserName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  drawerUserRole: {
    fontSize: 10,
    color: theme.text3,
    fontWeight: '600',
  },
  drawerRoleSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  drawerRoleSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerMenu: {
    flex: 1,
  },
  drawerMenuContent: {
    padding: 16,
    gap: 6,
  },
  menuSectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.text3,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuItemActive: {
    backgroundColor: theme.accentLight,
    borderColor: theme.okBorder,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBoxActive: {
    backgroundColor: '#ffffff',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text2,
  },
  menuItemTextActive: {
    color: theme.accent,
    fontWeight: '800',
  },
  menuItemDesc: {
    fontSize: 9,
    color: theme.text3,
    marginTop: 1,
  },
  drawerAlertBadge: {
    backgroundColor: theme.bad,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  drawerAlertBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.bg,
  },
  drawerSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fdeeee',
    borderWidth: 1,
    borderColor: '#f5c6c8',
    borderRadius: 8,
    paddingVertical: 10,
  },
  drawerSignOutText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#b4232a',
  },
  drawerVersion: {
    fontSize: 10,
    color: theme.text3,
  },
  scrollBody: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  pageHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.3,
  },
  pageDesc: {
    fontSize: 12,
    color: theme.text2,
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  cardContainer: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fdf3e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b56012',
  },
  infoNotice: {
    backgroundColor: '#f8faf7',
    borderWidth: 1,
    borderColor: '#e2e8e6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  infoNoticeText: {
    fontSize: 11,
    color: theme.text2,
    lineHeight: 16,
  },
  savedToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e9f6ee',
    borderWidth: 1,
    borderColor: '#bfe3cc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  savedToastText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16794a',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingLabel: {
    fontSize: 12,
    color: theme.text2,
    flex: 1,
  },
  settingVal: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
  },
  settingInput: {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    minWidth: 80,
    textAlign: 'right',
  },
  saveSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 14,
  },
  saveSettingsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  alertCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 10,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  alertTime: {
    fontSize: 11,
    color: theme.text3,
  },
  alertTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  alertMessageText: {
    fontSize: 12,
    color: theme.text2,
    marginTop: 4,
    lineHeight: 16,
  },
  ackButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
  },
  ackButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent,
  },
});
