import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';
import { customerRedirect } from '../../../shared/customerRedirect.js';

function GoogleMark() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.86 46.98 24.55Z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.77 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>;
}

export default function GoogleCustomerLogin({ purpose = 'login' }) {
  const { refreshUser } = useMarketplace();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const complete = params.get('google') === 'complete' && purpose === 'login';
  const returnTo = customerRedirect(params.get('redirect'));
  const [config, setConfig] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState(params.get('google') === 'failed' ? 'Google sign-in was cancelled or could not be verified. Please try again, or use email and password.' : '');
  const [form, setForm] = useState({ name: '', currentPassword: '', newPassword: '', confirmPassword: '', acceptTerms: false });

  useEffect(() => {
    let active = true;
    apiRequest('/auth/google/config').then(result => { if (active) setConfig(result); }).catch(() => {});
    if (complete) {
      apiRequest('/auth/google/pending').then(result => {
        if (!active) return;
        setPending(result); setForm(previous => ({ ...previous, name: result.name || '' }));
      }).catch(err => { if (active) setError(err.message); });
    }
    return () => { active = false; };
  }, [complete]);

  const start = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const result = await apiRequest('/auth/google/start', { method: 'POST', body: JSON.stringify({ purpose, returnTo: purpose === 'set-password' ? '/account' : returnTo }) });
      const url = new URL(result.url);
      if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') throw new Error('Google sign-in is temporarily unavailable.');
      window.location.assign(url.href);
    } catch (err) { setError(err.message); setBusy(false); submitting.current = false; }
  };

  const submit = async event => {
    event.preventDefault(); setError('');
    if (submitting.current) return;
    if (pending.mode === 'set-password' && form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; }
    submitting.current = true;
    setBusy(true);
    try {
      const body = pending.mode === 'register' ? { name: form.name, acceptTerms: form.acceptTerms }
        : pending.mode === 'link' ? { currentPassword: form.currentPassword } : { newPassword: form.newPassword };
      const result = await apiRequest('/auth/google/complete', { method: 'POST', headers: { 'X-Google-CSRF': pending.csrf }, body: JSON.stringify(body) });
      await refreshUser();
      navigate(customerRedirect(result.returnTo), { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); submitting.current = false; }
  };

  const update = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';
  if (!config?.enabled && !complete && !error) return null;
  return <div className="space-y-3 text-xs">
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
    {complete && pending ? <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 p-4">
      <h2 className="font-bold text-sm">{pending.mode === 'register' ? 'Complete your customer profile' : pending.mode === 'link' ? 'Securely link your existing account' : 'Create a Yaans password'}</h2>
      <p className="break-words text-slate-600">Google account: {pending.email}</p>
      {pending.mode === 'register' && <>
        <label className="block space-y-1"><span>Full name</span><input className={inputClass} name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={update} /></label>
        <label className="flex items-start gap-2"><input name="acceptTerms" type="checkbox" required checked={form.acceptTerms} onChange={update} /><span>I accept the <Link className="underline" to="/terms" target="_blank" rel="noopener noreferrer">Terms</Link> and acknowledge the <Link className="underline" to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</span></label>
        <p className="text-slate-500">Add your delivery phone number, district and address at checkout when you place an order.</p>
      </>}
      {pending.mode === 'link' && <>
        <p className="text-slate-600">An existing Yaans account uses this email. Confirm its password once to link Google and keep your orders, addresses and wishlist.</p>
        <label className="block space-y-1"><span>Current Yaans password</span><input className={inputClass} name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} value={form.currentPassword} onChange={update} /></label>
      </>}
      {pending.mode === 'set-password' && <>
        <p className="text-slate-600">You have verified your linked Google account. Create a password to also sign in with email.</p>
        <label className="block space-y-1"><span>New password</span><input className={inputClass} name="newPassword" type="password" autoComplete="new-password" required minLength={15} maxLength={256} value={form.newPassword} onChange={update} /></label>
        <label className="block space-y-1"><span>Confirm new password</span><input className={inputClass} name="confirmPassword" type="password" autoComplete="new-password" required minLength={15} maxLength={256} value={form.confirmPassword} onChange={update} /></label>
      </>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-amber-400 px-4 py-2.5 font-bold text-slate-950 disabled:opacity-60">{busy ? 'Please wait...' : pending.mode === 'register' ? 'Create customer account' : pending.mode === 'link' ? 'Link Google and sign in' : 'Create password'}</button>
    </form> : complete && !error ? <p role="status">Checking your Google sign-in...</p> : null}
    {config?.enabled && (!complete || error) && <>
      {purpose === 'set-password' && <p className="text-slate-600">You sign in with Google. Verify your linked Google account to create an optional Yaans password.</p>}
      {config.origin !== window.location.origin ? <a className="block text-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium" href={`${config.origin}/login?redirect=${encodeURIComponent(returnTo)}`}>Continue on the main Yaans website</a> :
        <button type="button" onClick={start} disabled={busy} className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">
          <GoogleMark />{busy ? 'Please wait...' : purpose === 'set-password' ? 'Verify with Google to create a password' : complete ? 'Start Google sign-in again' : 'Continue with Google'}
        </button>}
      {purpose === 'login' && <p className="text-center text-slate-500">Google sign-in is available for customer accounts.</p>}
    </>}
  </div>;
}
