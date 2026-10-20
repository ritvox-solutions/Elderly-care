import { useApp } from './store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLatest, fetchLatestAlerts, wsUrl } from './api';
import { validTs } from './format';
import type { WsAlertMessage, WsMessage } from './types';
import { isAlert } from './types';

// MQTT direct subscription for sensor data
import { connectMqtt, type MqttSession } from './mqttClient';

export interface RoomFeedRow {
  time: string;
  metric: string;
  value: string;
}

export interface RoomBufferPoint {
  t: number;
  temp?: number;
  hum?: number;
}

interface DbVitals {
  hr: number;
  spo2: number;
  temp: number;
  ts: string | null;
}

interface UseRoomOpts {
  onDbVitals: (v: DbVitals) => void;
  onAlert: (alert: WsAlertMessage) => void;
  wearableDeviceId: string;
}

const MAX_RECONNECT_DELAY = 12000;

function toNum(v: unknown): number | undefined {
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function useRoom(deviceId: string, opts: UseRoomOpts) {
  const { thresholds } = useApp();
  const [temp, setTemp] = useState<number | null>(null);
  const [hum, setHum] = useState<number | null>(null);
  const [motion, setMotion] = useState<number | null>(null);
  const [tempTs, setTempTs] = useState<string | null>(null);
  const [humTs, setHumTs] = useState<string | null>(null);
  const [motionTs, setMotionTs] = useState<string | null>(null);
  const [tempTrend, setTempTrend] = useState('Δ —');
  const [tempTrendCls, setTempTrendCls] = useState('delta');
  const [humDelta, setHumDelta] = useState('RH —');
  const [tempFlag, setTempFlag] = useState({ text: '—', cls: 'badge idle' });
  const [humFlag, setHumFlag] = useState({ text: '—', cls: 'badge idle' });
  const [motionBadge, setMotionBadge] = useState({ text: 'Clear', cls: 'badge idle' });
  const [devStatus, setDevStatus] = useState({ text: 'Offline', cls: 'badge idle' });
  const [devStatusTs, setDevStatusTs] = useState('Room Link');
  const [lastSeenTs, setLastSeenTs] = useState<string | null>(null);
  const [lastMotionTs, setLastMotionTs] = useState<string | null>(null);
  const [events, setEvents] = useState<RoomFeedRow[]>([]);
  const [feedCount, setFeedCount] = useState(0);
  const [conn, setConn] = useState({ text: 'Connecting…', mode: '' });
  const [tempHist, setTempHist] = useState<number[]>([]);
  const [humHist, setHumHist] = useState<number[]>([]);
  const [buffer, setBuffer] = useState<RoomBufferPoint[]>([]);

  const lastTempRef = useRef<number | null>(null);
  const lastHumRef = useRef<number | null>(null);
  const lastValidHr = useRef(0);
  const lastValidSpo2 = useRef(0);
  const lastValidTemp = useRef(0);
  const retryRef = useRef(1000);
  const hasLiveRoomData = useRef(false);
  const seenAlerts = useRef<Set<string>>(new Set());
  const optsRef = useRef(opts);

  const deliverAlert = useCallback((alert: WsAlertMessage) => {
    if (seenAlerts.current.has(alert.alert_id)) return;
    if (seenAlerts.current.size > 200) seenAlerts.current.clear();
    seenAlerts.current.add(alert.alert_id);
    optsRef.current.onAlert(alert);
  }, []);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const pushBuffer = useCallback((t: number, tempV?: number, humV?: number) => {
    if (tempV === undefined && humV === undefined) return;
    setBuffer((prev) => {
      const next = [...prev, { t, temp: tempV, hum: humV }];
      return next.length > 120 ? next.slice(next.length - 120) : next;
    });
  }, []);

  const addFeedRow = useCallback((metric: string, value: string, ts: string) => {
    setEvents((prev) => [{ time: ts, metric, value }, ...prev].slice(0, 25));
    setFeedCount((c) => c + 1);
  }, []);

  // Evaluate comfort against user-configured dynamic thresholds
  const comfort = useCallback((t: number | null, h: number | null) => {
    let tText = '—',
      tCls = 'badge idle';
    let hText = '—',
      hCls = 'badge idle';

    const minTemp = thresholds?.roomTempMin ?? 18;
    const maxTemp = thresholds?.roomTempMax ?? 27;

    if (t !== null && isFinite(t)) {
      if (t < minTemp) {
        tText = 'Low';
        tCls = 'badge alert';
      } else if (t > maxTemp) {
        tText = 'High';
        tCls = 'badge alert';
      } else {
        tText = 'Normal';
        tCls = 'badge ok';
      }
    }
    if (h !== null && isFinite(h)) {
      if (h < 30) {
        hText = 'Dry';
        hCls = 'badge stale';
      } else if (h > 65) {
        hText = 'Humid';
        hCls = 'badge stale';
      } else {
        hText = 'Normal';
        hCls = 'badge ok';
      }
    }
    setTempFlag({ text: tText, cls: tCls });
    setHumFlag({ text: hText, cls: hCls });
  }, [thresholds?.roomTempMin, thresholds?.roomTempMax]);

  // Immediately re-evaluate comfort flag whenever thresholds or comfort change
  useEffect(() => {
    if (lastTempRef.current !== null || lastHumRef.current !== null) {
      comfort(lastTempRef.current, lastHumRef.current);
    }
  }, [comfort]);

  const updateMotion = useCallback(
    (val: unknown, ts: string, silent: boolean) => {
      if (val === null || val === undefined) return;
      let on = false;
      if (typeof val === 'boolean') {
        on = val;
      } else if (typeof val === 'number') {
        on = val > 0.5;
      } else if (typeof val === 'string') {
        const s = val.trim().toLowerCase();
        on = s === 'yes' || s === 'true' || s === '1' || s === 'detected' || s === 'on' || s === 'motion';
      }
      setMotion(on ? 1 : 0);
      setMotionTs(ts);
      setMotionBadge(on ? { text: 'Motion', cls: 'badge motion-active' } : { text: 'Clear', cls: 'badge idle' });
      if (on) setLastMotionTs(ts);
      setLastSeenTs(ts);
      if (!silent) addFeedRow('motion_detected', on ? 'Detected' : 'Clear', ts);
    },
    [addFeedRow],
  );

  const updateCard = useCallback(
    (which: 'temp' | 'hum', val: unknown, ts: string, silent: boolean) => {
      const n = toNum(val);
      if (n === undefined) return;
      const epoch = new Date(ts).getTime();
      if (which === 'temp') {
        if (lastTempRef.current !== null) {
          const d = n - lastTempRef.current;
          let text = 'Δ 0.0 °C',
            cls = 'delta';
          if (Math.abs(d) >= 0.05) {
            text = `Δ ${d > 0 ? '+' : ''}${d.toFixed(1)} °C`;
            cls = `delta ${d > 0 ? 'rising' : 'falling'}`;
          }
          setTempTrend(text);
          setTempTrendCls(cls);
        }
        lastTempRef.current = n;
        setTemp(n);
        setTempTs(ts);
        setTempHist((p) => [...p, n].slice(-40));
        pushBuffer(epoch, n, undefined);
        comfort(n, lastHumRef.current);
        if (!silent) addFeedRow('temperature', String(Math.round(n * 10) / 10), ts);
      } else {
        if (lastHumRef.current !== null) {
          const d = n - lastHumRef.current;
          setHumDelta(`Δ ${d >= 0 ? '+' : ''}${d.toFixed(1)} %`);
        }
        lastHumRef.current = n;
        setHum(n);
        setHumTs(ts);
        setHumHist((p) => [...p, n].slice(-40));
        pushBuffer(epoch, undefined, n);
        comfort(lastTempRef.current, n);
        if (!silent) addFeedRow('humidity', String(Math.round(n * 10) / 10), ts);
      }
      setLastSeenTs(ts);
    },
    [addFeedRow, comfort, pushBuffer],
  );

  const applyMessage = useCallback(
    (m: WsMessage, id: string) => {
      if (!m || typeof m !== 'object') return;
      const incomingId = m.device_id?.trim().toLowerCase();
      const roomId = id.trim().toLowerCase();
      const wearableId = optsRef.current.wearableDeviceId.trim().toLowerCase();

      if (isAlert(m)) {
        if (incomingId === roomId || incomingId === wearableId) deliverAlert(m);
      }
    },
    [deliverAlert],
  );

  useEffect(() => {
    if (!deviceId || !opts.wearableDeviceId) return;
    const since = new Date().toISOString();
    const poll = () => fetchLatestAlerts([deviceId, optsRef.current.wearableDeviceId], since)
      .then((alerts) => alerts.reverse().forEach(deliverAlert))
      .catch(() => {});
    const timer = window.setInterval(poll, 2000);
    return () => window.clearInterval(timer);
  }, [deviceId, opts.wearableDeviceId, deliverAlert]);

  const loadLatest = useCallback(
    async (id: string) => {
      try {
        const d = await fetchLatest(id, optsRef.current.wearableDeviceId);
        if (!hasLiveRoomData.current) {
          if (d.temperature) updateCard('temp', d.temperature.value, validTs(d.temperature.timestamp), true);
          if (d.humidity) updateCard('hum', d.humidity.value, validTs(d.humidity.timestamp), true);
          const mot = d.motion_detected ?? ((d as unknown as Record<string, any>).motion);
          if (mot) updateMotion((mot as any).value, validTs((mot as any).timestamp), true);
        }
        const hrV = d.heart_rate?.value;
        if (hrV != null && hrV > 0) lastValidHr.current = Math.round(hrV);
        const spo2V = d.spo2?.value;
        if (spo2V != null && spo2V > 0) lastValidSpo2.current = Math.round(spo2V);
        const ctV = d.cardio_temp?.value;
        if (ctV != null && ctV > 0) lastValidTemp.current = Number(ctV);
        if (lastValidHr.current > 0 || lastValidSpo2.current > 0) {
          optsRef.current.onDbVitals({
            hr: lastValidHr.current,
            spo2: lastValidSpo2.current,
            temp: lastValidTemp.current,
            ts:
              (d.heart_rate && d.heart_rate.timestamp) ||
              (d.spo2 && d.spo2.timestamp) ||
              null,
          });
        }
        if (d.last_seen && !hasLiveRoomData.current) setLastSeenTs(validTs(d.last_seen));
      } catch {
        /* backend snapshot unavailable — direct MQTT can still provide live data */
      }
    },
    [updateCard, updateMotion],
  );

  useEffect(() => {
    if (!deviceId) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let pingTimer = 0;
    let reconnectTimer = 0;

    // Reset per-device state (copied from doConnect)
    lastTempRef.current = null;
    lastHumRef.current = null;
    hasLiveRoomData.current = false;
    retryRef.current = 1000;
    setTempHist([]);
    setHumHist([]);
    setEvents([]);
    setFeedCount(0);
    setBuffer([]);

    void loadLatest(deviceId);

    const connect = () => {
      if (closed) return;
      const sock = new WebSocket(wsUrl());
      ws = sock;
      sock.onopen = () => {
        retryRef.current = 1000;
        pingTimer = window.setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) sock.send('ping');
        }, 20000);
      };
      sock.onclose = () => {
        window.clearInterval(pingTimer);
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, retryRef.current);
          retryRef.current = Math.min(retryRef.current * 2, MAX_RECONNECT_DELAY);
        }
      };
      sock.onerror = () => {};
      sock.onmessage = (evt) => {
        try {
          applyMessage(JSON.parse(evt.data as string) as WsMessage, deviceId);
        } catch {
          /* ignore malformed frames */
        }
      };
    };
    connect();

    return () => {
      closed = true;
      window.clearInterval(pingTimer);
      window.clearTimeout(reconnectTimer);
      try {
        const current = ws;
        if (current?.readyState === WebSocket.OPEN) current.close();
        else if (current?.readyState === WebSocket.CONNECTING) current.onopen = () => current.close();
      } catch {
        /* noop */
      }
    };
  }, [deviceId, applyMessage, loadLatest]);

  // MQTT direct subscription for sensor data.
  // Subscribe to: caretrack/{deviceId}/room/environment and caretrack/{deviceId}/room/motion
  const updateCardRef = useRef(updateCard);
  const updateMotionRef = useRef(updateMotion);
  useEffect(() => {
    updateCardRef.current = updateCard;
    updateMotionRef.current = updateMotion;
  }, [updateCard, updateMotion]);

  useEffect(() => {
    if (!deviceId || !import.meta.env.VITE_MQTT_BROKER_URL) return;
    const mqttTopicRoomEnv = `caretrack/${deviceId}/room/environment`;
    const mqttTopicRoomMotion = `caretrack/${deviceId}/room/motion`;

    let mqttSession: MqttSession | null = null;
    try {
      mqttSession = connectMqtt({
        label: 'MQTT',
        topics: [mqttTopicRoomEnv, mqttTopicRoomMotion],
        onConnect: () => {
          setConn({ text: 'Room live', mode: 'live' });
          setDevStatus({ text: 'Online', cls: 'badge ok' });
          setDevStatusTs('Direct MQTT');
        },
        onClose: () => {
          setConn({ text: 'Room reconnecting…', mode: 'down' });
          setDevStatus({ text: 'Offline', cls: 'badge idle' });
        },
        onError: () => setConn({ text: 'Room offline', mode: 'down' }),
        onMessage: (_topic, payload) => {
          try {
            const data = JSON.parse(payload.toString()) as Record<string, unknown>;
            // Parse payload matching backend format:
            // {"sensor":"room","timestamp":"...","data":{"temperature":xx,"humidity":yy,"motion_detected":bool}}
            const room = (data.data ?? data) as Record<string, unknown>;
            const { temperature, humidity, motion_detected } = room;
            const ts = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();

            hasLiveRoomData.current = true;
            if (temperature !== undefined) updateCardRef.current('temp', temperature, ts, false);
            if (humidity !== undefined) updateCardRef.current('hum', humidity, ts, false);
            if (motion_detected !== undefined) updateMotionRef.current(motion_detected, ts, false);
          } catch (e) {
            console.error('[MQTT] Error parsing message:', e);
          }
        },
      });
    } catch (e) {
      console.error('[MQTT] Failed to initialize MQTT client:', e);
    }

    return () => {
      mqttSession?.close();
      mqttSession = null;
    };
  }, [deviceId]);

  return {
    temp,
    hum,
    motion,
    tempTs,
    humTs,
    motionTs,
    tempTrend,
    tempTrendCls,
    humDelta,
    tempFlag,
    humFlag,
    motionBadge,
    devStatus,
    devStatusTs,
    lastSeenTs,
    lastMotionTs,
    events,
    feedCount,
    conn,
    tempHist,
    humHist,
    buffer,
    addFeedRow,
  };
}
