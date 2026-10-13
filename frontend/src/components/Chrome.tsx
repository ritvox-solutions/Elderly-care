import { NavLink } from 'react-router-dom';

const tabCls = ({ isActive }: { isActive: boolean }) => `nav-tab${isActive ? ' active' : ''}`;

function RoomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
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
  deviceId,
  onConnect,
  connText,
  connMode,
  mqttText,
  mqttMode,
}: {
  deviceId: string;
  onConnect: (id: string) => void;
  connText: string;
  connMode: string;
  mqttText: string;
  mqttMode: string;
}) {
  return (
    <header className="top">
      <div className="top-inner">
        <NavLink to="/" className="brand">
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
              CareTrack <span>/ Multi-Unit</span>
            </div>
            <div className="brand-sub">Telemetry &amp; Environmental Monitor</div>
          </div>
        </NavLink>

        <div className="divider" aria-hidden="true"></div>

        <nav className="nav-tabs" aria-label="Views">
          <NavLink to="/" end className={tabCls}>
            <RoomIcon />
            Room Unit
          </NavLink>
          <NavLink to="/cardio" className={tabCls}>
            <HeartIcon />
            Cardiac &amp; Fall
          </NavLink>
          <NavLink to="/dual" className={tabCls}>
            <GridIcon />
            Dual Overview
          </NavLink>
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
          <form
            className="device-group"
            title="Room Unit ID"
            onSubmit={(e) => {
              e.preventDefault();
              const v = (e.currentTarget.elements.namedItem('dev') as HTMLInputElement).value.trim();
              if (v) onConnect(v);
            }}
          >
            <label htmlFor="device">Room</label>
            <input
              id="device"
              name="dev"
              key={deviceId}
              defaultValue={deviceId}
              placeholder="room-unit-01"
              autoComplete="off"
              spellCheck="false"
            />
            <button id="connect" type="submit">
              Connect
            </button>
            <div className={`status-badge${connMode ? ` ${connMode}` : ''}`} title="Room Unit WebSocket connection">
              <span className="led"></span>
              <span>{connText}</span>
            </div>
          </form>

          <div
            className={`status-badge${mqttMode ? ` ${mqttMode}` : ''}`}
            title="Cardio Unit HiveMQ Cloud TLS connection"
          >
            <span className="led"></span>
            <span>{mqttText}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
