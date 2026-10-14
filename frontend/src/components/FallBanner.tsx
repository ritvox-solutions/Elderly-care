import { fmtT } from '../lib/format';

export default function FallBanner({
  magnitude,
  at,
  heightM,
  category,
  onDismiss,
}: {
  magnitude: number;
  at: string;
  heightM?: number;
  category?: string;
  onDismiss: () => void;
}) {
  const magStr = `${magnitude.toFixed(2)}g`;
  const heightStr = heightM ? `${heightM.toFixed(2)} m (~${(heightM * 3.28084).toFixed(1)} ft)` : null;

  return (
    <div className="fall-alert-banner">
      <div className="fall-alert-content">
        <div className="fall-alert-icon">⚠️</div>
        <div className="fall-alert-text">
          <strong>CRITICAL EMERGENCY: PATIENT FALL DETECTED!</strong>
          <span>
            <strong>High-G Impact Fall</strong> — Recorded {magStr} deceleration shock at{' '}
            {fmtT(at)}.
            {heightStr && (
              <>
                {' '}
                Estimated fall height: <strong>{heightStr}</strong>
                {category ? ` [${category}]` : ''}.
              </>
            )}{' '}
            Immediate caregiver response dispatched!
          </span>
        </div>
        <button type="button" className="fall-alert-btn" onClick={onDismiss}>
          Acknowledge &amp; Dismiss
        </button>
      </div>
    </div>
  );
}
