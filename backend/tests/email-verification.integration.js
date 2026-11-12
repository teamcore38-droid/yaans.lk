import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD } from '../../tests/support/fixtures.js';
import { captureBackup } from '../src/config/backupRepository.js';
import { flushSecurityEmailNotices, sendSecurityEmail } from '../src/services/securityEmail.js';

test('email ownership and identity changes with disposable MongoDB', {timeout:600000},async t=>{
  const app=await startIsolatedApp();t.after(()=>app.close());
  async function request(route,{method='GET',token,body}={}){
    const r=await fetch(app.url+'/api'+route,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,headers:r.headers,data:await r.json()};
  }
  const post=(route,body,token)=>request(route,{method:'POST',body,token});
  async function login(kind='customer'){
    const r=await post(kind==='admin'?'/auth/admin/login':'/auth/login',{email:accounts[kind],password:TEST_PASSWORD});
    assert.equal(r.status,200);return r.data.token;
  }
  const payload={name:'New owner',email:'new@test.invalid',phone:'0771234567',password:TEST_PASSWORD};
  const tokenFrom=email=>app.mailbox.findLast(message=>message.to===email&&message.text.includes('#token=')).text.match(/#token=([\w-]+)/)[1];
  const confirm=(verificationToken,password=TEST_PASSWORD)=>post('/auth/verify-email',{verificationToken,password});
  const change=(token,newEmail='changed@test.invalid')=>request('/auth/update-credentials',{method:'PUT',token,body:{currentPassword:TEST_PASSWORD,newEmail}});
  async function scenario(name,work){await t.test(name,async()=>{await app.reset();app.setEmailTransport(async message=>{app.mailbox.push(message);return {id:'test-email'};});await work();});}

  await scenario('registration sends a private expiring link and creates no session or account before proof',async()=>{
    const result=await post('/auth/register-customer',{...payload,role:'admin',emailVerifiedAt:new Date().toISOString()});
    assert.equal(result.status,202);assert.equal(result.data.requiresEmailVerification,true);assert.equal(result.data.token,undefined);assert.equal(result.data.user,undefined);assert.equal(result.headers.get('set-cookie'),null);
    assert.equal(await app.mongo.collection('users').countDocuments({email:payload.email}),0);
    const token=tokenFrom(payload.email);const doc=await app.mongo.collection('emailchallenges').findOne({email:payload.email});
    assert.equal(doc._id,createHash('sha256').update(token).digest('hex'));assert.ok(!JSON.stringify(doc).includes(token));assert.equal(doc.user.role,'customer');
    assert.match(app.mailbox.at(-1).text,/http:\/\/127\.0\.0\.1:4173\/verify-email#token=/);
    assert.equal((await post('/auth/login',{email:payload.email,password:TEST_PASSWORD})).status,401);
    assert.equal((await confirm(token,'wrong password')).status,401);assert.equal(await app.mongo.collection('users').countDocuments({email:payload.email}),0);
    const completed=await confirm(token);assert.equal(completed.status,200);assert.equal(completed.data.token,undefined);assert.equal(completed.headers.get('set-cookie'),null);
    const signed=await post('/auth/login',{email:payload.email,password:TEST_PASSWORD});assert.equal(signed.status,200);assert.equal(signed.data.user.emailVerified,true);assert.equal(signed.data.user.role,'customer');
    assert.equal((await confirm(token)).status,400);
  });
  await scenario('seller and account are created atomically only after email confirmation',async()=>{
    const result=await post('/auth/register-seller',{...payload,storeName:'New Pantry',city:'Kandy',district:'Kandy',nicOrBrNumber:'synthetic-business'});
    assert.equal(result.status,202);assert.equal(await app.mongo.collection('sellers').countDocuments({contactEmail:payload.email}),0);
    assert.equal((await confirm(tokenFrom(payload.email))).status,200);
    const seller=await app.mongo.collection('sellers').findOne({contactEmail:payload.email});const user=await app.mongo.collection('users').findOne({email:payload.email});
    assert.equal(seller.status,'pending');assert.equal(seller.userId,user._id);assert.equal(user.sellerId,seller._id);assert.equal(user.role,'seller');
  });
  await scenario('expired and malformed tokens cannot confirm and GET never changes the account',async()=>{
    await post('/auth/register-customer',payload);const token=tokenFrom(payload.email);
    await app.mongo.collection('emailchallenges').updateMany({},{ $set:{expiresAt:new Date(0)}});
    assert.equal((await confirm(token)).status,400);assert.equal((await confirm({$ne:null})).status,400);
    const r=await fetch(app.url+'/api/auth/verify-email?verificationToken='+token);assert.equal(r.status,404);
    assert.equal(await app.mongo.collection('users').countDocuments({email:payload.email}),0);
  });
  await scenario('simultaneous confirmations create at most one account',async()=>{
    await post('/auth/register-customer',payload);const token=tokenFrom(payload.email);
    const results=await Promise.all([confirm(token),confirm(token)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    assert.equal(await app.mongo.collection('users').countDocuments({email:payload.email}),1);
  });
  await scenario('a competing pending registration cannot reserve an email or overwrite a confirmed account',async()=>{
    await post('/auth/register-customer',payload);const first=tokenFrom(payload.email);
    await post('/auth/register-customer',{...payload,password:'Different passphrase 2026!'});const second=tokenFrom(payload.email);
    assert.equal((await confirm(first,'Different passphrase 2026!')).status,401);
    assert.equal((await confirm(second,'Different passphrase 2026!')).status,200);
    assert.equal((await confirm(first)).status,409);
    assert.equal((await post('/auth/login',{email:payload.email,password:TEST_PASSWORD})).status,401);
  });
  await scenario('provider failure never reports success or creates an account',async()=>{
    app.setEmailTransport(async()=>{throw Object.assign(new Error('Email temporarily unavailable'),{status:503});});
    assert.equal((await post('/auth/register-customer',payload)).status,503);
    assert.equal(await app.mongo.collection('users').countDocuments({email:payload.email}),0);assert.equal(await app.mongo.collection('emailchallenges').countDocuments({}),0);
  });
  await scenario('verification requests require authentication and the current password; legacy users retain access',async()=>{
    assert.equal((await post('/auth/email-verification',{currentPassword:TEST_PASSWORD})).status,401);
    const token=await login();const before=await request('/auth/me',{token});assert.equal(before.data.user.emailVerified,false);
    assert.equal((await post('/auth/email-verification',{currentPassword:'wrong'},token)).status,401);
    assert.equal((await post('/auth/email-verification',{currentPassword:TEST_PASSWORD},token)).status,200);
    assert.equal((await confirm(tokenFrom(accounts.customer))).status,200);
    assert.equal((await request('/auth/me',{token})).data.user.emailVerified,true);
  });
  await scenario('login email stays unchanged until proof, then all earlier sessions are revoked and both notices sent',async()=>{
    const token=await login();const otherSession=await login();
    const started=await change(token);assert.equal(started.status,200);assert.equal(started.data.requiresEmailVerification,true);
    assert.equal(started.data.user.email,accounts.customer);assert.equal(started.data.user.pendingEmail,'changed@test.invalid');
    assert.equal(started.data.user.pendingEmailChallengeId,undefined);assert.equal((await request('/auth/me',{token})).status,200);
    assert.equal(app.mailbox.filter(m=>m.to===accounts.customer).length,1);
    const result=await confirm(tokenFrom('changed@test.invalid'));assert.equal(result.status,200);assert.equal(result.data.emailChanged,true);assert.equal(result.data.token,undefined);
    assert.equal((await request('/auth/me',{token})).status,401);assert.equal((await request('/auth/me',{token:otherSession})).status,401);
    const signed=await post('/auth/login',{email:'changed@test.invalid',password:TEST_PASSWORD});assert.equal(signed.status,200);assert.equal(signed.data.user.emailVerified,true);assert.equal(signed.data.user.pendingEmail,null);
    assert.equal(app.mailbox.filter(m=>m.to===accounts.customer).length,2);
  });
  await scenario('superseded change links and links issued before a password reset are rejected',async()=>{
    const token=await login();await change(token);const old=tokenFrom('changed@test.invalid');await change(token,'newer@test.invalid');
    assert.equal((await confirm(old)).status,400);
    const latest=tokenFrom('newer@test.invalid');assert.equal((await request('/auth/update-credentials',{method:'PUT',token,body:{currentPassword:TEST_PASSWORD,newPassword:'A new password for 2026!'}})).status,200);
    assert.equal((await confirm(latest)).status,400);assert.equal((await app.mongo.collection('users').findOne({email:accounts.customer})).pendingEmail,undefined);
  });
  await scenario('a newly claimed target email rolls back the change and does not revoke the original login',async()=>{
    const token=await login();await change(token);const link=tokenFrom('changed@test.invalid');
    await app.mongo.collection('users').insertOne({_id:'competing-owner',email:'changed@test.invalid'});
    assert.equal((await confirm(link)).status,409);assert.equal((await request('/auth/me',{token})).status,200);
    assert.equal((await app.mongo.collection('users').findOne({_id:'usr_test_customer'})).email,accounts.customer);
  });
  await scenario('seller contact email follows a verified identity change',async()=>{
    const token=await login('seller');await change(token);assert.equal((await confirm(tokenFrom('changed@test.invalid'))).status,200);
    const owner=await app.mongo.collection('users').findOne({email:'changed@test.invalid'});
    assert.equal((await app.mongo.collection('sellers').findOne({_id:owner.sellerId})).contactEmail,owner.email);
  });
  await scenario('administrator confirmation does not issue a session or remove the authenticator',async()=>{
    const token=await login('admin');await change(token);const link=tokenFrom('changed@test.invalid');
    // Enabling MFA also invalidates sessions in real enrollment; preserve this challenge version here to test confirmation itself.
    await app.mongo.collection('users').updateOne({email:accounts.admin},{$set:{adminMfa:{enabled:true}}});
    const completed=await confirm(link);assert.equal(completed.status,200);assert.equal(completed.data.token,undefined);
    const signed=await post('/auth/admin/login',{email:'changed@test.invalid',password:TEST_PASSWORD});assert.equal(signed.data.requiresMfa,true);assert.equal(signed.data.token,undefined);
  });
  await scenario('notification failures remain durable, alert monitoring and can be retried without changing identity',async()=>{
    const token=await login();
    app.setEmailTransport(async message=>{if(!message.text.includes('#token='))throw new Error('Synthetic provider failure');app.mailbox.push(message);return {id:'test'};});
    assert.equal((await change(token)).status,200);
    const notice=await app.mongo.collection('securityemailoutbox').findOne({sentAt:{$exists:false}});assert.ok(notice);assert.equal(notice.attempts,1);
    assert.ok(!notice.text.includes('#token='));
    await app.mongo.collection('securityemailoutbox').updateMany({},{$set:{nextAttemptAt:new Date(0),createdAt:new Date(Date.now()-20*60000)}});
    const {operationalStatus}=await import('../src/config/operations.js');assert.ok((await operationalStatus()).alerts.includes('security_email_delivery'));
    app.setEmailTransport(async message=>{app.mailbox.push(message);return {id:'test-retry'};});
    process.env.MAINTENANCE_READ_ONLY='true';
    try { assert.equal((await flushSecurityEmailNotices()).sent,0);assert.equal((await app.mongo.collection('securityemailoutbox').findOne({_id:notice._id})).attempts,1); }
    finally { process.env.MAINTENANCE_READ_ONLY=''; }
    assert.equal((await flushSecurityEmailNotices()).sent,1);assert.ok(!(await operationalStatus()).alerts.includes('security_email_delivery'));
    const sent=await app.mongo.collection('securityemailoutbox').findOne({_id:notice._id});assert.ok(sent.sentAt);assert.equal(sent.to,undefined);assert.equal(sent.text,undefined);
  });
  await scenario('recipient limits restrict resend abuse and challenges are excluded from backups',async()=>{
    for(let i=0;i<3;i++)assert.equal((await post('/auth/register-customer',{...payload,newEmail:`unrelated-${i}@test.invalid`})).status,202);
    const denied=await post('/auth/register-customer',{...payload,newEmail:'unrelated-extra@test.invalid'});assert.equal(denied.status,429);assert.ok(Number(denied.headers.get('retry-after'))>0);assert.equal(app.mailbox.length,3);
    const backup=await captureBackup(app.mongo);assert.equal(backup.data.emailchallenges,undefined);assert.ok(Array.isArray(backup.data.securityemailoutbox));
  });
  await scenario('real transport uses the fixed Resend endpoint, limits staging recipients and fails closed on provider errors',async()=>{
    const previous=Object.fromEntries(['NODE_ENV','APP_ENV','RESEND_API_KEY','RESEND_EMAIL_DOMAIN','EMAIL_ALLOWED_RECIPIENTS'].map(key=>[key,process.env[key]]));
    const originalFetch=globalThis.fetch;const calls=[];
    try{
      Object.assign(process.env,{NODE_ENV:'production',APP_ENV:'staging',RESEND_API_KEY:'synthetic-test-key',RESEND_EMAIL_DOMAIN:'notify.yaans.lk',EMAIL_ALLOWED_RECIPIENTS:'approved@test.invalid'});
      globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:'synthetic-provider-receipt'})};};
      await assert.rejects(sendSecurityEmail({to:'unapproved@test.invalid',subject:'Test',text:'Test',idempotencyKey:'transport-test'}),error=>error.status===503);assert.equal(calls.length,0);
      const result=await sendSecurityEmail({to:'approved@test.invalid',subject:'Test',text:'Safe message',idempotencyKey:'transport-test'});
      assert.equal(result.id,'synthetic-provider-receipt');assert.equal(calls[0].url,'https://api.resend.com/emails');assert.equal(calls[0].options.redirect,'error');
      const body=JSON.parse(calls[0].options.body);assert.deepEqual(body.to,['approved@test.invalid']);assert.equal(body.from,'Yaans.lk Security <security@notify.yaans.lk>');assert.equal(body.reply_to,'yaanslk5@gmail.com');assert.equal(calls[0].options.headers['Idempotency-Key'],'transport-test');
      globalThis.fetch=async()=>({ok:false,status:429});
      await assert.rejects(sendSecurityEmail({to:'approved@test.invalid',subject:'Test',text:'Safe message',idempotencyKey:'provider-failure'}),error=>error.status===503&&!error.message.includes('synthetic-test-key'));
    }finally{globalThis.fetch=originalFetch;for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
  });
});
