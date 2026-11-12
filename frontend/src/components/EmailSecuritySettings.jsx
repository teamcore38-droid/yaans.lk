import React, { useState } from 'react';
import { apiRequest } from '../utils/api.js';

export default function EmailSecuritySettings({ user, refreshUser, allowChange = true }) {
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const change = Boolean(allowChange && newEmail.trim());
      const result = await apiRequest(change ? '/auth/update-credentials' : '/auth/email-verification', {
        method: change ? 'PUT' : 'POST', body: JSON.stringify({ currentPassword: password, ...(change ? { newEmail: newEmail.trim() } : {}) })
      });
      setMessage(result.message); setPassword(''); setNewEmail(''); await refreshUser();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
    <h2 className="font-bold">Email verification &amp; security</h2>
    <p className="text-sm">{user.email} — {user.emailVerified ? 'Verified' : 'Not yet verified'}</p>
    {user.pendingEmail && <p role="status" className="text-sm">Waiting for confirmation at {user.pendingEmail}. Your current login email remains active. A new request replaces the earlier change link.</p>}
    {(!user.emailVerified || allowChange) && <form onSubmit={submit} className="space-y-3 text-sm">
      {allowChange && <label className="block">New login email (optional)
        <input className="block w-full border rounded p-2 mt-1" type="email" autoComplete="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
      </label>}
      <label className="block">Current password for email verification
        <input className="block w-full border rounded p-2 mt-1" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <button disabled={busy} className="bg-slate-900 text-white rounded px-4 py-2 disabled:opacity-50">{busy ? 'Sending…' : newEmail.trim() ? 'Request email change' : 'Send verification email'}</button>
    </form>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
