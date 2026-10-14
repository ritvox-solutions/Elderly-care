function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { AuthUser, UserRole } from '../lib/store';

const tabCls = ({ isActive }: { isActive: boolean }) => `nav-tab${isActive ? ' active' : ''}`;

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 2.6-6.3" />
      <polyline points="3 4 3.4 8.6 8 8.2" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export default function Chrome({
  connMode,
  mqttMode,
  role = 'CAREGIVER',
  authUser,
  selectedPatient,
  onToggleRole,
  onLogout,
}: {
  connMode?: string;
  mqttMode?: string;
  role?: UserRole;
  authUser?: AuthUser | null;
  selectedPatient?: any;
  onToggleRole?: () => void;
  onLogout?: () => void;
}) {
  const isCaregiver = role === 'CAREGIVER';
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const fullName = authUser?.fullName?.trim() ?? '';
  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const initials = (nameParts.length ? nameParts : [authUser?.email ?? ''])
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="top">
      <div className="top-inner">
        <NavLink to={isCaregiver ? '/patients' : '/cardio'} className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h4l2.5-6 4 12 2.5-6H21"
                stroke="#fff"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="brand-name">
              CareTrack <span>/ {isCaregiver ? 'Care Taker Console' : 'Patient Portal'}</span>
            </div>
            <div className="brand-sub">
              {isCaregiver ? 'Telemetry & Environmental Monitor' : 'Personal Wearable Health & Safety'}
            </div>
          </div>
        </NavLink>

        <div className="divider" aria-hidden="true"></div>

        <nav className="nav-tabs" aria-label="Views">
          {isCaregiver && (
            <NavLink to="/patients" className={tabCls}>
              <UsersIcon />
              Patients Directory
            </NavLink>
          )}
          {!isCaregiver && (
            <NavLink to="/cardio" className={tabCls}>
              <HeartIcon />
              My Wearable &amp; Vitals
            </NavLink>
          )}
          <NavLink to="/history" className={tabCls}>
            <HistoryIcon />
            History
          </NavLink>
          <NavLink to="/alerts" className={tabCls}>
            <BellIcon />
            Alerts
          </NavLink>
          <NavLink to="/settings" className={tabCls}>
            <GearIcon />
            Settings
          </NavLink>
        </nav>

        <div className="header-actions">
          {authUser && (
            <div className="account" ref={accountRef}>
              <button
                type="button"
                className="account-trigger"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="account-avatar">{initials}</span>
                <span className="account-meta">
                  <span className="account-name">{fullName || authUser.email}</span>
                  <span className="account-role">{isCaregiver ? 'Care Taker' : 'Patient'}</span>
                </span>
                <svg className="account-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <div className="account-pop" role="menu">
                  <div className="account-pop-head">
                    <span className="account-pop-label">Signed in as</span>
                    <span className="account-pop-name">{fullName || authUser.email}</span>
                    <span className="account-pop-mail">{authUser.email}</span>
                  </div>

                  {isCaregiver && selectedPatient && (
                    <div className="account-pop-block">
                      <span className="account-pop-label">Active patient</span>
                      <NavLink
                        to="/patients"
                        className="account-pop-link"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="account-pop-dot"></span>
                        <span className="account-pop-patient">
                          <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                          <span className="account-pop-room">{selectedPatient.roomNumber}</span>
                        </span>
                        <span className="account-pop-cta">Switch</span>
                      </NavLink>
                    </div>
                  )}

                  <div className="account-pop-actions">
                    <button
                      type="button"
                      className="account-pop-btn"
                      role="menuitem"
                      onClick={() => {
                        onToggleRole?.();
                        setMenuOpen(false);
                      }}
                    >
                      Switch to {isCaregiver ? 'Patient' : 'Care Taker'}
                    </button>
                    {onLogout && (
                      <button
                        type="button"
                        className="account-pop-btn danger"
                        role="menuitem"
                        onClick={() => {
                          onLogout();
                          setMenuOpen(false);
                        }}
                      >
                        Sign Out
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={`status-badge${connMode ? ` ${connMode}` : ''}`} title="Room sensor telemetry status">
            <span className="led"></span>
            <span>Room Unit</span>
          </div>

          <div
            className={`status-badge${mqttMode ? ` ${mqttMode}` : ''}`}
            title="Wearable cardiac and fall sensor status"
          >
            <span className="led"></span>
            <span>{mqttMode === 'live' ? 'Wearable Online' : 'Wearable Syncing'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
