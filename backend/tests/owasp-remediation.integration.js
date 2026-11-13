import sharp from 'sharp';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';

test('OWASP remediation with actual HTTP routes and isolated MongoDB',{timeout:180000},async t=>{
  const app=await startIsolatedApp();t.after(()=>app.close());
  async function request(route,{method='GET',body,token,headers={},raw}={}){
    const response=await fetch(app.url+'/api'+route,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} : {}),...headers},body:raw??(body!==undefined?JSON.stringify(body):undefined)});
    const data=await response.json();return {status:response.status,data,headers:response.headers};
  }
  async function login(role='customer'){
    const result=await request(role==='admin'?'/auth/admin/login':'/auth/login',{method:'POST',body:{email:accounts[role],password:TEST_PASSWORD}});
    assert.equal(result.status,200);assert.ok(result.data.token);return result.data.token;
  }
  async function scenario(name,work){await t.test(name,async()=>{await app.reset();await work();});}

  await scenario('registration validates password length, bytes and malformed account fields before writes',async()=>{
    const payload={name:'Synthetic user',email:'new@test.invalid',phone:'0771234567',password:TEST_PASSWORD};
    for(const change of [{password:'a'},{password:'a'.repeat(73)},{name:{bad:true}},{email:{$ne:null}},{phone:['0771234567']}])assert.equal((await request('/auth/register-customer',{method:'POST',body:{...payload,...change}})).status,400);
    assert.equal(await app.mongo.collection('users').countDocuments({email:payload.email}),0);
    assert.equal((await request('/auth/register-customer',{method:'POST',body:payload})).status,201);
    const token=await login();
    assert.equal((await request('/auth/update-credentials',{method:'PUT',token,body:{currentPassword:TEST_PASSWORD,newPassword:'short'}})).status,400);
    assert.equal((await request('/health')).status,200);
  });
  await scenario('profile cannot bypass current-password verification for administrator email changes',async()=>{
    const token=await login('admin');
    assert.equal((await request('/auth/profile',{method:'PUT',token,body:{email:'unverified@test.invalid'}})).status,400);
    assert.equal((await request('/auth/update-credentials',{method:'PUT',token,body:{newEmail:'changed@test.invalid'}})).status,400);
    const changed=await request('/auth/update-credentials',{method:'PUT',token,body:{newEmail:'changed@test.invalid',currentPassword:TEST_PASSWORD}});
    assert.equal(changed.status,200);assert.equal(changed.data.user.email,'changed@test.invalid');
    assert.equal((await request('/auth/me',{token})).status,401);
    assert.equal((await request('/auth/me',{token:changed.data.token})).status,200);
  });
  await scenario('browser sessions are HttpOnly, reject CSRF, and logout revokes copied tokens',async()=>{
    const result=await request('/auth/login',{method:'POST',body:{email:accounts.customer,password:TEST_PASSWORD},headers:{'X-Yaans-Client':'browser'}});
    assert.equal(result.status,200);assert.equal(result.data.token,undefined);
    const cookies=result.headers.getSetCookie();assert.ok(cookies.some(v=>v.startsWith('yaans_session=')&&v.includes('HttpOnly')));
    const cookie=cookies.map(v=>v.split(';')[0]).join('; ');const csrf=cookies.find(v=>v.startsWith('yaans_csrf=')).split(';')[0].slice('yaans_csrf='.length);
    assert.equal((await request('/auth/me',{headers:{Cookie:cookie}})).status,200);
    assert.equal((await request('/auth/profile',{method:'PUT',body:{name:'Changed'},headers:{Cookie:cookie}})).status,403);
    assert.equal((await request('/auth/profile',{method:'PUT',body:{name:'Changed'},headers:{Cookie:cookie,'X-CSRF-Token':'wrong'}})).status,403);
    assert.equal((await request('/auth/profile',{method:'PUT',body:{name:'Changed'},headers:{Cookie:cookie,'X-CSRF-Token':csrf}})).status,200);
    const bearer=await login();
    assert.equal((await request('/auth/logout',{method:'POST',body:{},token:bearer})).status,200);
    assert.equal((await request('/auth/me',{token:bearer})).status,401);
    assert.equal((await request('/auth/me',{headers:{Cookie:cookie}})).status,401);
  });
  await scenario('CORS rejects untrusted origins without breaking same-site requests',async()=>{
    assert.equal((await request('/health',{headers:{Origin:'https://untrusted.example'}})).status,403);
    const result=await request('/health',{headers:{Origin:'https://yaans.lk'}});
    assert.equal(result.status,200);assert.equal(result.headers.get('access-control-allow-origin'),'https://yaans.lk');
  });
  await scenario('all banner write paths reject executable, external and ambiguous URLs',async()=>{
    const token=await login('admin');const base={id:'new',title:'Safe title',imageUrl:'/brand/yaans-mark-dark.png',active:true};
    for(const ctaLink of ['javascript:alert(1)','//untrusted.example','/\\untrusted.example','/%2funtrusted.example','https://untrusted.example','/products\n']){
      for(const [route,body]of [['/admin/config/banners',{banners:[{...base,ctaLink}]}],['/admin/config/general',{banners:[{...base,ctaLink}]}],['/admin/banners',{...base,ctaLink}],['/admin/banners/bnr_test',{ctaLink}]]){
        const method=route==='/admin/banners'?'POST':'PUT';assert.equal((await request(route,{method,token,body})).status,400,route);
      }
    }
    assert.equal((await request('/admin/config/banners',{method:'PUT',token,body:{banners:[{...base,ctaLink:'/products?category=electronics'}]}})).status,200);
  });
  await scenario('upload limits reject fake images, oversized files, fields and unapproved sellers',async()=>{
    const token=await login('seller');
    async function upload(form){const r=await fetch(app.url+'/api/seller/upload-image',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});return {status:r.status,data:await r.json()};}
    const fake=new FormData();fake.append('image',new Blob(['<html>not an image</html>'],{type:'image/jpeg'}),'evil.html');assert.equal((await upload(fake)).status,415);
    const large=new FormData();large.append('image',new Blob([Buffer.alloc(4*1024*1024+1)],{type:'image/png'}),'large.png');assert.equal((await upload(large)).status,413);
    const deep=new FormData();deep.append('a'+'[b]'.repeat(100),'value');assert.ok([400,413].includes((await upload(deep)).status));
    const png=new FormData();png.append('image',new Blob([await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer()],{type:'image/png'}),'image.png');
    const missing=await upload(png);assert.equal(missing.status,503);assert.equal(missing.data.url,undefined);
    await app.mongo.collection('sellers').updateOne({_id:'sel_test_pantry'},{$set:{status:'pending'}});
    assert.equal((await upload(fake)).status,403);assert.equal((await request('/health')).status,200);
  });
  await scenario('reviews require a delivered owned purchase and cannot repeat or fabricate verification',async()=>{
    const token=await login();const route='/marketplace/products/prd_test_spice/reviews';const review={rating:5,title:'Test',comment:'Delivered purchase review',verifiedPurchase:true,userId:'somebody-else'};
    assert.equal((await request(route,{method:'POST',body:review})).status,401);
    assert.equal((await request(route,{method:'POST',token,body:review})).status,403);
    const order=await request('/orders/checkout',{method:'POST',token,headers:{'Idempotency-Key':randomUUID()},body:{items:[{productId:'prd_test_spice',variantLabel:'100 g',quantity:1}],shippingAddress,paymentMethod:'COD',codConfirmedByCustomer:true}});
    assert.equal(order.status,201);
    assert.equal((await request(route,{method:'POST',token,body:review})).status,403);
    await app.mongo.collection('suborders').updateOne({_id:order.data.subOrders[0]._id},{$set:{fulfillmentStatus:'delivered'}});
    const saved=await request(route,{method:'POST',token,body:review});assert.equal(saved.status,201);assert.equal(saved.data.review.verifiedPurchase,true);assert.equal(saved.data.review.userId,undefined);assert.equal(saved.data.review.purchaseOrderId,undefined);
    assert.equal((await request(route,{method:'POST',token,body:review})).status,409);
    assert.equal(await app.mongo.collection('reviews').countDocuments({productId:'prd_test_spice'}),1);
    await app.mongo.collection('reviews').insertOne({_id:'legacy',productId:'prd_test_spice',userId:null,verifiedPurchase:true,customerName:'Legacy',rating:1,comment:'Legacy review'});
    const publicView=await request('/marketplace/products/prd_test_spice');assert.equal(publicView.data.reviews.find(x=>x._id==='legacy').verifiedPurchase,false);
  });
  await scenario('authenticator enrollment protects its secret, revokes old sessions and consumes recovery codes once',async()=>{
    const token=await login('admin');
    assert.equal((await request('/auth/admin/mfa/enroll',{method:'POST',token,body:{}})).status,401);
    const begin=await request('/auth/admin/mfa/enroll',{method:'POST',token,body:{currentPassword:TEST_PASSWORD}});assert.equal(begin.status,200);
    const stored=await app.mongo.collection('users').findOne({_id:'usr_test_admin'});assert.ok(!JSON.stringify(stored.adminMfaPending).includes(begin.data.secret));
    const totp=new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(begin.data.secret),algorithm:'SHA1',digits:6,period:30});
    const confirm=await request('/auth/admin/mfa/confirm',{method:'POST',token,body:{code:totp.generate()}});assert.equal(confirm.status,200);assert.equal(confirm.data.recoveryCodes.length,8);
    assert.equal((await request('/auth/me',{token})).status,401);
    const challenge=await request('/auth/admin/login',{method:'POST',body:{email:accounts.admin,password:TEST_PASSWORD}});
    assert.equal(challenge.data.requiresMfa,true);assert.equal(challenge.data.token,undefined);
    assert.equal((await request('/admin/overview',{token:challenge.data.challengeToken})).status,401);
    // The enrollment code is consumed. A later TOTP can authenticate once only.
    const laterCode=totp.generate({timestamp:Date.now()+30000});
    const normal=await request('/auth/admin/mfa/login',{method:'POST',body:{challengeToken:challenge.data.challengeToken,code:laterCode}});
    assert.equal(normal.status,200);assert.equal((await request('/admin/overview',{token:normal.data.token})).status,200);
    const second=await request('/auth/admin/login',{method:'POST',body:{email:accounts.admin,password:TEST_PASSWORD}});
    assert.equal((await request('/auth/admin/mfa/login',{method:'POST',body:{challengeToken:second.data.challengeToken,code:laterCode}})).status,401);
    const loginBody={challengeToken:second.data.challengeToken,code:confirm.data.recoveryCodes[0]};
    const verified=await request('/auth/admin/mfa/login',{method:'POST',body:loginBody});assert.equal(verified.status,200);assert.equal(verified.data.user.mfaEnabled,true);
    assert.equal((await request('/auth/admin/mfa/login',{method:'POST',body:{...loginBody,code:confirm.data.recoveryCodes[1]}})).status,401);
    const next=await request('/auth/admin/login',{method:'POST',body:{email:accounts.admin,password:TEST_PASSWORD}});
    assert.equal((await request('/auth/admin/mfa/login',{method:'POST',body:{challengeToken:next.data.challengeToken,code:confirm.data.recoveryCodes[0]}})).status,401);
    const database=await app.mongo.collection('users').findOne({_id:'usr_test_admin'});assert.equal(database.adminMfa.recoveryHashes.length,7);assert.ok(!JSON.stringify(database.adminMfa).includes(confirm.data.recoveryCodes[0]));
    for(let i=0;i<5;i++)assert.equal((await request('/auth/admin/mfa/login',{method:'POST',headers:{'X-Forwarded-For':`203.0.113.${20+i}`},body:{challengeToken:next.data.challengeToken,code:'invalid-code'}})).status,401);
    assert.equal((await request('/auth/admin/mfa/login',{method:'POST',headers:{'X-Forwarded-For':'203.0.113.30'},body:{challengeToken:next.data.challengeToken,code:'invalid-code'}})).status,429);
  });
  await scenario('security events are durable, bounded and do not store plaintext login identities',async()=>{
    await request('/auth/login',{method:'POST',body:{email:'missing@test.invalid',password:'wrong'}});
    const events=await app.mongo.collection('securityevents').find({event:'login_failed'}).toArray();assert.equal(events.length,1);assert.ok(events[0].expiresAt instanceof Date);
    assert.ok(!JSON.stringify(events).includes('missing@test.invalid'));assert.ok(!JSON.stringify(events).includes('wrong'));
    const {operationalStatus}=await import('../src/config/operations.js');
    await app.mongo.collection('securityevents').insertMany(Array.from({length:5},()=>({event:'admin_mfa_login_failed',createdAt:new Date()})));
    const status=await operationalStatus();assert.ok(status.alerts.includes('admin_authentication_failures'));
    assert.equal(status.securityCounts.admin_mfa_login_failed,5);assert.ok(!JSON.stringify(status).includes('missing@test.invalid'));
  });
});
