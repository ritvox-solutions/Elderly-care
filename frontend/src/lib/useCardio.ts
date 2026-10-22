import { useApp } from './store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtT } from './format';
import { connectMqtt, type MqttSession } from './mqttClient';

// MQTT direct subscription for cardiac data

export interface CardioPoint {
  t: number;
  hr: number;
  spo2: number;
}

export interface CardioFeedRow {
  time: string;
  hr: number;
  spo2: number;
  temp: number;
}

type BadgeKind = 'badge-normal' | 'badge-warning' | 'badge-alert';

function pick(payload: Record<string, unknown>, key: string): unknown {
  if (payload[key] !== undefined) return payload[key];
  const nested = payload.data;
  if (nested && typeof nested === 'object') {
    return (nested as Record<string, unknown>)[key];
  }
  return undefined;
}

export function useCardio(onFall?: (magnitude: number, heightM?: number, category?: string) => void) {
  const { thresholds, selectedPatient } = useApp();
  const [hr, setHr] = useState(0);
  const [spo2, setSpo2] = useState(0);
  const [temp, setTemp] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const [bpmBadge, setBpmBadge] = useState({ text: '—', cls: 'badge-normal' as BadgeKind });
  const [spo2Badge, setSpo2Badge] = useState({ text: '—', cls: 'badge-normal' as BadgeKind });
  const [tempBadge, setTempBadge] = useState({ text: '—', cls: 'badge-normal' as BadgeKind });
  const [risk, setRisk] = useState('—');
  const [riskColor, setRiskColor] = useState('#16794a');
  const [lastUpdate, setLastUpdate] = useState('Waiting for telemetry…');
  const [packets, setPackets] = useState(0);
  const [mqttConn, setMqttConn] = useState({ text: 'Connecting wearable…', mode: '' });
  const [points, setPoints] = useState<CardioPoint[]>([]);
  const [feed, setFeed] = useState<CardioFeedRow[]>([]);
  const [buffer, setBuffer] = useState<CardioPoint[]>([]);

  const lastValidHr = useRef(0);
  const lastValidSpo2 = useRef(0);
  const lastValidTemp = useRef(0);
  const hasLiveData = useRef(false);
  // Clinical Risk Engine — copied verbatim from backend/static/index.html
  const runEngine = useCallback((rawHr: number, rawSpo2: number, rawTemp: number, liveLabel: string | null) => {
    if (rawHr > 0) lastValidHr.current = rawHr;
    if (rawSpo2 > 0) lastValidSpo2.current = Math.round(rawSpo2);
    if (rawTemp > 20 && rawTemp < 50) lastValidTemp.current = rawTemp;

    const h = rawHr > 0 ? rawHr : lastValidHr.current;
    const s = rawSpo2 > 0 ? Math.round(rawSpo2) : lastValidSpo2.current;
    const t = rawTemp > 0 ? rawTemp : lastValidTemp.current;

    setHr(h);
    setSpo2(s);
    setTemp(t);
    setPulsing(rawHr > 0);

    let riskLevel = 'Normal';
    let riskColor = '#16794a';
    let bpmStatusMsg = 'Resting rhythm';
    let bpmBadgeClass: BadgeKind = 'badge-normal';
    let spo2StatusMsg = 'Optimal';
    let spo2BadgeClass: BadgeKind = 'badge-normal';

    const hrMin = thresholds?.hrMin ?? 50;
    const hrMax = thresholds?.hrMax ?? 100;
    const spo2Min = thresholds?.spo2Min ?? 92;

    if (h > 0 && h < hrMin) {
      bpmStatusMsg = 'Bradycardia';
      bpmBadgeClass = 'badge-warning';
      riskLevel = 'Evaluate';
      riskColor = '#92600a';
    } else if (h > hrMax) {
      bpmStatusMsg = 'Tachycardia';
      bpmBadgeClass = 'badge-alert';
      riskLevel = 'Evaluate';
      riskColor = '#92600a';
    }

    if (s > 0 && s < 90) {
      spo2StatusMsg = 'Critical Hypoxemia';
      spo2BadgeClass = 'badge-alert';
      riskLevel = 'Critical';
      riskColor = '#b4232a';
    } else if (s > 0 && s < spo2Min) {
      spo2StatusMsg = 'Low saturation';
      spo2BadgeClass = 'badge-warning';
      if (riskLevel === 'Normal') {
        riskLevel = 'Attention';
        riskColor = '#92600a';
      }
    }

    setBpmBadge({ text: bpmStatusMsg, cls: bpmBadgeClass });
    setSpo2Badge({ text: spo2StatusMsg, cls: spo2BadgeClass });
    setTempBadge(
      t <= 0
        ? { text: '—', cls: 'badge-normal' }
        : t < 35 || t > 38
          ? { text: 'Check sensor', cls: 'badge-warning' }
          : { text: 'Normal', cls: 'badge-normal' },
    );
    setRisk(riskLevel);
    setRiskColor(riskColor);
    if (liveLabel) setLastUpdate(liveLabel);

    if (h > 0 && s > 0) {
      const now = Date.now();
      const pt = { t: now, hr: h, spo2: s };
      setPoints((p) => [...p, pt].slice(-25));
      setBuffer((p) => [...p, pt].slice(-120));
    }
    if (rawHr > 0 || rawSpo2 > 0) {
      const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setFeed((p) => [{ time: nowStr, hr: h, spo2: Math.round(s), temp: t }, ...p].slice(0, 30));
    }
  }, [thresholds?.hrMin, thresholds?.hrMax, thresholds?.spo2Min]);

  // Database hydration on boot — mirrors loadLatest() in the HTML
  const hydrateDb = useCallback(
    (v: { hr: number; spo2: number; temp: number; ts: string | null }) => {
      if (hasLiveData.current) return;
      runEngine(v.hr, v.spo2, v.temp, null);
      if (v.ts) setLastUpdate(`Last recorded ${fmtT(v.ts)}`);
    },
    [runEngine],
  );

  // MQTT direct subscription for cardiac data.
  // Subscribe to: cardiac/monitor/data
  const mqttTopicCardiac = 'cardiac/monitor/data';

  // runEngine depends on the patient thresholds, which change when a caregiver
  // edits them. Reading it through a ref keeps the MQTT subscription stable so
  // threshold edits do not tear down and re-open the broker connection.
  const runEngineRef = useRef(runEngine);
  const onFallRef = useRef(onFall);
  useEffect(() => {
    runEngineRef.current = runEngine;
    onFallRef.current = onFall;
  }, [runEngine, onFall]);

  // Set up the direct broker subscription once, and tear it down on unmount.
  useEffect(() => {
    if (!import.meta.env.VITE_MQTT_BROKER_URL) return;
    let session: MqttSession | null = null;
    try {
      session = connectMqtt({
        label: 'MQTT-CARDIO',
        topics: [mqttTopicCardiac, `caretrack/${selectedPatient.roomDeviceId}/wearable/motion`],
        onConnect: () => setMqttConn({ text: 'Wearable live', mode: 'live' }),
        onClose: () => setMqttConn({ text: 'Wearable reconnecting…', mode: 'down' }),
        onError: () => setMqttConn({ text: 'Wearable offline', mode: 'down' }),
        onMessage: (_topic, payload) => {
          try {
            const data = JSON.parse(payload.toString()) as Record<string, unknown>;
            // The wearable firmware publishes a flat payload:
            //   {"heart_rate":xx,"spo2":yy,"temperature":tt,"fall_detected":bool,"accel_magnitude":zz}
            // The backend relay publishes the same values nested under "data".
            // `pick` handles both shapes.
            const rawHr = Number(pick(data, 'heart_rate') ?? 0);
            const rawSpo2 = Number(pick(data, 'spo2') ?? 0);
            const rawTemp = Number(
              pick(data, 'device_temperature') ??
              pick(data, 'body_temp') ??
              pick(data, 'temperature') ??
              0
            );
            const fallDetected = pick(data, 'fall_detected');
            if (fallDetected === true || fallDetected === 1 || fallDetected === '1') {
              const magnitude = Number(pick(data, 'accel_magnitude') ?? 0);
              const height = Number(pick(data, 'fall_height_m') ?? 0);
              const category = pick(data, 'fall_category');
              onFallRef.current?.(
                Number.isFinite(magnitude) ? magnitude : 0,
                Number.isFinite(height) && height > 0 ? height : undefined,
                typeof category === 'string' ? category : undefined,
              );
            }
            if (!rawHr && !rawSpo2 && !rawTemp) return;

            hasLiveData.current = true;
            setPackets((count) => count + 1);

            const nowStr = new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            // runEngine owns the vitals state, the chart points and the feed row.
            runEngineRef.current(
              Number.isFinite(rawHr) ? rawHr : 0,
              Number.isFinite(rawSpo2) ? Math.round(rawSpo2) : 0,
              Number.isFinite(rawTemp) ? rawTemp : 0,
              rawHr > 0 || rawSpo2 > 0 ? `Live MQTT ${nowStr}` : null,
            );
          } catch (e) {
            console.error('[MQTT-CARDIO] Error parsing message:', e);
          }
        },
      });
    } catch (e) {
      console.error('[MQTT-CARDIO] Failed to initialize:', e);
    }

    return () => {
      session?.close();
    };
  }, [selectedPatient.roomDeviceId]);

  return {
    hr,
    spo2,
    temp,
    pulsing,
    bpmBadge,
    spo2Badge,
    tempBadge,
    risk,
    riskColor,
    lastUpdate,
    packets,
    mqttConn,
    points,
    feed,
    buffer,
    hydrateDb,
  };
}
