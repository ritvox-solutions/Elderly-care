# Deploying CareTrack Backend to Vercel

This guide explains how to deploy the **CareTrack FastAPI Backend** to Vercel as a scalable serverless API.

---

## ⚙️ How It Works on Vercel

Vercel runs Python applications as **Serverless Functions** (AWS Lambda under the hood).
The repository includes:
1. `backend/vercel.json` — Routes all HTTP requests to `main.py` using `@vercel/python`.
2. `backend/api/index.py` — Standard zero-config Vercel entrypoint importing `app`.
3. Serverless Auto-Detection — Detects `VERCEL=1` environment:
   - Safely skips persistent MQTT background threads (which are incompatible with ephemeral serverless invocations).
   - Dynamically routes SQLite database to `/tmp/caretrack.db` if no external database is configured.
   - Provides an HTTPS ingestion endpoint (`POST /api/v1/telemetry/ingest`) for pushing telemetry directly from IoT hardware or cloud forwarders.

---

## 🚀 Deployment Steps

### Method 1: Deploy with Vercel CLI

1. Install the Vercel CLI if you haven't already:
   ```bash
   npm install -g vercel
   ```

2. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```

3. Deploy:
   ```bash
   vercel
   ```
   Follow the CLI prompts:
   - Set up and deploy: **Yes**
   - Which scope: *(Select your personal or team account)*
   - Link to existing project: **No**
   - What is your project's name: `caretrack-api`
   - In which directory is your code located: `./`

4. Deploy to production:
   ```bash
   vercel --prod
   ```

---

### Method 2: Deploy via Vercel GitHub Dashboard

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **"Add New Project"** and select this GitHub repository.
3. In **Root Directory**, click **Edit** and select **`backend`**.
4. Expand **Environment Variables** and configure:
   - `DATABASE_URL` — Your production PostgreSQL connection string (from Supabase, Neon, or Railway).
   - `SECRET_KEY` — A secure 32+ character random secret for JWT authentication.
   - `CORS_ALLOWED_ORIGINS` — Comma-separated list of allowed frontend origins (e.g. `https://your-frontend.vercel.app,http://localhost:5173`).
5. Click **Deploy**!

---

## 🌐 Endpoints Available on Vercel

Once deployed, your live URL (e.g., `https://caretrack-api.vercel.app`) provides:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check probe (`{"status": "ok", "version": "2.0.0"}`) |
| `POST` | `/api/v1/auth/register` | Register caregiver/admin user |
| `POST` | `/api/v1/auth/login` | Login and receive secure session cookie & JWT |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile |
| `GET` | `/readings/latest?device_id=room-unit-01` | Query latest sensor metrics |
| `POST` | `/api/v1/telemetry/ingest` | HTTP Telemetry Ingestion endpoint |

---

## 💡 Note on IoT Devices with Serverless
- Microcontrollers can send readings directly via HTTPS to:
  `POST https://your-caretrack-api.vercel.app/api/v1/telemetry/ingest`
- Or continue publishing over MQTT TLS (port 8883) to HiveMQ Cloud, and use a lightweight forwarder to call the ingest endpoint.
