import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api.js';

const emptyForm = { name: '', email: '', phone: '', password: '', currentPassword: '' };
export default function StaffManagementTab() {
  const [data, setData] = useState({ staff: [], nextCursor: null });
  const [form, setForm] = useState(emptyForm), [operation, setOperation] = useState(null);
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const version = useRef(0);
  const load = useCallback(async (after = '') => {
    const request = ++version.current;
    try { const result = await apiRequest(`/admin/staff${after ? `?after=${encodeURIComponent(after)}` : ''}`); if (request === version.current) setData(result); }
    catch (error) { if (request === version.current) setError(error.message); }
  }, []);
  useEffect(() => { load(); return () => { version.current++; }; }, [load]);
  async function create(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await apiRequest('/admin/staff', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm); setMessage(result.message); await load();
    } catch (error) { setError(error.message); setForm(previous => ({ ...previous, currentPassword: '' })); }
    finally { setBusy(false); }
  }
  async function apply(event) {
    event.preventDefault(); if (busy || !operation) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const endpoint = `/admin/staff/${encodeURIComponent(operation.staff._id)}`;
      await apiRequest(operation.reset ? `${endpoint}/reset-password` : endpoint, {
        method: operation.reset ? 'POST' : 'PATCH', body: JSON.stringify(operation.reset ? { currentPassword, newPassword } : { currentPassword, isActive: !operation.staff.isActive })
      });
      setMessage(operation.reset ? 'Temporary password reset. Share it privately; previous sessions have been revoked.' : 'Staff access updated. Previous sessions have been revoked.');
      setOperation(null); setNew(''); setCurrent(''); await load();
    } catch (error) { setError(error.message); setCurrent(''); }
    finally { setBusy(false); }
  }
  const field = (name, label, type = 'text') => <label className="block">{label}<input className="block w-full border rounded p-2" type={type} required minLength={type === 'password' && name === 'password' ? 15 : undefined} autoComplete={type === 'password' ? name === 'password' ? 'new-password' : 'current-password' : 'off'} value={form[name]} onChange={e => setForm(previous => ({ ...previous, [name]: e.target.value }))} /></label>;
  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold">Staff accounts</h2><p className="text-sm">Create individual accounts for order monitoring. Staff can view orders and delivery details, but cannot change orders, payments, sellers, or platform settings.</p><Link to="/staff/login" className="text-sky-800 underline">Staff login page</Link></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-emerald-800">{message}</p>}
    <form aria-label="Create staff account" onSubmit={create} className="bg-white border rounded-xl p-5 space-y-3 max-w-lg">
      <h3 className="font-bold">Add staff member</h3>
      {field('name', 'Staff name')}{field('email', 'Staff email', 'email')}{field('phone', 'Staff phone', 'tel')}
      {field('password', 'Temporary staff password', 'password')}{field('currentPassword', 'Your administrator password', 'password')}
      <p className="text-xs">Use at least 15 characters. Share the temporary password privately. Staff must replace it before viewing orders.</p>
      <button disabled={busy} className="bg-slate-900 text-white px-4 py-2 rounded">Create staff account</button>
    </form>
    {operation && <form aria-label="Confirm staff access change" onSubmit={apply} className="bg-amber-50 border rounded-xl p-5 space-y-3 max-w-lg">
      <h3 className="font-bold">{operation.reset ? 'Reset password' : operation.staff.isActive ? 'Disable staff access' : 'Enable staff access'}: {operation.staff.name}</h3>
      <p>All existing sessions for this staff member will be revoked.</p>
      {operation.reset && <label className="block">New temporary password<input className="block border rounded p-2 w-full" type="password" required minLength={15} autoComplete="new-password" value={newPassword} onChange={e => setNew(e.target.value)} /></label>}
      <label className="block">Confirm with your administrator password<input className="block border rounded p-2 w-full" type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label>
      <div className="flex gap-3"><button disabled={busy} className="bg-slate-900 text-white px-4 py-2 rounded">Confirm staff change</button><button type="button" disabled={busy} onClick={() => { setOperation(null); setNew(''); setCurrent(''); }}>Cancel</button></div>
    </form>}
    <div className="flex gap-3"><button disabled={busy} onClick={() => load()} className="underline">Refresh staff list</button>{data.nextCursor && <button disabled={busy} onClick={() => load(data.nextCursor)} className="underline">More staff accounts</button>}</div>
    <div className="grid gap-3 md:grid-cols-2">{data.staff.map(staff => <article key={staff._id} aria-label={`Staff member ${staff.name}`} className="border rounded-xl bg-white p-4 space-y-2">
      <h3 className="font-bold">{staff.name}</h3><p className="break-all">{staff.email}</p><p>{staff.isActive ? 'Active' : 'Disabled'}{staff.staffMustChangePassword ? ' · Password change required' : ''}</p>
      <div className="flex flex-wrap gap-4"><button disabled={busy} className="text-sky-800 underline" onClick={() => { setOperation({ staff }); setCurrent(''); setNew(''); }}>{staff.isActive ? 'Disable access' : 'Enable access'}</button><button disabled={busy} className="text-sky-800 underline" onClick={() => { setOperation({ staff, reset: true }); setCurrent(''); setNew(''); }}>Reset password</button></div>
    </article>)}</div>
    {!data.staff.length && <p>No staff accounts yet.</p>}
  </div>;
}
