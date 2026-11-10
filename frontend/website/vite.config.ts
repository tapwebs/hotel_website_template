import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// https://vite.dev/config/
// Dev only: mirrors the .htaccess grand-opening rule. Before 1 Nov 2026 11:00 IST, "/" serves opening/index.html
// unless the URL has ?opened. Production does this in .htaccess.
const openingDev = (): Plugin => ({
  name: 'grand-opening-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const u = new URL(req.url ?? '/', 'http://x')
      if (u.pathname === '/' && !u.searchParams.has('opened') && Date.now() < Date.UTC(2026, 10, 1, 5, 30)) {
        req.url = '/opening/index.html' + u.search
      }
      next()
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), openingDev()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/") || id.includes("node_modules/three-stdlib/")) {
            return "three-vendor";
          }
        },
      },
    },
  },
  // Dev only: QR scan links (/r/<slug>?p=<code>) are answered by the API, which logs the scan and redirects to /hub/...
  // In production the host's .htaccess does the same forwarding.
  server: {
    proxy: {
      '^/r/': { target: 'http://localhost:3001', changeOrigin: false },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['use-sync-external-store/shim/with-selector'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'use-sync-external-store': fileURLToPath(new URL('./node_modules/use-sync-external-store', import.meta.url)),
    },
  },
})
