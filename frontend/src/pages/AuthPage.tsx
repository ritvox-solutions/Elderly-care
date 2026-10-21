import React, { useState } from 'react';
import type { AuthUser, UserRole } from '../lib/store';
import { DEMO_USERS } from '../lib/store';
import { API_BASE_URL, demoCaregiverLogin } from '../lib/api';

export default function AuthPage({
  onLogin,
  initialMode = 'login',
}: {
  onLogin: (user: AuthUser) => void;
  initialMode?: 'login' | 'signup';
}) {
  // Load previous login details
  const [previousUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('caretrack.lastLogin');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  // Role defaults based on previous login
  const [role, setRole] = useState<UserRole>(() => previousUser?.role || 'CAREGIVER');
  // Email defaults based on previous login
  const [email, setEmail] = useState(() => previousUser?.email || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(() => (previousUser ? previousUser.fullName : ''));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }

        const regRes = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
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
          throw new Error(errData.detail || 'Registration failed');
        }
      }

      // Perform Login
      const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!loginRes.ok) {
        const errData = await loginRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Invalid email or password');
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
      if (
        err instanceof TypeError ||
        (err.message &&
          (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')))
      ) {
        setError(
          `Cannot reach the CareTrack server at ${API_BASE_URL}. Please try again.`
        );
      } else {
        setError(err.message || 'Authentication error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoCaregiver = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await demoCaregiverLogin();
      onLogin({ id: data.user.id, email: data.user.email, fullName: data.user.full_name, role: data.user.role, token: data.access_token });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h4l2.5-6 4 12 2.5-6H21"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="auth-title">CareTrack Unified Monitor</h1>
          <p className="auth-subtitle">Clinical Telemetry &amp; Environmental Monitoring Portal</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        <div className="auth-body">
          {/* Direct Login for Two Roles */}
          <div className="auth-direct-section">
            <div className="auth-section-label">
              <span>⚡ Direct Role Login</span>
              <span className="auth-section-sub">One-click instant portal access</span>
            </div>

            <div className="auth-direct-cards">
              {/* Care Taker Direct Login */}
              <button
                type="button"
                className="auth-direct-btn caregiver"
                onClick={handleDemoCaregiver}
                disabled={loading}
              >
                <div className="auth-direct-icon">🩺</div>
                <div className="auth-direct-content">
                  <div className="auth-direct-header">
                    <span className="auth-direct-role-badge caregiver">Care Taker</span>
                    <span className="auth-direct-access">Ward &amp; Rooms Access</span>
                  </div>
                  <div className="auth-direct-name">Dr. Sarah Jenkins</div>
                  <div className="auth-direct-hint">Patients Directory • Live Room Units • Wearable Telemetry</div>
                </div>
                <div className="auth-direct-arrow">→</div>
              </button>

              {/* Patient Direct Login */}
              <button
                type="button"
                className="auth-direct-btn patient"
                onClick={() => onLogin(DEMO_USERS.PATIENT)}
              >
                <div className="auth-direct-icon">👤</div>
                <div className="auth-direct-content">
                  <div className="auth-direct-header">
                    <span className="auth-direct-role-badge patient">Patient</span>
                    <span className="auth-direct-access">Personal Telemetry</span>
                  </div>
                  <div className="auth-direct-name">Margaret Thatcher</div>
                  <div className="auth-direct-hint">My Wearable Vitals • Fall Alerts • Health Trends</div>
                </div>
                <div className="auth-direct-arrow">→</div>
              </button>
            </div>
          </div>

          <div className="auth-divider">
            <span>or sign in with credentials</span>
          </div>
          {/* Previous Login Quick Continue Card */}
          {previousUser && (
            <div className="auth-previous-login-card">
              <div className="auth-prev-header">
                <div className="auth-prev-avatar">
                  {previousUser.role === 'CAREGIVER' ? '🩺' : '👤'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="auth-prev-title">Previous Login Detected</div>
                  <div className="auth-prev-name">{previousUser.fullName}</div>
                  <div className="auth-prev-meta">
                    <span className={`role-pill ${previousUser.role === 'PATIENT' ? 'patient' : ''}`}>
                      {previousUser.role === 'CAREGIVER' ? 'Care Taker' : 'Patient'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{previousUser.email}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="ct-btn auth-continue-btn"
                onClick={() => onLogin(previousUser)}
              >
                Continue as {previousUser.fullName} ({previousUser.role === 'CAREGIVER' ? 'Care Taker' : 'Patient'}) →
              </button>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="auth-role-picker">
              <div
                className={`auth-role-card ${role === 'CAREGIVER' ? 'selected' : ''}`}
                onClick={() => setRole('CAREGIVER')}
              >
                <div className="auth-role-name">
                  <span>🩺 Care Taker</span>
                </div>
                <div className="auth-role-desc">Monitor rooms, cardiac telemetry &amp; thresholds</div>
              </div>

              <div
                className={`auth-role-card ${role === 'PATIENT' ? 'selected' : ''}`}
                onClick={() => setRole('PATIENT')}
              >
                <div className="auth-role-name">
                  <span>👤 Patient</span>
                </div>
                <div className="auth-role-desc">Wearable vitals, fall alerts &amp; personal trends</div>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="auth-field">
                <label className="auth-label">Full Name</label>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                className="auth-input"
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {mode === 'signup' && (
              <div className="auth-field">
                <label className="auth-label">Phone Number (Optional)</label>
                <input
                  className="auth-input"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading
                ? 'Authenticating...'
                : mode === 'login'
                ? `Sign In as ${role === 'CAREGIVER' ? 'Care Taker' : 'Patient'}`
                : 'Create CareTrack Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
