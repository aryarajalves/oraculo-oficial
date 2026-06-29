import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5889,
    proxy: {
      '/api': {
        target: 'http://backend:3131',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://backend:3131',
        changeOrigin: true
      }
    }
  }
});