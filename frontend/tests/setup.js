import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { invalidateCatalogCache } from '../src/utils/api.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  for(const value of document.cookie.split(';'))document.cookie=`${value.split('=')[0].trim()}=; Max-Age=0; path=/`;
  invalidateCatalogCache();
});
