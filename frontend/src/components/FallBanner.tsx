import { fmtT } from '../lib/format';

// Emergency banner DOM — copied from backend/static/index.html
export default function FallBanner({
  magnitude,
  at,
  onDismiss,
}: {
  magnitude: number;
  at: string;
  onDismiss: () => void;
}) {
  const magStr = `${magnitude.toFixed(2)}g`;
  return (
    <div className="fall-alert-banner">
      <div className="fall-alert-content">
        <div className="fall-alert-icon">⚠️</div>
        <div className="fall-alert-text">
          <strong>CRITICAL EMERGENCY: PATIENT FALL DETECTED!</strong>
          <span>
            <strong>High-G Impact Fall</strong> — Recorded {magStr} deceleration shock at{' '}
            {fmtT(at)}. Immediate caregiver response dispatched!
          </span>
        </div>
        <button type="button" className="fall-alert-btn" onClick={onDismiss}>
          Acknowledge &amp; Dismiss
        </button>
      </div>
    </div>
  );
}
