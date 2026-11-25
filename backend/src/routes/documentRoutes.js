import mongoose from 'mongoose';
import { isOwner } from '../../../shared/adminAccess.js';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createRouter} from '../config/router.js';
import {idFilter} from '../config/db.js';
import {httpError} from '../config/errors.js';
import {authenticate,optionalAuthenticate,requireRole} from '../middleware/auth.js';
import {sharedRateLimit,documentLimit} from '../middleware/sharedRateLimit.js';
import {assertOrderAccess} from '../services/orders.js';
import {documentBundle,readDocument} from '../services/orderDocuments.js';
import {emailConfiguration,processOrderEmails} from '../services/orderEmails.js';
import {adminOrderUrl,orderQr,packageReceiptUrl} from '../services/orderQr.js';
import {packageReceiptPath} from '../../../shared/packageReceiptPath.js';

const router=createRouter();
router.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});next();});
router.use(sharedRateLimit('order-documents-ip',300,60000));
async function sellerPackage(req) {
  const db=mongoose.connection.db;
  const {id}=req.params;
  if(!packageReceiptPath(id))throw httpError(400,'Invalid package ID.');
  const sub=await db.collection('suborders').findOne(idFilter(id),{maxTimeMS:3000});
  if(!sub)throw httpError(404,'Package not found.');
  if(!isOwner(req.user)){
    const seller=await db.collection('sellers').findOne({$or:[{_id:req.user.sellerId || null},{userId:req.user._id}]},{projection:{_id:1},maxTimeMS:3000});
    if(!seller || String(seller._id)!==sub.sellerId)throw httpError(403,'You can only view documents for your own packages.');
  }
  return sub;
}

async function receiptScope(req) {
  const db=mongoose.connection.db;
  const {id}=req.params;
  if(!packageReceiptPath(id))throw httpError(400,'Invalid package link.');
  const user=req.user?.role==='customer'?req.user:null;
  const code=req.headers['x-order-access-token'];
  const denied=()=>httpError(403,'Sign in with the account that placed the order or enter its private access code.');
  if(!user && !/^[A-Za-z0-9_-]{43}$/.test(typeof code==='string'?code:''))throw denied();
  const sub=await db.collection('suborders').findOne(idFilter(id),{maxTimeMS:3000});
  const order=sub && await db.collection('orders').findOne(idFilter(sub.parentOrderId),{maxTimeMS:3000});
  if(!order)throw denied();
  try { assertOrderAccess(order,user,code); } catch { throw denied(); }
  return {order,subs:[sub],documentScope:{packageId:String(sub._id),kinds:['invoice','receipt']}};
}

async function scope(req,mode) {
  if(mode==='receipt')return receiptScope(req);
  const db=mongoose.connection.db;const id=req.params.id;
  if(!id || id.length>128)throw httpError(400,'Invalid order ID.');
  let order,subs,documentScope;
  if(mode==='seller'){
    const sub=await sellerPackage(req);
    documentScope={packageId:String(sub._id)};
    subs=[sub];order=await db.collection('orders').findOne(idFilter(sub.parentOrderId),{maxTimeMS:3000});
  }else{
    order=await db.collection('orders').findOne({$or:[idFilter(id),{orderNumber:id}]},{maxTimeMS:3000});
    if(order && !isOwner(req.user))assertOrderAccess(order,req.user,req.headers['x-order-access-token']);
    if(order)subs=await db.collection('suborders').find({parentOrderId:String(order._id)},{maxTimeMS:3000}).limit(100).toArray();
  }
  if(!order)throw httpError(404,'Order not found.');
  return {order,subs,documentScope};
}
const deliver=(mode='order')=>async(req,res)=>{
  const {order,subs,documentScope}=await scope(req,mode);
  if(!req.params.documentId){
    const documents=await documentBundle(order,subs,documentScope);
    return res.json(mode==='receipt' ? {documents,packageNumber:subs[0].subOrderNumber} : {documents});
  }
  const doc=await readDocument(order,subs,req.params.documentId,documentScope);
  const orderUrl = mode==='order' && isOwner(req.user) && ['summary','receipt'].includes(doc.kind)
    ? adminOrderUrl(String(order._id)) : null;
  if(req.query.format===undefined) {
    const adminQr = orderUrl ? await orderQr(orderUrl, 'data-url') : null;
    return res.json({document:doc,...(adminQr ? {adminQr} : {})});
  }
  if(req.query.format!=='pdf')throw httpError(400,'Unsupported document format.');
  const {documentPdf}=await import('../services/documentPdf.js');
  const pdf=await documentPdf(doc, {orderUrl});
  sendPdf(res,pdf,doc.number);
};
function sendPdf(res,pdf,name){
  res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${name.replace(/[^A-Za-z0-9_-]/g,'_')}.pdf"`});
  res.send(pdf);
}
router.get('/orders/:id',optionalAuthenticate,documentLimit,deliver());
router.get('/orders/:id/:documentId',optionalAuthenticate,documentLimit,deliver());
router.get('/package-receipts/:id',optionalAuthenticate,documentLimit,deliver('receipt'));
router.get('/package-receipts/:id/:documentId',optionalAuthenticate,documentLimit,deliver('receipt'));
router.get('/packages/:id',authenticate,requireRole('seller','admin'),documentLimit,deliver('seller'));
router.get('/packages/:id/receipt-label',authenticate,requireRole('seller','admin'),documentLimit,async(req,res)=>{
  const sub=await sellerPackage(req);
  const url=packageReceiptUrl(String(sub._id));
  if(!url)throw httpError(503,'Receipt labels are unavailable for this deployment.');
  const {packageReceiptLabelPdf}=await import('../services/documentPdf.js');
  sendPdf(res,await packageReceiptLabelPdf(sub.subOrderNumber,url),`${sub.subOrderNumber}-RECEIPT-LABEL`);
});
router.get('/packages/:id/:documentId',authenticate,requireRole('seller','admin'),documentLimit,deliver('seller'));
router.get('/email-status',authenticate,requireRole('admin'),documentLimit,async(_req,res)=>{
  const counts=await mongoose.connection.db.collection('orderemailjobs').aggregate([{$group:{_id:'$status',count:{$sum:1}}}],{maxTimeMS:3000}).toArray();
  const {ready,enabled}=emailConfiguration();res.json({ready,enabled,counts:Object.fromEntries(counts.map(x=>[x._id,x.count]))});
});
router.post('/retry-emails',authenticate,requireRole('admin'),documentLimit,sharedRateLimit('email-admin-retry',5,60000,req=>req.user._id),async(_req,res)=>res.json(await processOrderEmails()));
router.post('/email-worker',documentLimit,async(req,res)=>{
  const secret=process.env.ORDER_EMAIL_WORKER_SECRET,provided=req.headers.authorization || '';
  if(!secret || secret.length<32 || !timingSafeEqual(createHash('sha256').update(provided).digest(),createHash('sha256').update(`Bearer ${secret}`).digest()))throw httpError(401,'Worker authentication required.');
  res.json(await processOrderEmails());
});
export default router;
