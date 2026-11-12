import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

export default function StaffLoginPage() {
  const { staffLogin } = useMarketplace();
  const navigate = useNavigate();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { await staffLogin(email.trim(), password); navigate('/staff'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="max-w-md mx-auto px-4 py-10"><form onSubmit={submit} className="bg-white border rounded-xl p-6 space-y-4">
    <h1 className="text-xl font-bold">Staff Login</h1>
    <p className="text-sm text-slate-600">Order monitoring for staff accounts created by your administrator. Sessions last up to 8 hours and lock after 30 minutes without activity.</p>
    {new URLSearchParams(window.location.search).has('expired') && <p role="status">Your session expired. Please sign in again.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <label className="block">Staff email<input className="block border rounded p-2 w-full" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label className="block">Password<input className="block border rounded p-2 w-full" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button disabled={busy} className="bg-slate-900 text-white rounded px-4 py-2">{busy ? 'Signing in…' : 'Sign in to Staff Dashboard'}</button>
    <Link to="/login" className="block text-sm underline">Customer or seller sign-in</Link>
  </form></div>;
}
