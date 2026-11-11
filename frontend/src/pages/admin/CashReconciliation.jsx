import React, { useRef, useState } from 'react';
import { apiRequest, formatLkr } from '../../utils/api.js';

export function PaymentEvidenceForm({ label, expectedAmount, onRecord }) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    locked.current = true; setBusy(true); setError('');
    try {
      await onRecord({ bankReference: values.get('bankReference'), amountLkr: Number(values.get('amountLkr')), notes: values.get('notes') });
      form.reset();
    } catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} aria-label={label} className="space-y-2 border-t border-slate-200 pt-3 text-xs">
    <p>Expected amount: <strong>{formatLkr(expectedAmount)}</strong>. Record a completed transaction after checking its evidence.</p>
    <label className="block">Actual bank or courier reference
      <input name="bankReference" required minLength={6} maxLength={120} className="block w-full border rounded p-2" />
    </label>
    <label className="block">Confirmed amount (LKR)
      <input name="amountLkr" type="number" required min="0.01" step="0.01" className="block w-full border rounded p-2" />
    </label>
    <label className="block">Reconciliation notes
      <input name="notes" maxLength={500} className="block w-full border rounded p-2" />
    </label>
    <label className="flex items-start gap-2"><input type="checkbox" required />I verified this transaction in the bank or courier statement.</label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={busy} className="rounded bg-slate-900 text-white font-bold px-3 py-2 disabled:opacity-50">{busy ? 'Recording…' : label}</button>
  </form>;
}

function ReturnStockInspection({ subOrder, onRecorded }) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form aria-label="Inspect returned stock" className="space-y-2 border-t pt-3" onSubmit={async (event) => {
    event.preventDefault();
    if (locked.current) return;
    const values = new FormData(event.currentTarget);
    locked.current = true; setBusy(true); setError('');
    try {
      await apiRequest(`/admin/suborders/${subOrder._id}/restock-return`, { method: 'POST', body: JSON.stringify({ inspectedForResale: true, reason: values.get('reason') }) });
      await onRecorded();
    } catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  }}>
    <label className="block">Return inspection note<input name="reason" required minLength={6} maxLength={500} className="block w-full rounded border p-2" /></label>
    <label className="flex items-start gap-2"><input type="checkbox" required />I inspected the returned goods and approved them for resale.</label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={busy} className="rounded border bg-white px-3 py-2 font-bold disabled:opacity-50">{busy ? 'Recording inspection…' : 'Restock inspected return'}</button>
  </form>;
}

export default function CashReconciliation({ subOrders, showToast, fetchOverview }) {
  const pending = subOrders.filter((sub) => sub.paymentMethod === 'COD' && ['delivered', 'return_requested', 'returned'].includes(sub.fulfillmentStatus));
  return <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
    <h2 className="font-extrabold">COD receipts, returns and refunds</h2>
    <p className="text-xs text-slate-600">Delivery does not confirm money received. Returns hold unpaid earnings. Record refunds only after the goods are received and the customer has actually been paid. Payouts after a paid-order return stay blocked until recovery is resolved.</p>
    {!pending.length && <p className="text-xs">No delivered COD packages to reconcile.</p>}
    {pending.map((sub) => {
      const kind = !sub.paymentReceipt ? 'receipt' : sub.fulfillmentStatus === 'returned' && !sub.refund ? 'refund' : sub.sellerRecovery?.status === 'required' ? 'recovery' : null;
      const label = kind === 'receipt' ? 'Confirm platform receipt' : kind === 'refund' ? 'Record completed customer refund' : 'Confirm seller recovery';
      return <article key={`${sub._id}:${kind}`} className="bg-slate-50 rounded border p-3 space-y-2 text-xs" aria-label={`Reconcile ${sub.subOrderNumber}`}>
        <h3 className="font-bold">{sub.subOrderNumber} · {sub.sellerName}</h3>
        <p>Delivery: {sub.fulfillmentStatus.replaceAll('_', ' ')} · Cash: {sub.codCollectionStatus.replaceAll('_', ' ')} · Payout: {sub.settlementStatus.replaceAll('_', ' ')}</p>
        {sub.paymentReceipt && <p>Platform receipt confirmed: {formatLkr(sub.paymentReceipt.amountLkr)} · {sub.paymentReceipt.reference}</p>}
        {sub.refund && <p>Customer refund recorded: {formatLkr(sub.refund.amountLkr)} · {sub.refund.reference}</p>}
        {sub.fulfillmentStatus === 'return_requested' && <p>Return requested. Wait for the seller to confirm that the goods were received before recording a refund.</p>}
        {kind && <PaymentEvidenceForm label={label} expectedAmount={kind === 'recovery' ? sub.sellerRecovery.amountLkr : sub.grossTotalLkr} onRecord={async (body) => {
          const result = await apiRequest(`/admin/suborders/${sub._id}/cash/${kind}`, { method: 'POST', body: JSON.stringify(body) });
          showToast(result.message); await fetchOverview();
        }} />}
        {sub.fulfillmentStatus === 'returned' && !sub.inventoryReleasedAt && <ReturnStockInspection subOrder={sub} onRecorded={async () => {
          showToast('Inspected returned inventory restored once.'); await fetchOverview();
        }} />}
      </article>;
    })}
  </section>;
}
