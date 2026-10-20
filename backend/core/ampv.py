"""Adaptive Multi-Parameter Verification (AMPV) decision rules.

AMPV reduces false emergency alarms by confirming a suspicious reading with
another independent sensor signal.  The research paper defines three rules:

1. Fall AND (abnormal heart rate OR low SpO2)
2. Abnormal heart rate AND high body temperature
3. Fall AND no room motion

The paper also lists clinical channel weights, but it does not define a scoring
formula or score threshold.  This implementation therefore follows the stated
Boolean rules exactly instead of inventing an unvalidated weighted calculation.
"""
from dataclasses import dataclass
from typing import Mapping


# Readings from the wearable and room unit are considered related when they
# occur within this window.  It can be recalibrated after physical trials.
AMPV_WINDOW_SECONDS = 60


@dataclass(frozen=True)
class AMPVDecision:
    """Result returned to the alert pipeline after evaluating all AMPV rules."""

    # True only when at least one complete multi-sensor rule matches.
    alert: bool
    # Stable rule name used in logs, persisted alert messages, and tests.
    rule: str | None = None
    # Sensor channels that provided evidence for the matched rule.
    signals: tuple[str, ...] = ()


def evaluate_ampv(data: Mapping[str, float | bool], thresholds: Mapping[str, float]) -> AMPVDecision:
    """Evaluate one combined wearable/room snapshot against the AMPV rules.

    ``data`` contains the latest correlated sensor values. ``thresholds`` holds
    the selected patient's configurable HR and SpO2 limits.  The function is
    pure: it performs no database, network, or notification work, which keeps
    the clinical decision logic deterministic and independently testable.
    """
    # Missing sensor values become zero.  Zero is treated as "no valid sample"
    # below, rather than as a medical emergency (for example, finger removed).
    heart_rate = float(data.get("heart_rate") or 0)
    spo2 = float(data.get("spo2") or 0)
    body_temp = float(data.get("body_temp") or 0)
    fall = bool(data.get("fall_detected"))
    motion = data.get("motion")

    # HR values below 30 bpm and SpO2 values below 50% are ignored because the
    # current optical sensor uses such values for missing/invalid measurements.
    # Valid readings are compared with the patient's adaptive thresholds.
    abnormal_hr = heart_rate >= 30 and (
        heart_rate < thresholds["hr_min"] or heart_rate > thresholds["hr_max"]
    )
    low_spo2 = spo2 >= 50 and spo2 < thresholds["spo2_min"]

    # The paper defines fever as strictly above 38 C; exactly 38 C is not high.
    high_temp = body_temp > 38.0

    # Rule 1: an impact/fall is verified by an abnormal cardiovascular signal.
    if fall and (abnormal_hr or low_spo2):
        signals = ["fall_detected"]
        if abnormal_hr:
            signals.append("heart_rate")
        if low_spo2:
            signals.append("spo2")
        return AMPVDecision(True, "fall_with_abnormal_vitals", tuple(signals))

    # Rule 2: abnormal HR plus fever is treated as a verified cardiac emergency.
    if abnormal_hr and high_temp:
        return AMPVDecision(True, "abnormal_heart_rate_with_fever", ("heart_rate", "body_temp"))

    # Rule 3: a fall followed by no PIR activity is verified using the room unit.
    # ``motion is not None`` prevents a missing PIR reading from meaning no motion.
    if fall and motion is not None and not bool(motion):
        return AMPVDecision(True, "fall_with_no_motion", ("fall_detected", "motion"))

    # No complete multi-sensor combination matched, so AMPV does not verify it.
    return AMPVDecision(False)
