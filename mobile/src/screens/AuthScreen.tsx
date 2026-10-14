import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Activity,
  Heart,
  ShieldCheck,
  User,
  Mail,
  Lock,
  Phone,
  Check,
} from 'lucide-react-native';
import { theme } from '../theme';

export type UserRole = 'PATIENT' | 'CAREGIVER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  assignedRoomId?: string;
  assignedWearableId?: string;
  patientRoom?: string;
  token?: string;
}

interface AuthScreenProps {
  onLogin: (user: AuthUser) => void;
  previousUser?: AuthUser | null;
}

export function AuthScreen({ onLogin, previousUser }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<UserRole>(previousUser?.role || 'CAREGIVER');
  const [email, setEmail] = useState(previousUser?.email || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCaregiver = role === 'CAREGIVER';

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }

        // Try backend registration
        try {
          const regRes = await fetch('http://10.0.2.2:8000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              password,
              full_name: fullName.trim(),
              role,
              phone_number: phoneNumber.trim() || null,
            }),
          });

          if (!regRes.ok) {
            const errData = await regRes.json().catch(() => ({}));
            if (errData.detail) throw new Error(errData.detail);
          }
        } catch (fetchErr: any) {
          // Only swallow transport failures; surface server-side validation errors
          if (fetchErr instanceof TypeError) {
            console.log('Mobile auth register fetch warning:', fetchErr.message);
          } else {
            throw fetchErr;
          }
        }
      }

      // Backend login - no offline fallback: a session must come from the server
      let loginRes: Response;
      try {
        loginRes = await fetch('http://10.0.2.2:8000/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        });
      } catch (networkErr: any) {
        console.log('Mobile login network warning:', networkErr.message);
        throw new Error(
          'Cannot reach the CareTrack server at 10.0.2.2:8000. Start the backend and try again.'
        );
      }

      if (!loginRes.ok) {
        const errData = await loginRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Incorrect email or password.');
      }

      const data = await loginRes.json();
      onLogin({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.full_name,
        role: data.user.role as UserRole,
        token: data.access_token,
      });
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.brandIconWrap}>
            <Activity size={24} color="#ffffff" />
          </View>
          <Text style={styles.brandTitle}>CareTrack</Text>
          <Text style={styles.brandSub}>Clinical Telemetry &amp; Vital Safety</Text>
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          {/* Segmented Mode Control */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
              onPress={() => {
                setMode('login');
                setError(null);
              }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, mode === 'signup' && styles.tabBtnActive]}
              onPress={() => {
                setMode('signup');
                setError(null);
              }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Previous Login Detected Card */}
          {previousUser && (
            <View style={styles.previousLoginCard}>
              <View style={styles.prevHeader}>
                <View style={[styles.prevAvatar, { backgroundColor: previousUser.role === 'CAREGIVER' ? '#e9f6ee' : '#fdeeee' }]}>
                  {previousUser.role === 'CAREGIVER' ? (
                    <ShieldCheck size={18} color="#16794a" />
                  ) : (
                    <Heart size={18} color="#b4232a" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prevLabel}>PREVIOUS LOGIN DETECTED</Text>
                  <Text style={styles.prevName}>{previousUser.fullName}</Text>
                  <Text style={styles.prevRole}>
                    {previousUser.role === 'CAREGIVER' ? 'Attending Care Taker' : 'Monitored Patient'} • {previousUser.email}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.prevContinueBtn}
                onPress={() => onLogin(previousUser)}
              >
                <Text style={styles.prevContinueBtnText}>
                  Continue as {previousUser.fullName.split(' ')[0]} ({previousUser.role === 'CAREGIVER' ? 'Care Taker' : 'Patient'}) →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Role Picker */}
          <Text style={styles.sectionLabel}>Select Your Role</Text>
          <View style={styles.rolePickerRow}>
            <TouchableOpacity
              style={[styles.roleBox, isCaregiver && styles.roleBoxActive]}
              onPress={() => setRole('CAREGIVER')}
            >
              <View style={styles.roleBoxHeader}>
                <View style={[styles.roleIconBadge, { backgroundColor: '#e9f6ee' }]}>
                  <ShieldCheck size={16} color="#16794a" />
                </View>
                {isCaregiver && <Check size={16} color={theme.accent} />}
              </View>
              <Text style={styles.roleBoxTitle}>Care Taker</Text>
              <Text style={styles.roleBoxDesc}>Room unit &amp; thresholds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleBox, !isCaregiver && styles.roleBoxActive]}
              onPress={() => setRole('PATIENT')}
            >
              <View style={styles.roleBoxHeader}>
                <View style={[styles.roleIconBadge, { backgroundColor: '#fdeeee' }]}>
                  <Heart size={16} color="#b4232a" />
                </View>
                {!isCaregiver && <Check size={16} color={theme.accent} />}
              </View>
              <Text style={styles.roleBoxTitle}>Patient</Text>
              <Text style={styles.roleBoxDesc}>Vitals &amp; fall monitoring</Text>
            </TouchableOpacity>
          </View>

          {/* Fields */}
          {mode === 'signup' && (
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputWrap}>
                <User size={16} color={theme.text3} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor={theme.text3}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Mail size={16} color={theme.text3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={theme.text3}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={theme.text3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="•••••••• (min 8 characters)"
                placeholderTextColor={theme.text3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {mode === 'signup' && (
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Phone Number (Optional)</Text>
              <View style={styles.inputWrap}>
                <Phone size={16} color={theme.text3} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={theme.text3}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

          {/* Submit Action */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'login'
                  ? `Sign In as ${isCaregiver ? 'Care Taker' : 'Patient'}`
                  : 'Create CareTrack Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.accent,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 12.5,
    color: theme.text2,
    marginTop: 2,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.bg,
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: theme.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text3,
  },
  tabTextActive: {
    color: theme.accent,
  },
  previousLoginCard: {
    backgroundColor: '#e6f0ed',
    borderWidth: 1,
    borderColor: '#cbd5d2',
    borderLeftWidth: 4,
    borderLeftColor: '#134135',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  prevHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  prevAvatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#134135',
    letterSpacing: 0.5,
  },
  prevName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1a2b27',
  },
  prevRole: {
    fontSize: 11,
    color: '#7a8f8a',
    marginTop: 1,
  },
  prevContinueBtn: {
    backgroundColor: '#134135',
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: 'center',
  },
  prevContinueBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: theme.badBg,
    borderColor: theme.badBorder,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: theme.bad,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text2,
    marginBottom: 8,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  roleBox: {
    flex: 1,
    backgroundColor: '#fbfcfb',
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
  },
  roleBoxActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentLight,
  },
  roleBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
  },
  roleBoxDesc: {
    fontSize: 10.5,
    color: theme.text3,
    marginTop: 2,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text2,
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 7,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 13.5,
    color: theme.text,
  },
  submitBtn: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
  },
});
