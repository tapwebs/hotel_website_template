import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/site-api': {
        target: 'http://127.0.0.1:8001',
        rewrite: (path) => path.replace(/^\/site-api/, '/api/v1/website'),
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false
      },
    }
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {
      '/site-api': {
        target: 'http://127.0.0.1:8001',
        rewrite: (path) => path.replace(/^\/site-api/, '/api/v1/website'),
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false
      },
    }
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    minify: 'esbuild',
    rollupOptions: {
      treeshake: {
        moduleSideEffects: 'no-external',
        preset: 'recommended'
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/') ||
              id.includes('/react-router-dom/') ||
              id.includes('/@remix-run/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('@fullcalendar')) {
              return 'vendor-fullcalendar';
            }
            if (id.includes('@tanstack/react-query') || id.includes('zustand')) {
              return 'vendor-query-state';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        }
      }
    }
  }
});
