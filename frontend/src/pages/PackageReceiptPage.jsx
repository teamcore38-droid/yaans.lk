import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customerAuthPath } from '../../../shared/customerRedirect.js';
import { packageReceiptPath } from '../../../shared/packageReceiptPath.js';
import OrderDocuments from '../components/OrderDocuments.jsx';
import { useMarketplace } from '../context/MarketplaceContext.jsx';
import { apiRequest } from '../utils/api.js';

function ReceiptAccess({ packageId, path, signedIn }) {
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState(() => signedIn ? { code: '' } : null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController();
    const headers = attempt.code ? { 'X-Order-Access-Token': attempt.code } : {};
    apiRequest(`/documents/package-receipts/${packageId}`, { cache: 'no-store', headers, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ attempt, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ attempt, error }); });
    return () => controller.abort();
  }, [attempt, packageId]);

  const current = result?.attempt === attempt ? result : null;
  const busy = !!attempt && !current;
  if (current?.data) return <>
    <p className="text-slate-600">Package {current.data.packageNumber}</p>
    <OrderDocuments packageId={packageId} customerReceipt initialDocuments={current.data.documents} accessToken={attempt.code} />
  </>;

  return <>
    <p className="text-sm text-slate-700">Sign in to the account that placed this order, or enter the private access code from your guest order confirmation.</p>
    <Link className="inline-block font-semibold text-sky-800 underline" to={customerAuthPath('login', path)}>Sign in to view receipt</Link>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      if (!busy) setAttempt({ code: code.trim() });
    }}>
      <label htmlFor="package-access-code" className="block text-sm font-semibold">Private access code</label>
      <input id="package-access-code" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false}
        required minLength={43} value={code} onChange={event => setCode(event.target.value.trim())}
        maxLength={43} className="w-full rounded-lg border border-slate-300 p-3" />
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">View package documents</button>
    </form>
    {busy && <p role="status">Checking access…</p>}
    {current?.error && <p role="alert" className="text-red-800">{current.error.message || 'Could not open the package documents.'}</p>}
  </>;
}

export default function PackageReceiptPage() {
  const { packageId } = useParams();
  const { user } = useMarketplace();
  const path = packageReceiptPath(packageId);
  const customer = user?.role === 'customer' ? user : null;
  return <section className="mx-auto my-6 max-w-xl space-y-4 rounded-xl border bg-white p-5 sm:p-6">
    <h1 className="text-2xl font-extrabold text-slate-900">Package receipt</h1>
    {path ? <ReceiptAccess key={`${packageId}:${customer?._id || 'guest'}`} packageId={packageId} path={path} signedIn={!!customer} />
      : <p role="alert">This package link is invalid.</p>}
  </section>;
}
