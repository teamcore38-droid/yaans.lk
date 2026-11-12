import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';

export async function recordSecurityEvent(event, { userId, role, ip, identity, outcome = 'success' } = {}) {
  const safe={ event:String(event).slice(0,80), outcome, ...(userId?{userId:String(userId).slice(0,128)}:{}), ...(role?{role:String(role).slice(0,20)}:{}) };
  console.log('[Yaans security]',safe);
  if(mongoose.connection.readyState!==1)return;
  const secret=process.env.JWT_SECRET;
  const digest=value=>secret&&value?createHmac('sha256',secret).update(String(value).slice(0,512)).digest('hex'):undefined;
  try { await mongoose.connection.db.collection('securityevents').insertOne({...safe,ipDigest:digest(ip),identityDigest:digest(identity),createdAt:new Date(),expiresAt:new Date(Date.now()+30*86400000)},{maxTimeMS:1000}); }
  catch { console.error('[Yaans security]',{event:'security_event_write_failed',originalEvent:safe.event}); }
}
