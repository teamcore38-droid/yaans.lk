import * as OTPAuth from 'otpauth';
import jwt from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { getJwtSecret, credentialsRevoked } from '../middleware/auth.js';
import { getStore, persistStore, idFilter, withTransaction } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { consumeLimit } from '../middleware/sharedRateLimit.js';

function encryptionKey() {
  const value=process.env.MFA_ENCRYPTION_KEY || '';
  const key=Buffer.from(value,'base64');
  if(key.length!==32 || key.toString('base64')!==value)throw httpError(503,'Authenticator setup is not configured. Contact the site owner.');
  return key;
}
function encrypt(secret) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from('yaans-admin-mfa-v1'));
  const ciphertext=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return { iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), ciphertext:ciphertext.toString('base64') };
}
function decrypt(value) {
  const iv=Buffer.from(value.iv,'base64'),tag=Buffer.from(value.tag,'base64');
  if(iv.length!==12||tag.length!==16)throw httpError(503,'Authenticator configuration requires recovery.');
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv,{authTagLength:16});
  decipher.setAAD(Buffer.from('yaans-admin-mfa-v1'));decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext,'base64')),decipher.final()]).toString('utf8');
}
function authenticator(secret,email) { return new OTPAuth.TOTP({issuer:'Yaans.lk Admin',label:email,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)}); }
const digest=value=>createHash('sha256').update(value.toLowerCase().replace(/[ -]/g,'')).digest('hex');

export async function beginMfaEnrollment(user) {
  if(user.adminMfa?.enabled)throw httpError(409,'An authenticator is already enabled. Use your recovery procedure to replace it.');
  const secret=new OTPAuth.Secret({size:20});
  const store=await getStore({users:idFilter(user._id)});
  const current=store.users[0];
  if(!current||current.adminMfa?.enabled)throw httpError(409,'Authenticator state changed. Refresh and try again.');
  current.adminMfaPending={secret:encrypt(secret.base32),expiresAt:new Date(Date.now()+10*60000).toISOString()};
  await persistStore(store);
  return { secret:secret.base32, issuer:'Yaans.lk Admin', account:user.email, expiresInSeconds:600 };
}

export async function completeMfaEnrollment(user,code) {
  return withTransaction(async session=>{
    const store=await getStore({users:idFilter(user._id)},{session});const current=store.users[0];
    if(!current||current.adminMfa?.enabled||!current.adminMfaPending||new Date(current.adminMfaPending.expiresAt).getTime()<=Date.now())throw httpError(409,'Start authenticator setup again.');
    const secret=decrypt(current.adminMfaPending.secret),totp=authenticator(secret,current.email);
    const delta=typeof code==='string'&&/^\d{6}$/.test(code)?totp.validate({token:code,window:1}):null;
    if(delta===null)throw httpError(401,'The authenticator code is incorrect or expired.');
    const recoveryCodes=Array.from({length:8},()=>randomBytes(12).toString('hex').match(/.{1,6}/g).join('-'));
    current.adminMfa={enabled:true,secret:current.adminMfaPending.secret,lastStep:Math.floor(Date.now()/30000)+delta,
      recoveryHashes:recoveryCodes.map(digest),enabledAt:new Date().toISOString()};
    delete current.adminMfaPending;current.tokenVersion=(current.tokenVersion||0)+1;
    await persistStore(store);return {user:current,recoveryCodes};
  });
}

export function createMfaChallenge(user) {
  return jwt.sign({id:user._id,purpose:'admin-mfa',tokenVersion:user.tokenVersion||0,jti:randomUUID()},getJwtSecret(),
    {algorithm:'HS256',expiresIn:'5m',issuer:'yaans.lk',audience:'yaans-admin-mfa'});
}

export async function verifyMfaLogin(challenge,code) {
  let decoded;
  try { decoded=jwt.verify(challenge,getJwtSecret(),{algorithms:['HS256'],issuer:'yaans.lk',audience:'yaans-admin-mfa'}); }
  catch { throw httpError(401,'Sign in again to request a new authenticator challenge.'); }
  if(decoded.purpose!=='admin-mfa'||typeof decoded.id!=='string'||typeof decoded.jti!=='string')throw httpError(401,'Invalid authenticator challenge.');
  // A signed challenge identifies the account; changing IP or requesting another
  // challenge must not multiply the number of authenticator guesses.
  const limit=await consumeLimit('mfa-account',decoded.id,10,5*60000);
  if(!limit.allowed)throw httpError(429,'Too many authenticator attempts. Wait five minutes before trying again.');
  return withTransaction(async session=>{
    const store=await getStore({users:idFilter(decoded.id)},{session});const user=store.users[0];
    if(!user||user.role!=='admin'||!user.isActive||credentialsRevoked(user)||!user.adminMfa?.enabled||decoded.tokenVersion!==(user.tokenVersion||0))throw httpError(401,'Sign in again.');
    const used=mongoose.connection.db.collection('authchallenges');const key=digest(decoded.jti);
    if(await used.findOne({_id:key},{session}))throw httpError(401,'This authenticator challenge has already been used. Sign in again.');
    let valid=false;
    if(typeof code==='string'&&/^\d{6}$/.test(code)){
      const delta=authenticator(decrypt(user.adminMfa.secret),user.email).validate({token:code,window:1});
      const step=Math.floor(Date.now()/30000)+(delta??0);
      if(delta!==null&&step>user.adminMfa.lastStep){user.adminMfa.lastStep=step;valid=true;}
    } else if(typeof code==='string'&&/^[a-fA-F0-9 -]{24,32}$/.test(code)){
      const index=user.adminMfa.recoveryHashes.indexOf(digest(code));
      if(index>=0){user.adminMfa.recoveryHashes.splice(index,1);valid=true;}
    }
    if(!valid)throw httpError(401,'The authenticator or recovery code is incorrect, expired or already used.');
    await used.insertOne({_id:key,expiresAt:new Date(decoded.exp*1000)},{session});
    await persistStore(store);return user;
  });
}
