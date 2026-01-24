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
    // DO-278A 성능 최적화
    // Mapbox GL JS는 약 465KB (gzip)로 본질적으로 큰 라이브러리
    // GIS 애플리케이션에서 필수적이므로 청크 크기 경고 상향 조정
    chunkSizeWarningLimit: 1800, // mapbox (1.68MB) 포함 허용
    rollupOptions: {
      output: {
        // 청크 분리 최적화
        manualChunks: (id) => {
          // React 코어 분리
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // Mapbox GL 분리 (가장 큰 청크, ~465KB gzip)
          if (id.includes('node_modules/mapbox-gl')) {
            return 'vendor-mapbox';
          }
          // Three.js 3D 렌더링 분리
          if (id.includes('node_modules/three')) {
            return 'vendor-three';
          }
          // 나머지 node_modules는 vendor 청크로
          if (id.includes('node_modules')) {
            return 'vendor-common';
          }
        },
      },
    },
  },
});
