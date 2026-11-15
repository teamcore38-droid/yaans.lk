import mongoose from 'mongoose';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createRouter} from '../config/router.js';
import {idFilter} from '../config/db.js';
import {httpError} from '../config/errors.js';
import {authenticate,optionalAuthenticate,requireRole} from '../middleware/auth.js';
import {sharedRateLimit} from '../middleware/sharedRateLimit.js';
import {assertOrderAccess} from '../services/orders.js';
import {documentBundle,readDocument} from '../services/orderDocuments.js';
import {emailConfiguration,processOrderEmails} from '../services/orderEmails.js';

const router=createRouter();
router.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});next();});
router.use(sharedRateLimit('order-documents',60,60000,req=>req.ip));
async function scope(req,sellerOnly=false) {
  const db=mongoose.connection.db;const id=req.params.id;
  if(!id || id.length>128)throw httpError(400,'Invalid order ID.');
  let order,subs,sellerId=null;
  if(sellerOnly){
    const sub=await db.collection('suborders').findOne(idFilter(id),{maxTimeMS:3000});
    if(!sub)throw httpError(404,'Package not found.');
    if(req.user.role!=='admin'){
      const seller=await db.collection('sellers').findOne({$or:[{_id:req.user.sellerId || null},{userId:req.user._id}]},{maxTimeMS:3000});
      if(!seller || String(seller._id)!==sub.sellerId)throw httpError(403,'You can only view documents for your own packages.');
    }
    sellerId=sub.sellerId;subs=[sub];order=await db.collection('orders').findOne(idFilter(sub.parentOrderId),{maxTimeMS:3000});
  }else{
    order=await db.collection('orders').findOne({$or:[idFilter(id),{orderNumber:id}]},{maxTimeMS:3000});
    if(order && req.user?.role!=='admin')assertOrderAccess(order,req.user,req.headers['x-order-access-token']);
    if(order)subs=await db.collection('suborders').find({parentOrderId:String(order._id)},{maxTimeMS:3000}).limit(100).toArray();
  }
  if(!order)throw httpError(404,'Order not found.');
  return {order,subs,sellerId};
}
const deliver=(sellerOnly=false)=>async(req,res)=>{
  const {order,subs,sellerId}=await scope(req,sellerOnly);
  if(!req.params.documentId)return res.json({documents:await documentBundle(order,subs,sellerId)});
  const doc=await readDocument(order,subs,req.params.documentId,sellerId);
  if(req.query.format===undefined)return res.json({document:doc});
  if(req.query.format!=='pdf')throw httpError(400,'Unsupported document format.');
  const {documentPdf}=await import('../services/documentPdf.js');
  const pdf=await documentPdf(doc);
  res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${doc.number.replace(/[^A-Za-z0-9_-]/g,'_')}.pdf"`});res.send(pdf);
};
router.get('/orders/:id',optionalAuthenticate,deliver());
router.get('/orders/:id/:documentId',optionalAuthenticate,deliver());
router.get('/packages/:id',authenticate,requireRole('seller','admin'),deliver(true));
router.get('/packages/:id/:documentId',authenticate,requireRole('seller','admin'),deliver(true));
router.get('/email-status',authenticate,requireRole('admin'),async(_req,res)=>{
  const counts=await mongoose.connection.db.collection('orderemailjobs').aggregate([{$group:{_id:'$status',count:{$sum:1}}}],{maxTimeMS:3000}).toArray();
  const {ready,enabled}=emailConfiguration();res.json({ready,enabled,counts:Object.fromEntries(counts.map(x=>[x._id,x.count]))});
});
router.post('/retry-emails',authenticate,requireRole('admin'),sharedRateLimit('email-admin-retry',5,60000,req=>req.user._id),async(_req,res)=>res.json(await processOrderEmails()));
router.post('/email-worker',async(req,res)=>{
  const secret=process.env.ORDER_EMAIL_WORKER_SECRET,provided=req.headers.authorization || '';
  if(!secret || secret.length<32 || !timingSafeEqual(createHash('sha256').update(provided).digest(),createHash('sha256').update(`Bearer ${secret}`).digest()))throw httpError(401,'Worker authentication required.');
  res.json(await processOrderEmails());
});
export default router;
