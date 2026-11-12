import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMarketplace } from '../context/MarketplaceContext.jsx';
import { apiRequest, formatLkr } from '../utils/api.js';
import OrderNotifications from '../components/OrderNotifications.jsx';

function PasswordSetup({ refreshUser, temporary = true, onDone }) {
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    if (newPassword !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await apiRequest('/auth/staff/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); await refreshUser(); onDone?.(); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <form aria-label="Change staff password" onSubmit={submit} className="max-w-md bg-white border rounded-xl p-5 space-y-3">
    <h2 className="font-bold">Change staff password</h2>
    <p>{temporary ? 'Change your temporary password before viewing orders.' : 'Changing your password revokes previous staff sessions.'}</p>
    {error && <p role="alert">{error}</p>}
    <label className="block">{temporary ? 'Temporary password' : 'Current password'}<input className="block border p-2 w-full" required type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label>
    <label className="block">New password<input className="block border p-2 w-full" required minLength={15} type="password" autoComplete="new-password" value={newPassword} onChange={e => setNew(e.target.value)} /></label>
    <label className="block">Confirm new password<input className="block border p-2 w-full" required minLength={15} type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    <button disabled={busy} className="bg-slate-900 text-white rounded px-4 py-2">Save staff password</button>
  </form>;
}
function OrderMonitor({ expire }) {
  const [data, setData] = useState({ orders: [], nextCursor: null }), [selected, setSelected] = useState(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const requestVersion = useRef(0), detailVersion = useRef(0), alive = useRef(true);
  const fail = useCallback(error => {
    if (error.status === 401 || error.status === 403) expire();
    else setError(error.message || 'Unable to load orders.');
  }, [expire]);
  const load = useCallback(async (before = '') => {
    const version = ++requestVersion.current;
    setLoading(true); setSelected(null); detailVersion.current++; setError('');
    try {
      const result = await apiRequest(`/staff/orders${before ? `?before=${encodeURIComponent(before)}` : ''}`);
      if (alive.current && version === requestVersion.current) setData(result);
    } catch (error) { if (alive.current && version === requestVersion.current) fail(error); }
    finally { if (alive.current && version === requestVersion.current) setLoading(false); }
  }, [fail]);
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; requestVersion.current++; detailVersion.current++; }; }, [load]);
  useEffect(() => {
    let lastSent = 0, idleTimer, stopped = false;
    const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(expire, 30 * 60000); };
    const activity = event => {
      if (!event.isTrusted || document.hidden) return;
      resetIdle();
      if (Date.now() - lastSent < 60000) return;
      lastSent = Date.now();
      apiRequest('/auth/staff/activity', { method: 'POST', body: '{}' }).catch(error => { if (!stopped) fail(error); });
    };
    resetIdle();
    document.addEventListener('pointerdown', activity); document.addEventListener('keydown', activity);
    return () => { stopped = true; clearTimeout(idleTimer); document.removeEventListener('pointerdown', activity); document.removeEventListener('keydown', activity); };
  }, [expire, fail]);
  async function view(id) {
    const version = ++detailVersion.current;
    setSelected(null); setError('');
    try { const result = await apiRequest(`/staff/orders/${encodeURIComponent(id)}`); if (alive.current && version === detailVersion.current) setSelected(result.order); }
    catch (error) { if (alive.current && version === detailVersion.current) fail(error); }
  }
  return <>
    <OrderNotifications onViewOrders={() => load()} onSessionExpired={expire} />
    <div className="flex flex-wrap gap-3"><button onClick={() => load()} disabled={loading} className="border rounded px-3 py-2 bg-white">Refresh latest orders</button>
      {data.nextCursor && <button onClick={() => load(data.nextCursor)} disabled={loading} className="border rounded px-3 py-2 bg-white">Older orders</button>}</div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {loading && <p role="status">Loading orders…</p>}
    <div className="grid gap-3 md:grid-cols-2">{data.orders.map(order => <article key={order._id} className="border bg-white rounded-xl p-4 space-y-2">
      <h2 className="font-bold">{order.orderNumber}</h2><p>{order.overallStatus} · {formatLkr(order.grandTotalLkr)} · {order.sellerCount} seller(s)</p>
      <p className="text-xs">{new Date(order.createdAt).toLocaleString()}</p>
      <button onClick={() => view(order._id)} className="text-sky-800 underline">View delivery details for {order.orderNumber}</button>
    </article>)}</div>
    {!loading && !data.orders.length && <p>No orders yet.</p>}
    {selected && <section aria-label="Order delivery details" className="bg-white border rounded-xl p-5 space-y-3">
      <div className="flex justify-between gap-3"><h2 className="font-bold">{selected.orderNumber}</h2><button onClick={() => { detailVersion.current++; setSelected(null); }}>Close details</button></div>
      <p>{selected.shippingAddress.recipientName} · {selected.shippingAddress.phone}</p>
      <p>{[selected.shippingAddress.addressLine1, selected.shippingAddress.addressLine2, selected.shippingAddress.city, selected.shippingAddress.district, selected.shippingAddress.postalCode].filter(Boolean).join(', ')}</p>
      {selected.shippingAddress.deliveryNotes && <p>{selected.shippingAddress.deliveryNotes}</p>}
      {selected.packages.map(sub => <article key={sub._id} className="border-t pt-3"><h3 className="font-bold">{sub.subOrderNumber} · {sub.sellerName}</h3><p>{sub.fulfillmentStatus} · {sub.courierPartner} {sub.trackingCode}</p><ul>{sub.items.map((item, index) => <li key={index}>{item.title} × {item.quantity} ({item.variantLabel})</li>)}</ul></article>)}
    </section>}
  </>;
}
export default function StaffDashboardPage() {
  const { user, refreshUser, clearSession } = useMarketplace();
  const [expired, setExpired] = useState(false), [changingPassword, setChangingPassword] = useState(false);
  const expire = useCallback(() => { setExpired(true); clearSession(); }, [clearSession]);
  if (expired) return <Navigate to="/staff/login?expired=1" replace />;
  if (!user) return <Navigate to="/staff/login" replace />;
  if (user.role !== 'staff') return <div className="p-8"><h1>Staff access required</h1><p>Sign in with an account created by your administrator.</p></div>;
  return <div className="max-w-6xl mx-auto px-4 py-6 space-y-5"><h1 className="text-2xl font-bold">Staff Dashboard</h1>
    <p className="text-sm text-slate-600">Order monitoring · {user.name} · 8-hour maximum session · Locks after 30 minutes without activity. Notifications update while this dashboard is open.</p>
    {!user.staffMustChangePassword && <button className="underline" onClick={() => setChangingPassword(value => !value)}>{changingPassword ? 'Back to orders' : 'Change password'}</button>}
    {user.staffMustChangePassword || changingPassword ? <PasswordSetup refreshUser={refreshUser} temporary={Boolean(user.staffMustChangePassword)} onDone={() => setChangingPassword(false)} /> : <OrderMonitor key={user._id} expire={expire} />}
  </div>;
}
