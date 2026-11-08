const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function formatLkr(amount) {
  const num = Number(amount) || 0;
  return `Rs. ${num.toLocaleString('en-LK')}`;
}

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('yaans_token');
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}
