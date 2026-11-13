import mongoose from 'mongoose';
import { httpError } from '../config/errors.js';

const clone = value => JSON.parse(JSON.stringify(value));
export const documentKinds = ['summary', 'invoice', 'packing-slip', 'receipt', 'refund', 'cancellation'];
const titles = {summary:'Order summary', invoice:'Commercial invoice', 'packing-slip':'Packing slip', receipt:'Payment receipt', refund:'Refund confirmation', cancellation:'Cancellation confirmation'};
function base(order, sub, seller) {
  return {
    orderId: String(order._id), orderNumber: order.orderNumber, packageId: sub ? String(sub._id) : null,
    packageNumber: sub?.subOrderNumber || null, sellerId: sub?.sellerId || null,
    issuer: sub ? {name:seller?.storeName || sub.sellerName, address:seller?.businessAddress || '', phone:seller?.contactPhone || ''} : {name:process.env.DOCUMENT_BUSINESS_NAME || 'Yaans.lk', address:process.env.DOCUMENT_BUSINESS_ADDRESS || ''},
    customer: clone(order.shippingAddress), items: (sub?.items || order.items).map(({title,sku,variantLabel,quantity,unitPriceLkr,lineTotalLkr,sellerName})=>({title,sku,variantLabel,quantity,unitPriceLkr,lineTotalLkr,sellerName})),
    subtotalLkr: sub?.itemsSubtotalLkr ?? order.itemsSubtotalLkr,
    deliveryLkr: sub?.deliveryFeeLkr ?? order.totalDeliveryFeeLkr,
    totalLkr: sub?.grossTotalLkr ?? order.grandTotalLkr, paymentMethod:order.paymentMethod, orderDate:order.createdAt,
    legacy: false
  };
}
function documentRecord(snapshot, kind, issuedAt, extra = {}) {
  return {...snapshot,...extra,_id:`${snapshot.packageId || snapshot.orderId}:${kind}`,kind,title:titles[kind],number:`${snapshot.packageNumber || snapshot.orderNumber}-${kind.toUpperCase()}`,issuedAt};
}
async function insertDocument(snapshot, kind, issuedAt, session, extra = {}) {
  const record=documentRecord(snapshot,kind,issuedAt,extra);
  await mongoose.connection.db.collection('orderdocuments').updateOne({_id:record._id},{$setOnInsert:record},{upsert:true,session});
}
export async function saveCheckoutDocuments(order, subs, sellers, session, encryptedAccess = null) {
  const documents=[documentRecord(base(order),'summary',order.createdAt)];
  for (const sub of subs) {
    const snapshot = base(order, sub, sellers.find(s=>s._id===sub.sellerId));
    documents.push(documentRecord(snapshot,'invoice',order.createdAt),documentRecord(snapshot,'packing-slip',order.createdAt));
  }
  await mongoose.connection.db.collection('orderdocuments').insertMany(documents,{session});
  // Outbox creation commits atomically with inventory, order and documents.
  if (order.customerEmail && order.customerEmail !== 'guest@yaans.lk') {
    await mongoose.connection.db.collection('orderemailjobs').insertOne({_id:`${order._id}:confirmation`,orderId:order._id,to:order.customerEmail,encryptedAccess,status:'pending',attempts:0,createdAt:new Date(order.createdAt),nextAttemptAt:new Date(),leaseUntil:new Date(0)}, {session});
  }
}

export async function capturePackageDocuments(sub, session) {
  const db=mongoose.connection.db;
  let snapshot=await db.collection('orderdocuments').findOne({_id:`${sub._id}:invoice`},{session});
  // Historical orders use their saved order lines, never today's catalogue prices.
  if (!snapshot) {
    const order=await db.collection('orders').findOne({_id:sub.parentOrderId},{session});
    if (!order) return;
    snapshot={...base(order,sub),legacy:true};
  }
  const {_id,kind,title,number,issuedAt,...saved}=snapshot;
  if (sub.codCollectedAt || sub.paymentReceipt) await insertDocument(saved,'receipt',sub.codCollectedAt || sub.paymentReceipt.confirmedAt,session,{paymentStatus:'COD collection recorded',amountLkr:sub.grossTotalLkr});
  if (sub.refund) await insertDocument(saved,'refund',sub.refund.confirmedAt,session,{paymentStatus:'Refund recorded',amountLkr:sub.refund.amountLkr});
  if (sub.fulfillmentStatus==='cancelled') await insertDocument(saved,'cancellation',sub.statusHistory?.at(-1)?.timestamp || new Date().toISOString(),session,{paymentStatus:'Cancelled'});
}

export async function documentBundle(order, subs, sellerId = null) {
  const db=mongoose.connection.db;
  const saved=await db.collection('orderdocuments').find({orderId:String(order._id),...(sellerId?{sellerId}:{})},{projection:{_id:1,title:1,kind:1,number:1,packageNumber:1,issuedAt:1,legacy:1},maxTimeMS:3000}).limit(501).toArray();
  // Read-only fallback: no mutation on GET, with clearly identified legacy documents.
  const result=[];
  if (!sellerId) result.push({...base(order),kind:'summary'});
  for(const sub of subs.filter(s=>!sellerId || s.sellerId===sellerId)) {
    for(const kind of ['invoice','packing-slip']) result.push({...base(order,sub),kind});
  }
  return [...saved, ...result.map(doc=>({_id:`${doc.packageId || doc.orderId}:${doc.kind}`,kind:doc.kind,title:titles[doc.kind],number:`${doc.packageNumber || doc.orderNumber}-${doc.kind.toUpperCase()}`,packageNumber:doc.packageNumber,issuedAt:doc.orderDate,legacy:true})).filter(doc=>!saved.some(existing=>existing._id===doc._id))];
}

export async function readDocument(order, subs, id, sellerId = null) {
  if(typeof id!=='string' || id.length>200)throw httpError(400,'Invalid document.');
  const allowed=await documentBundle(order,subs,sellerId);
  if(!allowed.some(doc=>doc._id===id))throw httpError(404,'Document not found.');
  const saved=await mongoose.connection.db.collection('orderdocuments').findOne({_id:id,orderId:String(order._id),...(sellerId?{sellerId}:{})},{maxTimeMS:3000});
  if(saved)return saved;
  const kind=id.slice(id.lastIndexOf(':')+1), sub=subs.find(s=>`${s._id}:${kind}`===id);
  return {...base(order,sub),...allowed.find(d=>d._id===id),legacy:true};
}
