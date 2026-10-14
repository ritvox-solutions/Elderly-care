# CareTrack React Frontend

Vite + React + TypeScript dashboard for CareTrack. It replaces the legacy
`backend/static/` HTML dashboards (`index.html` / `cardio.html`), which have
been removed — same look, same behavior — no AI-generated styling.

## Design source

- Stylesheet: `src/caretrack.css` was copied verbatim from the `<style>` block of
  the legacy `backend/static/index.html` (plus a few `.ct-*` helpers for History/Alerts/Settings
  that reuse the same tokens). All markup uses the original class names
  (`header.top`, `.nav-tabs`, `.kpi`, `.badge`, `table.log`, `.kv`, `.chart-card`, …).
- Charts: `chart.js` with the exact datasets/axes/options from the HTML
  (HR red solid filled, SpO2 teal dashed, dual y-axes).
- Sparklines, emergency alarm tone, badge logic, risk engine, fall banner:
  line-for-line ports of the inline `<script>` from the legacy HTML dashboards.

## Quick start

```powershell
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Backend first (in `backend/`):

```powershell
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
python simulate_sensors.py
```

The Vite dev server proxies `/health`, `/readings/*` and `/ws` to
`http://localhost:8000`. Cardiac vitals are relayed through the FastAPI backend
over `/ws/live`; the browser no longer connects directly to HiveMQ or carries
MQTT credentials.

## Routes

| Route | Mirrors |
|---|---|
| `/` | Room Unit tab — KPI cards, sparklines, Recent Room Events, Unit Information |
| `/cardio` | Cardiac & Fall tab — vitals, risk engine, Chart.js history, MQTT feed |
| `/dual` | Dual Overview tab — both blocks side by side |
| `/history` | Metric pills + Chart.js chart + min/avg/max (live session buffer) |
| `/alerts` | Fall / SpO2 / heart-rate alerts with acknowledge → resolve |
| `/settings` | Profile, device pairing, thresholds, backend health check |

## Data contracts (unchanged)

- `GET /health`, `GET /readings/latest?device_id=` via FastAPI.
- `WS /ws/live` room bundles `{device_id, sensor, timestamp, data, fall_detected}`
  and per-metric `{device_id, sensor, timestamp, metric, value, fall_detected}`.
- MQTT `cardiac/monitor/data` + `caretrack/+/wearable/motion` direct from HiveMQ.
  The port accepts both flat (`{heart_rate: …}`) and nested (`{data: {heart_rate: …}}`)
  payloads — the old page only read flat keys, which the simulator doesn't send.

## Notes

- Monitor tabs use the original fixed clinical rules (Bradycardia &lt; 55,
  Tachycardia &gt; 100, Hypoxemia &lt; 90, …). The Settings thresholds drive the
  WATCH rules on the Alerts tab.
- History is the in-memory live buffer (last 120 points). Add
  `GET /readings/history` server-side for persistent 24h/7d charts.
