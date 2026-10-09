CREATE TABLE IF NOT EXISTS readings (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR NOT NULL,
    sensor_type VARCHAR NOT NULL,
    metric VARCHAR NOT NULL,
    value REAL,
    unit VARCHAR,
    timestamp TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_device_metric_ts ON readings(device_id, metric, timestamp DESC);
