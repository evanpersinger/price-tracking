import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3009,
    strictPort: true,
    // Proxy API calls to the FastAPI backend so the frontend can use relative /api/... URLs
    proxy: {
      '/api': 'http://127.0.0.1:8021',
    },
  },
})
