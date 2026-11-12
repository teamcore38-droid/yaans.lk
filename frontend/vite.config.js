import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const deployment=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const securityHeaders=Object.fromEntries(deployment.headers.find(rule=>rule.source==='/(.*)').headers.map(({key,value})=>[
  key,key==='Content-Security-Policy'?value.replace('; upgrade-insecure-requests',''):value
]));

export default defineConfig({
  plugins: [react()],
  preview: {
    // Exercise deployed browser protections in local tests; preview uses HTTP loopback.
    headers: securityHeaders,
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
