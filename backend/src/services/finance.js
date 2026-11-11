import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { getStore, loadCollections, persistStore, withTransaction, idFilter, generateId } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';
import { payoutEligible } from '../../../shared/payments.js';
import { releaseInventory } from './orders.js';
export { payoutEligible } from '../../../shared/payments.js';

export function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100000000 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw httpError(400, 'Enter a positive amount with at most two decimal places.');
  return Math.round(value * 100);
}

function evidence(body) {
  const reference = typeof body.bankReference === 'string' ? body.bankReference.trim() : '';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 /_.-]{5,119}$/.test(reference)) throw httpError(400, 'Enter the actual bank/courier transaction reference (6–120 characters).');
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 500)) throw httpError(400, 'Notes must be at most 500 characters.');
  return { reference, amountMinor: money(body.amountLkr), notes: body.notes || '' };
}

function ledgerKey(kind, reference) {
  return `${kind}:${createHash('sha256').update(reference.toUpperCase()).digest('hex')}`;
}

async function financialTransaction(kind, body, identity, work) {
  const proof = evidence(body);
  const key = ledgerKey(kind, proof.reference);
  const fingerprint = JSON.stringify([identity, proof.amountMinor]);
  const execute = () => withTransaction(async (session) => {
    const ledger = mongoose.connection.db.collection('cashmovements');
    const prior = await ledger.findOne({ _id: key }, { session });
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw httpError(409, 'This transaction reference has already been used for another amount or payment.');
      return { ...prior.result, replayed: true };
    }
    const result = await work(session, { ...proof, ledgerId: key });
    await ledger.insertOne({ _id: key, kind, fingerprint, reference: proof.reference,
      amountMinor: proof.amountMinor, createdAt: new Date(), result }, { session });
    return result;
  });
  // An identical request can win the unique ledger key in another process.
  try { return await execute(); } catch (error) { if (error.code === 11000) return execute(); throw error; }
}

export async function recordCashMovement(kind, subOrderId, body, admin) {
  if (!['receipt', 'refund', 'recovery'].includes(kind)) throw httpError(400, 'Invalid cash movement.');
  return financialTransaction(kind, body, subOrderId, async (session, proof) => {
    const store = await getStore({ subOrders: idFilter(subOrderId), platformConfig: true }, { session });
    const sub = store.subOrders[0];
    if (!sub || sub.paymentMethod !== 'COD') throw httpError(404, 'COD package not found.');
    const now = new Date().toISOString();
    const record = { reference: proof.reference, amountLkr: proof.amountMinor / 100,
      confirmedAt: now, confirmedBy: admin._id, ledgerId: proof.ledgerId };
    if (kind === 'receipt') {
      if (!['delivered', 'return_requested', 'returned'].includes(sub.fulfillmentStatus)) throw httpError(409, 'Confirm receipt only after delivery.');
      if (sub.paymentReceipt) throw httpError(409, 'Receipt is already confirmed for this package.');
      if (proof.amountMinor !== money(sub.grossTotalLkr)) throw httpError(409, 'Received amount must equal the package COD total, including delivery.');
      sub.paymentReceipt = record;
      sub.codCollectionStatus = 'remitted_to_platform';
      sub.settlementStatus = sub.fulfillmentStatus === 'delivered' ? 'eligible_for_payout' : 'held_for_return';
    } else if (kind === 'refund') {
      if (sub.fulfillmentStatus !== 'returned' || !sub.paymentReceipt?.ledgerId) throw httpError(409, 'Confirm the returned goods and platform receipt before recording a refund.');
      if (sub.refund) throw httpError(409, 'Refund is already recorded.');
      if (proof.amountMinor !== money(sub.grossTotalLkr)) throw httpError(409, 'The full package refund must equal the received COD total.');
      sub.refund = record;
      sub.codCollectionStatus = 'refunded';
      if (sub.settlementId) sub.sellerRecovery = { status: 'required', amountLkr: sub.netSellerEarningsLkr, settlementId: sub.settlementId };
      else sub.settlementStatus = 'voided';
    } else {
      if (sub.sellerRecovery?.status !== 'required') throw httpError(409, 'No seller recovery is pending for this package.');
      if (proof.amountMinor !== money(sub.sellerRecovery.amountLkr)) throw httpError(409, 'Recovery must equal the previously paid seller earnings.');
      sub.sellerRecovery = { ...sub.sellerRecovery, status: 'recovered', receipt: record };
    }
    sub.statusHistory.push({ status: `cash_${kind}_confirmed`, note: `${kind} confirmed against ${proof.reference}. ${proof.notes}`.trim(), timestamp: now });
    recordAdminAuditLog(store, { action: `cod_${kind}`, adminId: admin._id, adminEmail: admin.email,
      details: `Recorded ${kind} for ${sub.subOrderNumber}`, metadata: { subOrderId, amountLkr: record.amountLkr, reference: proof.reference } });
    await persistStore(store);
    return { subOrder: sub, message: `COD ${kind} recorded against the supplied transaction reference.` };
  });
}

export async function recordSellerPayout(body, admin) {
  const { sellerId, subOrderIds } = body;
  if (typeof sellerId !== 'string' || !Array.isArray(subOrderIds) || !subOrderIds.length || subOrderIds.length > 100 ||
      subOrderIds.some((id) => typeof id !== 'string' || !id) || new Set(subOrderIds).size !== subOrderIds.length) throw httpError(400, 'Select 1–100 distinct packages for this seller payout.');
  const ids = [...subOrderIds].sort();
  return financialTransaction('payout', body, [sellerId, ids], async (session, proof) => {
    const store = await getStore({ sellers: idFilter(sellerId), subOrders: { sellerId }, settlements: { _id: { $in: [] } }, platformConfig: true }, { session });
    const seller = store.sellers[0];
    if (!seller || seller.status !== 'approved') throw httpError(409, 'An approved seller is required.');
    if (store.subOrders.some((sub) => sub.sellerRecovery?.status === 'required' || (sub.settlementId && ['return_requested', 'returned'].includes(sub.fulfillmentStatus) && !sub.refund))) {
      throw httpError(409, 'Resolve this seller’s returned payouts and outstanding recoveries before recording another payout.');
    }
    const selected = ids.map((id) => store.subOrders.find((sub) => sub._id === id));
    if (selected.some((sub) => !sub || !payoutEligible(sub))) throw httpError(409, 'Every selected package must be delivered, receipt-confirmed and free of return/refund holds.');
    const netMinor = selected.reduce((sum, sub) => sum + money(sub.netSellerEarningsLkr), 0);
    if (proof.amountMinor !== netMinor) throw httpError(409, 'The paid amount must exactly match the selected seller earnings.');
    const settlementId = generateId('stl');
    const settlementReference = `STL-YLK-${new Date().getUTCFullYear()}-${settlementId.slice(4).replaceAll('-', '').toUpperCase()}`;
    const settlement = { _id: settlementId, settlementReference, sellerId, sellerName: seller.storeName,
      subOrderIds: ids, grossOrderItemsLkr: selected.reduce((sum, sub) => sum + sub.itemsSubtotalLkr, 0),
      platformCommissionLkr: selected.reduce((sum, sub) => sum + sub.commissionAmountLkr, 0),
      netPayoutLkr: netMinor / 100, bankReference: proof.reference, ledgerId: proof.ledgerId,
      status: 'paid', paidAt: new Date().toISOString(), notes: proof.notes };
    for (const sub of selected) {
      sub.settlementStatus = 'settled'; sub.settlementId = settlementId;
      sub.statusHistory.push({ status: 'settled', note: `Bank payout recorded against ${proof.reference}.`, timestamp: settlement.paidAt });
    }
    store.settlements.push(settlement);
    recordAdminAuditLog(store, { action: 'seller_payout', adminId: admin._id, adminEmail: admin.email,
      details: `Recorded ${settlementReference}`, metadata: { sellerId, subOrderIds: ids, netPayoutLkr: netMinor / 100, reference: proof.reference } });
    await persistStore(store);
    return { settlement, settledCount: selected.length, message: 'Completed bank transfer recorded. This action does not send money.' };
  });
}

export async function restockReturnedPackage(subOrderId, body, admin) {
  if (body.inspectedForResale !== true || typeof body.reason !== 'string' || body.reason.trim().length < 6 || body.reason.length > 500) throw httpError(400, 'Confirm inspection for resale and record an inspection note.');
  return withTransaction(async (session) => {
    const store = await getStore({ subOrders: idFilter(subOrderId), platformConfig: true }, { session });
    const sub = store.subOrders[0];
    if (!sub || sub.fulfillmentStatus !== 'returned') throw httpError(409, 'Only received returns can be inspected and restocked.');
    if (sub.inventoryReleasedAt) return { message: 'Inspected return was already restocked.', replayed: true };
    await loadCollections(store, { products: { $or: sub.items.map((item) => idFilter(item.productId)) }, sellers: idFilter(sub.sellerId) });
    releaseInventory(store, sub);
    sub.returnInspection = { inspectedBy: admin._id, inspectedAt: new Date().toISOString(), reason: body.reason.trim() };
    recordAdminAuditLog(store, { action: 'return_restocked', adminId: admin._id, adminEmail: admin.email,
      details: `Restocked inspected return ${sub.subOrderNumber}`, metadata: { subOrderId } });
    await persistStore(store);
    return { message: 'Inspected returned inventory restored once.' };
  });
}
