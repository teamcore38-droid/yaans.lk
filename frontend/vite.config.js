import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { assertRuntimeModuleBoundary } from '../scripts/runtime-dependency-boundary.mjs';
import { validateException } from '../scripts/security-exception-policy.mjs';

const deployment=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const securityHeaders=Object.fromEntries(deployment.headers.find(rule=>rule.source==='/(.*)').headers.map(({key,value})=>[
  key,key==='Content-Security-Policy'?value.replace('; upgrade-insecure-requests',''):value
]));

export default defineConfig({
  plugins: [react(), {
    name: 'enforce-production-dependency-boundary',
    generateBundle(_options,bundle) {
      // Enforce expiry even if a later deployment reuses old successful CI.
      validateException(JSON.parse(readFileSync(new URL('../config/security-exceptions.json',import.meta.url),'utf8')));
      const ids=Object.values(bundle).filter(output=>output.type==='chunk').flatMap(chunk=>Object.keys(chunk.modules));
      assertRuntimeModuleBoundary(ids);
      this.info(`Runtime dependency boundary passed for ${ids.length} bundled modules.`);
    }
  }],
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
