import { useApp } from './store';
import mqtt from 'mqtt';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtT } from './format';

// HiveMQ Cloud TLS endpoint — mirrors backend/static/index.html and backend/.env
const MQTT_BROKER = 'wss://592dc9d2e79e40e1bf88e094608c669a.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER = 'room-kit';
const MQTT_PASS = 'Room-Kit@1';
const MQTT_TOPIC = 'cardiac/monitor/data';

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

export function useCardio(onFall: (magnitude: number) => void) {
  const { thresholds } = useApp();
  const [hr, setHr] = useState(0);
  const [spo2, setSpo2] = useState(0);
  const [temp, setTemp] = useState(36.5);
  const [pulsing, setPulsing] = useState(false);
  const [bpmBadge, setBpmBadge] = useState({ text: '—', cls: 'badge-normal' as BadgeKind });
  const [spo2Badge, setSpo2Badge] = useState({ text: '—', cls: 'badge-normal' as BadgeKind });
  const [tempBadge, setTempBadge] = useState({ text: '—', cls: 'badge-normal' as BadgeKind });
  const [risk, setRisk] = useState('—');
  const [riskColor, setRiskColor] = useState('#16794a');
  const [lastUpdate, setLastUpdate] = useState('Waiting for telemetry…');
  const [packets, setPackets] = useState(0);
  const [mqttConn, setMqttConn] = useState({ text: 'HiveMQ…', mode: '' });
  const [points, setPoints] = useState<CardioPoint[]>([]);
  const [feed, setFeed] = useState<CardioFeedRow[]>([]);
  const [buffer, setBuffer] = useState<CardioPoint[]>([]);

  const lastValidHr = useRef(0);
  const lastValidSpo2 = useRef(0);
  const lastValidTemp = useRef(36.5);
  const onFallRef = useRef(onFall);
  onFallRef.current = onFall;

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
      t < 35 || t > 38
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
  }, []);

  // Database hydration on boot — mirrors loadLatest() in the HTML
  const hydrateDb = useCallback(
    (v: { hr: number; spo2: number; temp: number; ts: string | null }) => {
      runEngine(0, 0, v.temp, null);
      if (v.ts) setLastUpdate(`Last recorded ${fmtT(v.ts)}`);
    },
    [runEngine],
  );

  useEffect(() => {
    const clientId = `caretrack_web_${Math.random().toString(16).substring(2, 8)}`;
    const client = mqtt.connect(MQTT_BROKER, {
      clientId,
      username: MQTT_USER,
      password: MQTT_PASS,
      clean: true,
      reconnectPeriod: 3000,
    });

    client.on('connect', () => {
      setMqttConn({ text: 'HiveMQ Live', mode: 'live' });
      client.subscribe(MQTT_TOPIC);
      client.subscribe('caretrack/+/wearable/motion');
    });
    client.on('close', () => setMqttConn({ text: 'Reconnecting…', mode: 'down' }));
    client.on('error', () => setMqttConn({ text: 'HiveMQ Error', mode: 'down' }));

    client.on('message', (_topic, message) => {
      try {
        const payload = JSON.parse(message.toString()) as Record<string, unknown>;
        setPackets((c) => c + 1);

        const rawHr = Number(pick(payload, 'heart_rate') ?? 0);
        const rawSpo2 = Number(pick(payload, 'spo2') ?? 0);
        const rawTemp = Number(pick(payload, 'temperature') ?? 0);
        const isFall = Boolean(pick(payload, 'fall_detected'));
        const accelMag = Number(pick(payload, 'accel_magnitude') ?? 0);

        if (isFall) onFallRef.current(Number.isFinite(accelMag) && accelMag > 0 ? accelMag : 3.8);

        const nowStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        runEngine(
          Number.isFinite(rawHr) ? rawHr : 0,
          Number.isFinite(rawSpo2) ? rawSpo2 : 0,
          Number.isFinite(rawTemp) ? rawTemp : 0,
          rawHr > 0 || rawSpo2 > 0 ? `Live ${nowStr}` : null,
        );
      } catch {
        /* ignore malformed payloads */
      }
    });

    return () => {
      try {
        client.end(true);
      } catch {
        /* noop */
      }
    };
  }, [runEngine]);

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
