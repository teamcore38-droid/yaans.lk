import { apiFailure } from './retryAfter.js';

export async function downloadDocument(path, filename, headers = {}) {
  const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'X-Yaans-Client': 'browser', ...headers }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw apiFailure(response, data);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
