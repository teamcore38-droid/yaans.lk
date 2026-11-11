import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    proxy: {
      '/api': {
        target: process.env.YAANS_TEST_API_TARGET || 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
