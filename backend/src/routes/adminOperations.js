import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { hasAdminPermission, isOwner } from '../../../shared/adminAccess.js';
import { adminOrderPath } from '../../../shared/adminOrderPath.js';
import { stringField } from '../config/inputValidation.js';
import { httpError } from '../config/errors.js';
import { idFilter, getStore, persistStore, withTransaction } from '../config/db.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';
import { documentLimit, sharedRateLimit } from '../middleware/sharedRateLimit.js';
import { recordSecurityEvent } from '../config/securityEvents.js';
import { operationsProductFields as productFields, operationsProductRevision } from '../services/operationsProducts.js';
const sellerFields={_id:1,storeName:1,sellerType:1,description:1,contactEmail:1,contactPhone:1,district:1,city:1,status:1,createdAt:1};
const orderFields={_id:1,orderNumber:1,customerEmail:1,customerPhone:1,shippingAddress:1,overallStatus:1,createdAt:1};
export function mountAdminOperations(router){
 router.get('/orders/:id',documentLimit,async(req,res)=>{
  const { id }=req.params;
  if(!adminOrderPath(id))throw httpError(400,'Invalid order ID.');
  const db=mongoose.connection.db;
  const order=await db.collection('orders').findOne(idFilter(id),{projection:{
    ...orderFields,paymentMethod:1,itemsSubtotalLkr:1,totalDeliveryFeeLkr:1,grandTotalLkr:1
  },maxTimeMS:3000});
  if(!order)throw httpError(404,'Order not found.');
  const packages=await db.collection('suborders').find({parentOrderId:String(order._id)},{projection:{
    subOrderNumber:1,sellerName:1,fulfillmentStatus:1,courierPartner:1,trackingCode:1,
    'items.title':1,'items.variantLabel':1,'items.quantity':1,'items.lineTotalLkr':1
  },maxTimeMS:3000}).limit(50).toArray();
  await recordSecurityEvent('admin_order_view',{userId:req.user._id,role:'admin',ip:req.ip});
  res.set({'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});
  res.json({order,packages});
 });
 router.get('/operations',async(req,res)=>{
  const module=stringField(req.query.module,'Module',{required:true,maximum:30});
  if(!hasAdminPermission(req.user,module))throw httpError(403,'Module access is not assigned.');
  const db=mongoose.connection.db;
  if(module==='merchandising'){
    const config=await db.collection('platformconfigs').findOne({key:'main_config'},{projection:{banners:1},maxTimeMS:3000});
    const categories=await db.collection('categories').find({},{maxTimeMS:3000}).limit(100).toArray();
    return res.json({banners:config?.banners||[],categories});
  }
  if(module==='reports'){
    const counts=await db.collection('suborders').aggregate([{$group:{_id:'$fulfillmentStatus',count:{$sum:1}}}],{maxTimeMS:3000}).toArray();
    return res.json({counts});
  }
  const specs={products:['products',productFields,{}],sellers:['sellers',sellerFields,{}],orders:['orders',orderFields,{}],audit:['securityevents',{_id:1,event:1,outcome:1,createdAt:1,method:1,path:1},{userId:String(req.user._id)}]};
  const spec=specs[module];if(!spec)throw httpError(400,'Unknown module.');
  const after=stringField(req.query.after,'Cursor',{maximum:128});
  const search=stringField(req.query.q,'Search',{maximum:120});
  let cursorFilter={};
  if(after){
    const cursor=await db.collection(spec[0]).findOne({...spec[2],...idFilter(after)},{projection:{_id:1},maxTimeMS:2000});
    if(!cursor)throw httpError(404,'Cursor not found.');
    cursorFilter=typeof cursor._id==='string'?{$or:[{_id:{$gt:cursor._id}},{_id:{$type:'objectId'}}]}:{_id:{$gt:cursor._id}};
  }
  const query={...spec[2],...cursorFilter};
  // Exact identifiers keep support lookups indexed and avoid arbitrary regex scans.
  if(search){if(module==='orders')query.orderNumber=search;else if(module==='products')query.sku=search;else throw httpError(400,'Search is available by order number or product SKU.');}
  const rows=await db.collection(spec[0]).find(query,{projection:spec[1],maxTimeMS:3000}).sort({_id:1}).limit(26).toArray();
  res.json({rows:rows.slice(0,25).map(row=>module==='products'?{...row,revision:operationsProductRevision(row)}:row),nextCursor:rows.length>25?String(rows[24]._id):null});
 });
 router.get('/operation-requests',async(req,res)=>{
  const after=stringField(req.query.after,'Cursor',{maximum:128});
  const rows=await mongoose.connection.db.collection('operationrequests').find({...(!isOwner(req.user)?{actorId:String(req.user._id)}:{}),...(after?{_id:{$gt:after}}:{})},{maxTimeMS:3000}).sort({_id:1}).limit(26).toArray();
  res.json({rows:rows.slice(0,25),nextCursor:rows.length>25?rows[24]._id:null});
 });
 router.post('/operation-requests',sharedRateLimit('operations-requests',20,60000,req=>req.user._id),async(req,res)=>{
  const orderNumber=stringField(req.body.orderNumber,'Order number',{required:true,maximum:128});
  const reason=stringField(req.body.reason,'Reason',{required:true,maximum:1000});
  if(!['cancellation','return','refund','delivery_issue'].includes(req.body.kind))throw httpError(400,'Invalid support request type.');
  const order=await mongoose.connection.db.collection('orders').findOne({orderNumber},{projection:{_id:1},maxTimeMS:3000});
  if(!order)throw httpError(404,'Order not found.');
  const row={_id:randomUUID(),actorId:String(req.user._id),orderNumber,kind:req.body.kind,reason,status:'pending',createdAt:new Date()};
  await mongoose.connection.db.collection('operationrequests').insertOne(row,{maxTimeMS:3000});
  res.status(201).json({request:row,message:'Request submitted for owner review. No order status or money movement has been executed.'});
 });
 router.patch('/operation-requests/:id',async(req,res)=>{
  if(!isOwner(req.user))throw httpError(403,'Owner review required.');
  const note=stringField(req.body.note,'Review note',{required:true,maximum:1000});
  if(!['reviewed','rejected'].includes(req.body.status))throw httpError(400,'Invalid review status.');
  await withTransaction(async session=>{
  const store=await getStore({platformConfig:true},{session});
  const result=await mongoose.connection.db.collection('operationrequests').updateOne({_id:stringField(req.params.id,'Request ID',{required:true,maximum:128}),status:'pending'},{$set:{status:req.body.status,note,reviewerId:String(req.user._id),reviewedAt:new Date()}},{maxTimeMS:3000,session});
  if(!result.matchedCount)throw httpError(409,'Request is no longer pending.');
  recordAdminAuditLog(store,{action:'operation_request_reviewed',adminId:req.user._id,adminEmail:req.user.email,metadata:{requestId:req.params.id,status:req.body.status}});await persistStore(store);
  });
  res.json({message:'Review recorded. Any financial or fulfillment action must be completed through its existing protected workflow.'});
 });
}
