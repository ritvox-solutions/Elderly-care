import mqtt from 'mqtt';

interface MqttSubscription {
  topics: string[];
  onMessage: (topic: string, data: Record<string, unknown>) => void;
  onStatus: (connected: boolean, error?: string) => void;
}

export function subscribeToTelemetry({ topics, onMessage, onStatus }: MqttSubscription) {
  const brokerUrl = process.env.EXPO_PUBLIC_MQTT_BROKER_URL?.trim();
  if (!brokerUrl) {
    onStatus(false, 'MQTT broker is not configured.');
    return () => {};
  }

  const client = mqtt.connect(brokerUrl, {
    clientId: `caretrack_mobile_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    resubscribe: true,
    username: process.env.EXPO_PUBLIC_MQTT_USERNAME || undefined,
    password: process.env.EXPO_PUBLIC_MQTT_PASSWORD || undefined,
  });

  client.on('connect', () => {
    onStatus(true);
    client.subscribe(topics, { qos: 1 }, (error) => {
      if (error) onStatus(false, `MQTT subscription failed: ${error.message}`);
    });
  });
  client.on('message', (topic, payload) => {
    try {
      const parsed = JSON.parse(payload.toString());
      if (parsed && typeof parsed === 'object') onMessage(topic, parsed);
    } catch {
      // Sensor packets outside the JSON contract are ignored.
    }
  });
  client.on('reconnect', () => onStatus(false));
  client.on('error', (error) => onStatus(false, `MQTT connection failed: ${error.message}`));

  return () => client.end(true);
}
