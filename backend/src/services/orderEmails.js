import { waitUntil } from '@vercel/functions';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { getJwtSecret } from '../middleware/auth.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = () => createHash('sha256').update(`order-email-capability-v1:${getJwtSecret()}`).digest();
export function encryptEmailAccess(token) {
  if (!token) return null;
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key(),iv);
  const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');
}
function decryptAccess(value) {
  if(!value)return '';
  const data=Buffer.from(value,'base64url'), cipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));
  cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');
}
export function emailConfiguration() {
  const domain=process.env.RESEND_EMAIL_DOMAIN || '';
  const from=process.env.ORDER_EMAIL_FROM || (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)?`orders@${domain}`:'');
  const enabled=process.env.ORDER_EMAIL_ENABLED==='true' && process.env.APP_ENV!=='staging' && process.env.MAINTENANCE_READ_ONLY!=='true';
  return {ready:enabled && Boolean(process.env.RESEND_API_KEY) && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from),enabled,from};
}
export function confirmationEmail(doc, trackingUrl) {
  const amount=n=>`LKR ${Number(n).toFixed(2)}`;
  const lines=doc.items.map(i=>`${i.sellerName}: ${i.title} (${i.variantLabel || 'Standard'}) × ${i.quantity} — ${amount(i.lineTotalLkr)}`);
  const text=[`Thank you for your order ${doc.orderNumber}.`,'Payment pending — pay on delivery.',...lines,`Items: ${amount(doc.subtotalLkr)}`,`Delivery: ${amount(doc.deliveryLkr)}`,`Total: ${amount(doc.totalLkr)}`,`Track your order and view your documents: ${trackingUrl}`].join('\n');
  return {subject:`Yaans.lk order ${doc.orderNumber} confirmed`,text,html:`<h1>Order ${escape(doc.orderNumber)} confirmed</h1><p>Payment pending — pay on delivery.</p><ul>${lines.map(line=>`<li>${escape(line)}</li>`).join('')}</ul><p>Items: ${escape(amount(doc.subtotalLkr))}<br>Delivery: ${escape(amount(doc.deliveryLkr))}<br><strong>Total: ${escape(amount(doc.totalLkr))}</strong></p><p><a href="${escape(trackingUrl)}">Track order and view documents</a></p>`};
}

export async function processOrderEmails({limit=5,fetchImpl=fetch,now=()=>new Date()}={}) {
  const config=emailConfiguration();if(!config.ready)return {processed:0,configurationRequired:true};
  const db=mongoose.connection.db, jobs=db.collection('orderemailjobs');let processed=0;
  for(let i=0;i<Math.min(Math.max(limit,1),10);i++) {
    const time=now(), lease=randomUUID();
    const job=await jobs.findOneAndUpdate({status:{$in:['pending','processing']},nextAttemptAt:{$lte:time},leaseUntil:{$lte:time}},{$set:{status:'processing',lease,leaseUntil:new Date(time.getTime()+120000)},$inc:{attempts:1}},{sort:{nextAttemptAt:1},returnDocument:'after',maxTimeMS:3000});
    if(!job)break;
    const filter={_id:job._id,lease};
    const first=job.firstAttemptAt || time;
    if(time.getTime()-new Date(first).getTime()>20*3600000 || job.attempts>6){await jobs.updateOne(filter,{$set:{status:'attention',lastError:'RETRY_WINDOW_EXPIRED'},$unset:{encryptedAccess:1,encryptedPayload:1}});continue;}
    try {
      // Reserve each logical email once against conservative free-plan budgets.
      if(!job.budgetReserved) {
        const session=await mongoose.connection.startSession();let reserved=false;
        try {await session.withTransaction(async()=>{
          const period=[['day',time.toISOString().slice(0,10),95],['month',time.toISOString().slice(0,7),2900]];
          for(const [kind,date,cap] of period){const bucket=await db.collection('orderemailbudgets').findOne({_id:`${kind}:${date}`},{session});if((bucket?.count||0)>=cap)return;}
          for(const [kind,date] of period)await db.collection('orderemailbudgets').updateOne({_id:`${kind}:${date}`},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(time.getTime()+62*86400000)}},{upsert:true,session});
          await jobs.updateOne(filter,{$set:{budgetReserved:true}},{session});reserved=true;
        });}finally{await session.endSession();}
        if(!reserved){await jobs.updateOne(filter,{$set:{status:'pending',leaseUntil:new Date(0),nextAttemptAt:new Date(time.getTime()+3600000),lastError:'FREE_PLAN_BUDGET'},$inc:{attempts:-1}});continue;}
      }
      const doc=await db.collection('orderdocuments').findOne({_id:`${job.orderId}:summary`});
      if(!doc)throw new Error('DOCUMENT_UNAVAILABLE');
      const sender=job.sender || config.from;
      await jobs.updateOne(filter,{$set:{firstAttemptAt:first,sender}});
      const token=decryptAccess(job.encryptedAccess);
      const tracking=`https://yaans.lk/track-order?orderNumber=${encodeURIComponent(doc.orderNumber)}${token?`#access=${encodeURIComponent(token)}`:''}`;
      const payload=job.encryptedPayload ? JSON.parse(decryptAccess(job.encryptedPayload)) : {from:`Yaans.lk <${sender}>`,to:[job.to],...confirmationEmail(doc,tracking)};
      if (!job.encryptedPayload) await jobs.updateOne(filter,{$set:{encryptedPayload:encryptEmailAccess(JSON.stringify(payload))}});
      const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`order-confirmation/${job.orderId}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000),redirect:'error'});
      if(!response.ok){const permanent=response.status>=400 && response.status<500 && ![408,429].includes(response.status);await jobs.updateOne(filter,{$set:{status:permanent?'attention':'pending',lastError:`PROVIDER_HTTP_${response.status}`,nextAttemptAt:new Date(time.getTime()+Math.min(3600000,60000*2**job.attempts)),leaseUntil:new Date(0)},...(permanent?{$unset:{encryptedAccess:1,encryptedPayload:1}}:{})});continue;}
      const result=await response.json();if(typeof result.id!=='string')throw new Error('PROVIDER_RESPONSE');
      await jobs.updateOne(filter,{$set:{status:'sent',providerId:result.id,sentAt:now()},$unset:{encryptedAccess:1,lastError:1}});processed++;
    }catch{await jobs.updateOne(filter,{$set:{status:'pending',lastError:'DELIVERY_RETRY',nextAttemptAt:new Date(time.getTime()+Math.min(3600000,60000*2**job.attempts)),leaseUntil:new Date(0)}});}
  }
  return {processed,configurationRequired:false};
}
export function scheduleOrderEmails() {
  if(!emailConfiguration().ready || process.env.NODE_ENV==='test')return;
  // Supported serverless lifetime extension; the outbox survives a terminated invocation.
  waitUntil(processOrderEmails({limit:2}).catch(()=>console.error('[Yaans email]',{event:'worker_failed'})));
}
