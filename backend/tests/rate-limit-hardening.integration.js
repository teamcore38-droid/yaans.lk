import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD } from '../../tests/support/fixtures.js';
import { consumeLimit } from '../src/middleware/sharedRateLimit.js';
import { operationalStatus } from '../src/config/operations.js';

test('resource throttles, fairness and bounded telemetry', {timeout:600000},async t=>{
  const app=await startIsolatedApp(0,{monitorCommands:true});t.after(()=>app.close());
  let client=0,ip;
  async function scenario(name,work){await t.test(name,async scoped=>{await app.reset();ip=`192.0.2.${++client}`;const now=Date.now();scoped.mock.method(Date,'now',()=>now);await work();});}
  async function request(route,{method='GET',token,body}={}){
    const r=await fetch(app.url+'/api'+route,{method,headers:{'X-Forwarded-For':ip,...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,headers:r.headers,data:await r.json()};
  }
  async function login(kind='customer'){
    const r=await request('/auth/login',{method:'POST',body:{email:accounts[kind],password:TEST_PASSWORD}});
    assert.equal(r.status,200);return r.data.token;
  }
  function blocked(r){assert.equal(r.status,429);assert.equal(r.data.code,'RATE_LIMITED');assert.ok(r.data.retryAfter>0);assert.equal(Number(r.headers.get('retry-after')),r.data.retryAfter);assert.match(r.headers.get('cache-control'),/no-store/);}
  async function exhaust(scope,identity,maximum,windowMs){for(let n=0;n<maximum;n++)assert.equal((await consumeLimit(scope,identity,maximum,windowMs)).allowed,true);}

  await scenario('ordinary cached-catalog routes incur no shared-counter writes',async()=>{
    let writes=0;const connection=app.mongo.client;
    const listener=e=>{if(e.commandName==='findAndModify'&&e.command.findAndModify==='ratelimits')writes++;};
    connection.on('commandStarted',listener);
    try{
      for(const route of ['/marketplace/home','/marketplace/categories','/marketplace/products?category=electronics','/marketplace/products/prd_test_spice'])assert.equal((await request(route)).status,200);
      assert.equal(writes,0);assert.equal(await app.mongo.collection('ratelimits').countDocuments(),0);
    }finally{connection.off('commandStarted',listener);}
  });
  await scenario('changing search terms cannot evade one shared search budget; normal browsing stays available',async()=>{
    await exhaust('catalog-search',ip,120,60000);
    blocked(await request('/marketplace/products?q=spice'));
    blocked(await request('/marketplace/products?q=another-term'));
    assert.equal((await request('/marketplace/products?category=electronics')).status,200);
    assert.equal((await request('/marketplace/home')).status,200);
  });
  await scenario('cart quote quota rejects work before inventory reads and preserves catalogue access',async()=>{
    const body={items:[{productId:'prd_test_spice',variantLabel:'100 g',quantity:1}],destinationDistrict:'Colombo'};
    assert.equal((await request('/orders/quote',{method:'POST',body})).status,200);
    // Fill the remaining allowance to simulate an already-busy client.
    for(let n=1;n<120;n++)await consumeLimit('cart-quote',ip,120,60000);
    let productReads=0;const listener=e=>{if(e.commandName==='find'&&e.command.find==='products')productReads++;};
    app.mongo.client.on('commandStarted',listener);
    try{blocked(await request('/orders/quote',{method:'POST',body}));assert.equal(productReads,0);}
    finally{app.mongo.client.off('commandStarted',listener);}
    assert.equal((await request('/marketplace/categories')).status,200);
    assert.equal(await app.mongo.collection('orders').countDocuments(),0);
  });
  await scenario('current-password attempts are bounded per account even across fresh sessions',async()=>{
    const token=await login();
    for(let n=0;n<5;n++)assert.equal((await request('/auth/update-credentials',{method:'PUT',token,body:{currentPassword:'incorrect',newPassword:'A different private passphrase!'}})).status,401);
    const fresh=await login();
    blocked(await request('/auth/update-credentials',{method:'PUT',token:fresh,body:{currentPassword:TEST_PASSWORD,newPassword:'A different private passphrase!'}}));
    assert.equal((await request('/auth/me',{token})).status,200);assert.ok(await login());
    const other=await login('seller');assert.equal((await request('/auth/update-credentials',{method:'PUT',token:other,body:{currentPassword:'incorrect',newPassword:'Another private passphrase!'}})).status,401);
  });
  await scenario('normal profile edits do not consume the credential-attempt allowance',async()=>{
    const token=await login();
    for(let n=0;n<7;n++)assert.equal((await request('/auth/update-credentials',{method:'PUT',token,body:{newName:'Updated display name',newEmail:accounts.customer}})).status,200);
    assert.equal(await app.mongo.collection('ratelimits').countDocuments({_id:/^credential-/}),0);
  });
  await scenario('bulk imports have a user budget and still reject unauthorized roles',async()=>{
    const token=await login('seller');
    for(let n=0;n<5;n++)assert.equal((await request('/seller/products/bulk-import',{method:'POST',token,body:{items:[]}})).status,400);
    blocked(await request('/seller/products/bulk-import',{method:'POST',token,body:{items:[]}}));
    const other=await login('otherSeller');assert.equal((await request('/seller/products/bulk-import',{method:'POST',token:other,body:{items:[]}})).status,400);
    const customer=await login();assert.equal((await request('/seller/products/bulk-import',{method:'POST',token:customer,body:{items:[]}})).status,403);
    assert.equal(await app.mongo.collection('products').countDocuments(),3);
  });
  await scenario('documents isolate authenticated accounts sharing one IP and retain a separate guest budget',async()=>{
    const one=await login(),two=await login('seller');
    await exhaust('order-documents','usr_test_customer',60,60000);
    blocked(await request('/documents/orders/missing',{token:one}));
    assert.equal((await request('/documents/orders/missing',{token:two})).status,404);
    assert.equal((await request('/documents/orders/missing')).status,404);
    for(let n=1;n<60;n++)await consumeLimit('order-documents',ip,60,60000);
    blocked(await request('/documents/orders/missing'));
  });
  await scenario('notification budgets are independent per authorized user behind one network',async()=>{
    const one=await login('seller'),two=await login('otherSeller');
    assert.equal((await request('/notifications',{token:one})).status,200);
    const seller=await app.mongo.collection('users').findOne({email:accounts.seller});
    for(let n=1;n<120;n++)await consumeLimit('order-notifications',seller._id,120,60000);
    blocked(await request('/notifications',{token:one}));assert.equal((await request('/notifications',{token:two})).status,200);
    assert.equal((await request('/notifications')).status,401);
  });
  await scenario('broader document and notification IP guards reject bursts before authentication',async()=>{
    await exhaust('order-documents-ip',ip,300,60000);
    blocked(await request('/documents/orders/missing',{token:'invalid'}));
    await exhaust('order-notifications-ip',ip,600,60000);
    blocked(await request('/notifications',{token:'invalid'}));
  });
  await scenario('protection-storage failure remains closed on newly covered routes',async()=>{
    const original=app.mongo.collection;
    app.mongo.collection=function(name,...rest){return name==='ratelimits'?{findOneAndUpdate:async()=>{throw new Error('Synthetic protection outage');}}:original.call(this,name,...rest);};
    try{assert.equal((await request('/orders/quote',{method:'POST',body:{items:[]}})).status,503);assert.equal((await request('/marketplace/products?q=spice')).status,503);assert.equal((await request('/marketplace/categories')).status,200);}
    finally{app.mongo.collection=original;}
  });
  await scenario('abuse telemetry is bounded, shared, private and alerts on sustained rejections',async()=>{
    let metricWrites=0;const listener=e=>{if(e.commandName==='update'&&e.command.update==='operationalmetrics')metricWrites++;};app.mongo.client.on('commandStarted',listener);
    try{for(let n=0;n<101;n++)await consumeLimit('privacy-test','private-client@test.invalid',1,15*60000);}
    finally{app.mongo.client.off('commandStarted',listener);}
    assert.equal(metricWrites,7);
    const counters=await app.mongo.collection('ratelimits').find({}).toArray();assert.equal(counters[0].rejected,100);assert.ok(!JSON.stringify(counters).includes('private-client'));
    const status=await operationalStatus();assert.equal(status.counts.rate_limit_rejected,64);assert.ok(status.alerts.includes('rate_limit_abuse'));
    const metrics=await app.mongo.collection('operationalmetrics').find({}).toArray();assert.ok(!JSON.stringify(metrics).includes('private-client'));
    const original=app.mongo.collection;app.mongo.collection=function(name,...rest){return name==='operationalmetrics'?{updateOne:async()=>{throw new Error('Synthetic telemetry outage');}}:original.call(this,name,...rest);};
    try{assert.equal((await consumeLimit('metric-failure','client',1,60000)).allowed,true);assert.equal((await consumeLimit('metric-failure','client',1,60000)).allowed,false);}
    finally{app.mongo.collection=original;}
  });
});
