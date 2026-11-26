import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api.js';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../../../shared/adminAccess.js';
import { adminOrderPath } from '../../../../shared/adminOrderPath.js';
import ProductImageGalleryEditor from '../../components/ProductImageGalleryEditor.jsx';
import AdminAccountTab from './AdminAccountTab.jsx';
import OperationRequests from './OperationRequests.jsx';

const BannerManagementTab = lazy(() => import('./BannerManagementTab.jsx'));
const modules = ['orders', 'products', 'sellers', 'merchandising', 'reports', 'audit'];
const button = 'min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50';
const input = 'block min-h-11 w-full rounded-lg border border-slate-300 p-2';

function ProductEditor({ product, user, onSave, onCancel }) {
  const [form, setForm] = useState({ title: product.title || '', description: product.description || '', images: product.images || [], priceLkr: product.priceLkr, stock: product.stock });
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); if (busy || uploading) return;
    setBusy(true); setError('');
    const body = { title: form.title, description: form.description, images: form.images, revision: product.revision };
    if (hasAdminPermission(user, 'productPricing')) body.priceLkr = Number(form.priceLkr);
    if (hasAdminPermission(user, 'productStock')) body.stock = Number(form.stock);
    try { await apiRequest('/admin/products/' + encodeURIComponent(product._id), { method: 'PUT', body: JSON.stringify(body) }); onSave(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <form onSubmit={save} aria-label="Edit product content" className="space-y-3 border rounded-xl p-4">
    <h3 className="font-bold">Edit {product.title}</h3>
    <label className="block">Product title<input required maxLength={200} className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
    <label className="block">Description<textarea maxLength={10000} className={input} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
    <ProductImageGalleryEditor images={form.images} onChange={images => setForm(old => ({ ...old, images }))} endpoint="/admin/product-image" disabled={busy} onBusyChange={setUploading}/>
    {hasAdminPermission(user, 'productPricing') && <label className="block">Price (LKR)<input type="number" min="0" step="0.01" required className={input} value={form.priceLkr} onChange={e => setForm({ ...form, priceLkr: e.target.value })}/></label>}
    {hasAdminPermission(user, 'productStock') && <label className="block">Stock<input type="number" min="0" step="1" required className={input} value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}/></label>}
    {error && <p role="alert">{error}</p>}<div className="flex flex-wrap gap-2"><button disabled={busy || uploading} className={button}>Save product</button><button type="button" disabled={busy || uploading} onClick={onCancel} className={button}>Cancel</button></div>
  </form>;
}

function SellerReview({ seller, save, busy }) {
  const [status, setStatus] = useState('approved'), [reason, setReason] = useState('');
  return <form onSubmit={e => { e.preventDefault(); save(seller._id, { status, rejectionReason: reason }); }} className="space-y-2">
    <label className="block">Review status<select className={input} value={status} onChange={e => setStatus(e.target.value)}>{['approved', 'pending', 'rejected', 'suspended'].map(s => <option key={s}>{s}</option>)}</select></label>
    <label className="block">Review reason<input required maxLength={500} className={input} value={reason} onChange={e => setReason(e.target.value)}/></label><button disabled={busy} className={button}>Save seller review</button>
  </form>;
}

function CategoryEditor({ category, save, busy }) {
  const [name, setName] = useState(category.name), [headline, setHeadline] = useState(category.quadHeadline || category.name);
  return <form className="border rounded-lg p-3 space-y-2" onSubmit={e => { e.preventDefault(); save('/admin/categories/' + encodeURIComponent(category._id), { name, quadHeadline: headline }); }}>
    <label className="block">Department name<input required maxLength={160} className={input} value={name} onChange={e => setName(e.target.value)}/></label>
    <label className="block">Department headline<input required maxLength={160} className={input} value={headline} onChange={e => setHeadline(e.target.value)}/></label><button disabled={busy} className={button}>Save department</button>
  </form>;
}

export default function CoAdminConsole({ user, refreshUser, showToast, logout }) {
  const allowed = modules.filter(key => hasAdminPermission(user, key));
  const [active, setActive] = useState(allowed[0] || 'account'), [data, setData] = useState(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [editing, setEditing] = useState(null);
  const requestVersion = useRef(0), navigate = useNavigate();
  const load = useCallback(async (after = '') => {
    if (active === 'account' || !hasAdminPermission(user, active)) return;
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try {
      const result = await apiRequest('/admin/operations?' + new URLSearchParams({ module: active, ...(query ? { q: query } : {}), ...(after ? { after } : {}) }));
      if (version === requestVersion.current) setData(old => after ? { ...result, rows: [...(old?.rows || []), ...result.rows] } : result);
    } catch (e) { if (version === requestVersion.current) setError(e.message); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [active, query, user]);
  useEffect(() => { setData(null); setEditing(null); load(); return () => { requestVersion.current++; }; }, [load]);
  async function mutate(path, body) {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }); showToast(result.message); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function changeTab(key) { setSearch(''); setQuery(''); setActive(key); }
  return <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
    <header className="flex flex-wrap gap-3 justify-between items-center"><div><h1 className="text-2xl font-bold">Marketplace Operations</h1><p className="text-sm text-slate-600">{user.name} · Co-admin · Assigned operations only</p></div><button className={button} onClick={async () => { if (await logout()) navigate('/admin/login'); }}>Sign out</button></header>
    <nav aria-label="Operations modules" className="flex flex-wrap gap-2">{[...allowed, 'account'].map(key => <button key={key} aria-pressed={active === key} onClick={() => changeTab(key)} className={button + (active === key ? ' bg-slate-900 text-white' : '')}>{key === 'account' ? 'My account & security' : ADMIN_PERMISSIONS[key]}</button>)}</nav>
    {active === 'account' ? <AdminAccountTab user={user} refreshUser={refreshUser} showToast={showToast}/> : <>
      <div className="flex flex-wrap gap-3"><button disabled={loading} onClick={() => load()} className={button}>Refresh module</button>{['orders', 'products'].includes(active) && <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }}><label>Find by {active === 'orders' ? 'order number' : 'SKU'}<input className={input} value={search} onChange={e => setSearch(e.target.value)} maxLength={120}/></label><button className={button}>Search</button></form>}</div>
      {error && <p role="alert" className="text-red-700">{error}</p>}{loading && <p role="status">Loading operations…</p>}
      {editing && <ProductEditor key={editing._id} product={editing} user={user} onCancel={() => setEditing(null)} onSave={() => { setEditing(null); load(); }}/>}
      <div className="grid md:grid-cols-2 gap-4">{(data?.rows || []).map(row => <article key={row._id} className="border rounded-xl bg-white p-4 space-y-2 min-w-0 break-words">
        {active === 'products' && <><h2 className="font-bold">{row.title}</h2><p>SKU: {row.sku} · {row.sellerName}</p><p>Status: {row.approvalStatus}</p><div className="flex flex-wrap gap-2"><button className={button} onClick={() => setEditing(row)}>Edit product content</button>{['approved', 'rejected'].map(status => <button key={status} disabled={busy} className={button} onClick={() => mutate('/admin/products/' + encodeURIComponent(row._id) + '/moderation', { approvalStatus: status, revision: row.revision })}>{status === 'approved' ? 'Approve' : 'Reject'} listing</button>)}</div></>}
        {active === 'sellers' && <><h2 className="font-bold">{row.storeName}</h2><p>{row.status} · {row.district} · {row.city}</p><p>{row.description}</p><p>{row.contactEmail} {row.contactPhone}</p><SellerReview seller={row} busy={busy} save={(id, body) => mutate('/admin/sellers/' + encodeURIComponent(id) + '/status', body)}/></>}
        {active === 'orders' && <><h2 className="font-bold">{row.orderNumber}</h2><p>{row.overallStatus}</p><p>{row.customerEmail} {row.customerPhone}</p><p>{[row.shippingAddress?.recipientName, row.shippingAddress?.addressLine1, row.shippingAddress?.addressLine2, row.shippingAddress?.city, row.shippingAddress?.district].filter(Boolean).join(', ')}</p>
          {adminOrderPath(row._id) && <Link to={adminOrderPath(row._id)} className="font-semibold text-sky-800 underline">View order details</Link>}</>}
        {active === 'audit' && <><p>{row.event} · {row.outcome}</p><p>{row.method} {row.path}</p><time>{new Date(row.createdAt).toLocaleString()}</time></>}
      </article>)}</div>
      {data?.nextCursor && <button disabled={loading} className={button} onClick={() => load(data.nextCursor)}>Load more</button>}
      {data?.rows?.length === 0 && <p>No records in this module.</p>}
      {active === 'orders' && <OperationRequests/>}
      {active === 'reports' && <section><h2 className="font-bold">Fulfillment counts</h2>{(data?.counts || []).map(row => <p key={row._id || 'unknown'}>{row._id || 'Unspecified'}: {row.count}</p>)}</section>}
      {active === 'merchandising' && data && <><Suspense fallback={<p>Loading banner editor…</p>}><BannerManagementTab bannersState={data.banners || []} categories={data.categories || []} showToast={showToast} fetchOverview={() => load()}/></Suspense><section className="space-y-3"><h2 className="font-bold">Department content</h2><div className="grid md:grid-cols-2 gap-3">{(data.categories || []).map(category => <CategoryEditor key={category._id} category={category} busy={busy} save={mutate}/>)}</div></section></>}
    </>}
  </main>;
}
