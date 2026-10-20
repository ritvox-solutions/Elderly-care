import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';

// Shared MQTT connection helper for the browser.
//
// Both useCardio and useRoom need a direct broker subscription for real-time
// sensor data, so the connection setup lives here to keep the two hooks in sync.
//
// Notes on the broker URL:
//   - HiveMQ Cloud exposes a WebSocket endpoint on 8884 (wss://host:8884/mqtt).
//     A browser cannot open a raw TCP MQTT socket, so the URL must be ws/wss.
//   - Plain mqtt://host:1883 only works from Node (the backend). In the browser
//     mqtt.js falls back to a WebSocket upgrade on the same port, which the
//     broker will reject on 1883, so we map it to the WebSocket endpoint.
const DEFAULT_BROKER_HOST = 'mqtt.hivemq.cloud';
const DEFAULT_BROKER_PORT = 8884;
const DEFAULT_BROKER_PATH = '/mqtt';

export interface MqttSession {
  client: MqttClient;
  /** Disconnect and release the client. Safe to call more than once. */
  close: () => void;
}

interface BrokerAuth {
  username?: string;
  password?: string;
}

/**
 * Pulls credentials out of the broker URL when they are embedded
 * (wss://user:pass@host:8884/mqtt).
 */
function authFromUrl(url: URL): BrokerAuth {
  if (!url.username) return {};
  return {
    username: decodeURIComponent(url.username),
    password: url.password ? decodeURIComponent(url.password) : undefined,
  };
}

/**
 * Reads broker credentials from the environment.
 * VITE_MQTT_USERNAME / VITE_MQTT_PASSWORD are optional, but required by
 * brokers (such as HiveMQ Cloud) that run with authentication enabled.
 */
function authFromEnv(): BrokerAuth {
  const username = import.meta.env.VITE_MQTT_USERNAME as string | undefined;
  const password = import.meta.env.VITE_MQTT_PASSWORD as string | undefined;
  if (!username) return {};
  return { username, password };
}

function normalizeBrokerUrl(raw: string): { url: string; auth: BrokerAuth } {
  const value = raw.trim();
  if (!value) {
    return {
      url: `wss://${DEFAULT_BROKER_HOST}:${DEFAULT_BROKER_PORT}${DEFAULT_BROKER_PATH}`,
      auth: authFromEnv(),
    };
  }

  // Already a WebSocket URL — usable as-is.
  if (/^wss?:\/\//i.test(value)) {
    const url = new URL(value);
    const auth = { ...authFromEnv(), ...authFromUrl(url) };
    if (!url.port) url.port = url.protocol === 'wss:' ? '8884' : '80';
    if (!url.pathname || url.pathname === '/') url.pathname = DEFAULT_BROKER_PATH;
    // Credentials are sent via the CONNECT packet, not the URL.
    url.username = '';
    url.password = '';
    return { url: url.toString(), auth };
  }

  // A plain host (or host:port) with no scheme — HiveMQ style.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    const url = new URL(`wss://${value}`);
    const auth = { ...authFromEnv(), ...authFromUrl(url) };
    if (!url.port) url.port = String(DEFAULT_BROKER_PORT);
    if (!url.pathname || url.pathname === '/') url.pathname = DEFAULT_BROKER_PATH;
    url.username = '';
    url.password = '';
    return { url: url.toString(), auth };
  }

  // mqtt:// or mqtts:// — a browser cannot speak raw MQTT over TCP, so
  // upgrade to the broker's WebSocket listener on the same host.
  const url = new URL(value);
  const host = url.hostname || DEFAULT_BROKER_HOST;
  const scheme = url.protocol === 'mqtts:' ? 'wss' : 'ws';
  const port = url.port === '1883' ? '8083' : url.port || (scheme === 'wss' ? '8884' : '80');
  const path = url.pathname && url.pathname !== '/' ? url.pathname : DEFAULT_BROKER_PATH;
  const auth = { ...authFromEnv(), ...authFromUrl(url) };
  return { url: `${scheme}://${host}:${port}${path}`, auth };
}

export interface MqttConnectOptions {
  /** Topics to subscribe to once the connection is established. */
  topics: string[];
  /** Called for every message received on a subscribed topic. */
  onMessage: (topic: string, payload: Buffer) => void;
  /** Called when the client connects. */
  onConnect?: () => void;
  /** Called when the connection drops. */
  onClose?: () => void;
  /** Called on transport errors. */
  onError?: (err: Error) => void;
  /** Label used in console output. */
  label: string;
  /** Extra client options merged over the defaults. */
  clientOptions?: Partial<IClientOptions>;
}

/**
 * Opens a browser MQTT session and subscribes to the given topics.
 * Returns a handle whose `close()` detaches the client.
 */
export function connectMqtt(options: MqttConnectOptions): MqttSession {
  const { topics, onMessage, onConnect, onClose, onError, label, clientOptions } = options;

  const { url: brokerUrl, auth } = normalizeBrokerUrl(import.meta.env.VITE_MQTT_BROKER_URL ?? '');
  const clientId = `caretrack_web_${Math.random().toString(16).substring(2, 8)}`;

  const client = mqtt.connect(brokerUrl, {
    clientId,
    clean: true,
    // Retry aggressively but never hammer the broker.
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    resubscribe: true,
    ...(auth.username ? { username: auth.username, password: auth.password } : {}),
    ...clientOptions,
  });

  client.on('connect', () => {
    console.log(`[${label}] Connected to ${brokerUrl}`);
    onConnect?.();
    for (const topic of topics) {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) console.error(`[${label}] subscribe error on ${topic}:`, err);
        else console.log(`[${label}] subscribed: ${topic}`);
      });
    }
  });

  client.on('message', (topic, payload) => {
    onMessage(topic, payload);
  });

  client.on('error', (err) => {
    console.error(`[${label}] connection error:`, err);
    onError?.(err);
  });

  client.on('close', () => {
    console.log(`[${label}] connection closed`);
    onClose?.();
  });

  let closed = false;
  return {
    client,
    close: () => {
      if (closed) return;
      closed = true;
      try {
        client.end(true);
      } catch {
        /* noop */
      }
    },
  };
}
