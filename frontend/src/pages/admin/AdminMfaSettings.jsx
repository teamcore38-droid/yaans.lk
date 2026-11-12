import React, { useState } from 'react';
import { apiRequest } from '../../utils/api.js';

export default function AdminMfaSettings({ user, refreshUser, showToast }) {
  const [password,setPassword]=useState(''),[setup,setSetup]=useState(null),[code,setCode]=useState('');
  const [recovery,setRecovery]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const start=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{setSetup(await apiRequest('/auth/admin/mfa/enroll',{method:'POST',body:JSON.stringify({currentPassword:password})}));setPassword('');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const confirm=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{const result=await apiRequest('/auth/admin/mfa/confirm',{method:'POST',body:JSON.stringify({code:code.trim()})});
      setSetup(null);setCode('');setRecovery(result.recoveryCodes);await refreshUser();showToast('Authenticator enabled. Save your recovery codes.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-sm">
    <h3 className="font-bold">Administrator authenticator</h3>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {user?.mfaEnabled&&<p>An authenticator is enabled. Signing in requires your password and a current authenticator or unused recovery code.</p>}
    {!user?.mfaEnabled&&!setup&&<form onSubmit={start} className="space-y-3">
      <p>Enable an authenticator before public launch. Use an authenticator app that supports time-based codes.</p>
      <label className="block">Current password
        <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="block border rounded p-2 w-full" />
      </label>
      <button disabled={busy} className="rounded bg-slate-900 text-white px-4 py-2">{busy?'Preparing…':'Set up authenticator'}</button>
    </form>}
    {setup&&<form onSubmit={confirm} className="space-y-3">
      <p>In your authenticator, add a time-based account with issuer <strong>{setup.issuer}</strong>, account <strong>{setup.account}</strong>, and this setup key. Setup expires in ten minutes.</p>
      <p className="font-mono break-all select-all" aria-label="Authenticator setup key">{setup.secret}</p>
      <label className="block">Six-digit authenticator code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} className="block border rounded p-2" /></label>
      <button disabled={busy} className="rounded bg-slate-900 text-white px-4 py-2">{busy?'Verifying…':'Enable authenticator'}</button>
    </form>}
    {recovery.length>0&&<div className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3">
      <p className="font-bold">Save these recovery codes in your password manager now. They are shown once.</p>
      <p>Each code works once. Keep them separate from the authenticator. Never send setup keys or codes in chat.</p>
      <ul className="font-mono select-all">{recovery.map(value=><li key={value}>{value}</li>)}</ul>
      <button type="button" onClick={()=>setRecovery([])} className="underline">I saved my recovery codes</button>
    </div>}
  </section>;
}
