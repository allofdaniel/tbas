import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@presentation': path.resolve(__dirname, 'src/presentation'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@hooks': path.resolve(__dirname, 'src/presentation/hooks'),
      '@components': path.resolve(__dirname, 'src/presentation/components'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/aircraft-trace': {
        target: 'https://api.airplanes.live',
        changeOrigin: true,
        rewrite: (path) => {
          const hex = new URLSearchParams(path.split('?')[1]).get('hex');
          return `/v2/hex/${hex}`;
        },
      },
      '/api/aircraft': {
        target: 'https://api.airplanes.live',
        changeOrigin: true,
        rewrite: (path) => {
          const params = new URLSearchParams(path.split('?')[1]);
          const lat = params.get('lat');
          const lon = params.get('lon');
          const radius = params.get('radius') || '100';
          return `/v2/point/${lat}/${lon}/${radius}`;
        },
      },
      // Weather API - disabled for local dev (requires KMA API key)
      // Production uses Vercel serverless function with API keys
      '/api/weather': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (path) => {
          const params = new URLSearchParams(path.split('?')[1] || '');
          const type = params.get('type') || 'metar';
          if (type === 'metar') {
            return `/api/data/metar?ids=RKPU&format=json`;
          } else if (type === 'taf') {
            return `/api/data/taf?ids=RKPU,RKPK&format=json`;
          }
          return `/api/data/metar?ids=RKPU&format=json`;
        },
      },
      '/api/charts': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-mapbox': ['mapbox-gl'],
          'vendor-three': ['three'],
        },
      },
    },
  },
});
