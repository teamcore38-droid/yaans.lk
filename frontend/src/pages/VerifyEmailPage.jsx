import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

export default function VerifyEmailPage() {
  const { user, refreshUser } = useMarketplace();
  const [token, setToken] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    return value;
  });
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  const [password, setPassword] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function confirm(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ verificationToken: token, password }) });
      setResult(response); setPassword(''); setToken('');
      if (user) await refreshUser().catch(() => {});
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="max-w-md mx-auto px-4 py-10">
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h1 className="text-xl font-bold">Confirm your email address</h1>
      {result ? <><p role="status">{result.message}</p><Link className="text-sky-700 underline" to={result.role === 'admin' ? '/admin/login' : '/login'}>Continue to sign in</Link></> : token ? <>
        <p>Enter your Yaans.lk password to confirm this request. Opening the link alone does not change your account.</p>
        <form onSubmit={confirm} className="space-y-3">
          <label className="block" htmlFor="email-confirm-password">Your Yaans.lk password</label>
          <input className="w-full rounded border p-2" id="email-confirm-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          <button className="rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-50" disabled={busy}>{busy ? 'Confirming…' : 'Confirm email address'}</button>
        </form>
      </> : <p>Open the full link from your verification email. If it has expired, submit registration again or request a new link in your account’s email settings.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>
  </div>;
}
