import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
    include: ['tests/ui/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    forbidOnly: Boolean(process.env.CI),
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: '../test-results/ui.xml' }
  }
}));
