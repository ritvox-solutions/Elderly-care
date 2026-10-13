import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST proxied to FastAPI backend (see backend/main.py)
      '/health': 'http://localhost:8000',
      '/readings': 'http://localhost:8000',
      // WebSocket proxied to FastAPI /ws/live
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
