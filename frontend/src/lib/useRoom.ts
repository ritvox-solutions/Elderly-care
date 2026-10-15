import { useApp } from './store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLatest, wsUrl } from './api';
import { validTs } from './format';
import type { WsMessage } from './types';
import { isBundle } from './types';

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
  onFall: (magnitude: number) => void;
  onDbVitals: (v: DbVitals) => void;
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
  const pinnedRef = useRef(false);
  const bundleKeys = useRef<Set<string>>(new Set());
  const lastValidHr = useRef(0);
  const lastValidSpo2 = useRef(0);
  const lastValidTemp = useRef(36.5);
  const retryRef = useRef(1000);
  const optsRef = useRef(opts);
  optsRef.current = opts;

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

  const applyStatus = useCallback(
    (raw: unknown, ts: string) => {
      const online = String(raw) === '1' || raw === 'online';
      const str = online ? 'Online' : String(raw);
      setDevStatus({ text: str, cls: `badge ${online ? 'ok' : 'idle'}` });
      pinnedRef.current = true;
      setDevStatusTs(`reported ${ts}`);
      addFeedRow('status', String(raw), ts);
    },
    [addFeedRow],
  );

  const applyMessage = useCallback(
    (m: WsMessage, id: string) => {
      if (!m || typeof m !== 'object') return;
      if (m.device_id && id && m.device_id.trim().toLowerCase() !== id.trim().toLowerCase()) return;
      const ts = validTs((m as { timestamp?: unknown }).timestamp);

      const isRoomSensor = !m.sensor || m.sensor === 'room';
      if (isBundle(m) && isRoomSensor) {
        const data = (m.data ?? {}) as Record<string, unknown>;
        if (bundleKeys.current.size > 200) bundleKeys.current.clear();
        Object.keys(data).forEach((metric) =>
          bundleKeys.current.add(`${m.device_id}|${ts}|${metric}`),
        );
        if (data.temperature !== undefined) updateCard('temp', data.temperature, ts, false);
        if (data.humidity !== undefined) updateCard('hum', data.humidity, ts, false);
        const motionVal = data.motion_detected ?? data.motion ?? data.motion_detection;
        if (motionVal !== undefined) updateMotion(motionVal, ts, false);
        if (data.status !== undefined) applyStatus(data.status, ts);
      } else if (!isBundle(m) && isRoomSensor) {
        if (bundleKeys.current.has(`${m.device_id}|${ts}|${m.metric}`)) return;
        if (m.metric === 'temperature') updateCard('temp', m.value, ts, false);
        else if (m.metric === 'humidity') updateCard('hum', m.value, ts, false);
        else if (m.metric === 'motion_detected' || m.metric === 'motion' || m.metric === 'motion_detection') updateMotion(m.value, ts, false);
        else if (m.metric === 'status') applyStatus(m.value, ts);
      }

      // Fall detection on ANY incoming message (copied from the HTML)
      const dataFall =
        isBundle(m) && m.data && typeof m.data === 'object'
          ? Boolean((m.data as Record<string, unknown>).fall_detected)
          : false;
      if (m.fall_detected || dataFall) {
        const data = isBundle(m) ? ((m.data ?? {}) as Record<string, unknown>) : {};
        const mag = Number(
          (m as { accel_magnitude?: unknown }).accel_magnitude ?? data.accel_magnitude ?? 3.8,
        );
        optsRef.current.onFall(Number.isFinite(mag) ? mag : 3.8);
      }

      setLastSeenTs(ts);
    },
    [applyStatus, updateCard, updateMotion],
  );

  const loadLatest = useCallback(
    async (id: string) => {
      try {
        const d = await fetchLatest(id);
        if (d.temperature) updateCard('temp', d.temperature.value, validTs(d.temperature.timestamp), true);
        if (d.humidity) updateCard('hum', d.humidity.value, validTs(d.humidity.timestamp), true);
        const mot = d.motion_detected ?? ((d as unknown as Record<string, any>).motion);
        if (mot)
          updateMotion((mot as any).value, validTs((mot as any).timestamp), true);
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
        if (d.last_seen) setLastSeenTs(validTs(d.last_seen));
      } catch {
        /* backend unreachable — live WS still works once up */
      }
    },
    [updateCard, updateMotion],
  );

  useEffect(() => {
    if (!deviceId) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let pingTimer = 0;
    let refreshTimer = 0;
    let reconnectTimer = 0;

    // Reset per-device state (copied from doConnect)
    lastTempRef.current = null;
    lastHumRef.current = null;
    pinnedRef.current = false;
    retryRef.current = 1000;
    setTempHist([]);
    setHumHist([]);
    setEvents([]);
    setFeedCount(0);
    setBuffer([]);

    const connect = () => {
      if (closed) return;
      setConn({ text: 'Connecting…', mode: '' });
      const sock = new WebSocket(wsUrl());
      ws = sock;
      sock.onopen = () => {
        setConn({ text: 'Live', mode: 'live' });
        retryRef.current = 1000;
        loadLatest(deviceId);
        pingTimer = window.setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) sock.send('ping');
        }, 20000);
        refreshTimer = window.setInterval(() => loadLatest(deviceId), 30000);
      };
      sock.onclose = () => {
        window.clearInterval(pingTimer);
        window.clearInterval(refreshTimer);
        setConn({ text: 'Reconnecting…', mode: 'down' });
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, retryRef.current);
          retryRef.current = Math.min(retryRef.current * 2, MAX_RECONNECT_DELAY);
        }
      };
      sock.onerror = () => {
        setConn({ text: 'Error', mode: 'down' });
      };
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
      window.clearInterval(refreshTimer);
      window.clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, [deviceId, applyMessage, loadLatest]);

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
