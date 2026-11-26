import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {startIsolatedApp} from './helpers/isolated-app.js';
import {adminLoginBody,accounts,TEST_PASSWORD,shippingAddress} from '../../tests/support/fixtures.js';
import {processOrderEmails,confirmationEmail} from '../src/services/orderEmails.js';
import {recordCashMovement} from '../src/services/finance.js';
import sharp from 'sharp';
import decodeQR from 'qr/decode.js';

test('private documents and durable confirmation outbox', {timeout:180000}, async t=>{
  const app=await startIsolatedApp();t.after(()=>app.close());t.beforeEach(()=>app.reset());
  async function req(path,{token,access,body,method=body?'POST':'GET',key}={}){
    const r=await fetch(app.url+'/api'+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(access?{'X-Order-Access-Token':access}:{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:r.headers.get('content-type')?.includes('pdf')?Buffer.from(await r.arrayBuffer()):await r.json(),headers:r.headers};
  }
  async function login(email,admin=false){const r=await req(admin?'/auth/admin/login':'/auth/login',{body:admin?adminLoginBody(email):{email,password:TEST_PASSWORD}});assert.equal(r.status,200);return r.data.token;}
  const payload=()=>({items:[{productId:'prd_test_spice',variantLabel:'100 g',quantity:1},{productId:'prd_test_lamp',quantity:1}],shippingAddress,customerEmail:'guest@test.invalid',paymentMethod:'COD',codConfirmedByCustomer:true});
  async function place(options={}){const key=randomUUID(),body=payload(),r=await req('/orders/checkout',{body,key,...options});assert.equal(r.status,201,JSON.stringify(r.data));return {...r.data,key,body};}
  async function assertAdminQr(documentPath, orderId, admin, access) {
    const expected = 'http://127.0.0.1:4173/admin/orders/' + orderId;
    const preview = await req(documentPath, {token:admin});
    assert.equal(preview.status, 200);
    assert.match(preview.data.adminQr, /^data:image\/gif;base64,/);
    const {data,info} = await sharp(Buffer.from(preview.data.adminQr.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(decodeQR({width:info.width,height:info.height,data}), expected);
    const printed = await req(documentPath+'?format=pdf', {token:admin});
    assert.equal(printed.status, 200);
    assert.ok(printed.data.includes(Buffer.from(expected)));
    const guestPreview = await req(documentPath, {access});
    assert.equal(guestPreview.status, 200);
    assert.equal(guestPreview.data.adminQr, undefined);
    const guestPdf = await req(documentPath+'?format=pdf', {access});
    assert.equal(guestPdf.status, 200);
    assert.ok(!guestPdf.data.includes(Buffer.from(expected)));
  }

  await t.test('received orders have an admin QR and the scanned details require authorized sign-in',async()=>{
    const {order,guestAccessToken:access}=await place();
    const admin=await login(accounts.admin,true);
    await assertAdminQr(`/documents/orders/${order._id}/${order._id}%3Asummary`,order._id,admin,access);
    const detailPath=`/admin/orders/${order._id}`;
    assert.equal((await req(detailPath,{access})).status,401);
    for(const email of [accounts.customer,accounts.seller]){
      assert.equal((await req(detailPath,{token:await login(email)})).status,403);
    }
    const detail=await req(detailPath,{token:admin});
    assert.equal(detail.status,200);
    assert.match(detail.headers.get('cache-control'),/no-store/);
    assert.equal(detail.data.order.orderNumber,order.orderNumber);
    assert.equal(detail.data.packages.length,2);
    assert.ok(detail.data.packages[0].items[0].title);
    assert.ok(!/guestAccess|paymentReceipt|settlementId|bankDetails/.test(JSON.stringify(detail.data)));
    assert.equal((await req('/admin/orders/missing',{token:admin})).status,404);
    assert.equal((await req('/admin/orders/%2F',{token:admin})).status,400);
  });
  await t.test('checkout creates immutable documents once, restricts owner/guest/seller access and downloads PDFs',async()=>{
    const placed=await place(),{order,subOrders,guestAccessToken:access}=placed;
    const path=`/documents/orders/${order._id}`;
    assert.equal((await req(path)).status,403);
    assert.equal((await req(path,{access:'bad'})).status,403);
    const list=await req(path,{access});assert.equal(list.status,200);assert.match(list.headers.get('cache-control'),/no-store/);assert.equal(list.data.documents.length,5);
    const invoice=list.data.documents.find(d=>d.kind==='invoice');
    const before=await req(`${path}/${encodeURIComponent(invoice._id)}`,{access});assert.equal(before.status,200);
    await app.mongo.collection('products').updateOne({_id:'prd_test_spice'},{$set:{title:'Changed today',priceLkr:99999}});
    await app.mongo.collection('sellers').updateOne({_id:'sel_test_pantry'},{$set:{storeName:'Changed today'}});
    assert.deepEqual((await req(`${path}/${encodeURIComponent(invoice._id)}`,{access})).data,before.data);
    const pdf=await req(`${path}/${encodeURIComponent(invoice._id)}?format=pdf`,{access});assert.equal(pdf.status,200);assert.ok(pdf.data.subarray(0,4).equals(Buffer.from('%PDF')));assert.ok(pdf.data.length<4000000);
    const replay=await req('/orders/checkout',{body:placed.body,key:placed.key});assert.equal(replay.status,200);
    assert.equal(await app.mongo.collection('orderdocuments').countDocuments({orderId:order._id}),5);assert.equal(await app.mongo.collection('orderemailjobs').countDocuments({orderId:order._id}),1);
    const job=await app.mongo.collection('orderemailjobs').findOne({orderId:order._id});assert.ok(job.encryptedAccess);assert.ok(!JSON.stringify(job).includes(access));
    const seller=await login(accounts.seller),own=subOrders.find(s=>s.sellerId==='sel_test_pantry'),other=subOrders.find(s=>s.sellerId!==own.sellerId);
    const ownList=await req(`/documents/packages/${own._id}`,{token:seller});assert.equal(ownList.status,200);assert.equal(ownList.data.documents.length,2);
    assert.equal((await req(`/documents/packages/${other._id}`,{token:seller})).status,403);
    assert.equal((await req(`/documents/packages/${own._id}/${encodeURIComponent(other._id+':invoice')}`,{token:seller})).status,404);
    await app.mongo.collection('orders').updateOne({_id:order._id},{$set:{guestAccessExpiresAt:new Date(0)}});assert.equal((await req(path,{access})).status,403);
    const customer=await login(accounts.customer);assert.equal((await req(path,{token:customer})).status,403);
    const registered=await place({token:customer});assert.equal((await req(`/documents/orders/${registered.order._id}`,{token:customer})).status,200);
  });
  await t.test('outbox failure rolls back checkout, inventory, documents and notifications',async()=>{
    await app.mongo.command({collMod:'orderemailjobs',validator:{to:{$eq:'never-allowed'}}});
    try {const r=await req('/orders/checkout',{body:payload(),key:randomUUID()});assert.equal(r.status,503);assert.equal(await app.mongo.collection('orderdocuments').countDocuments({}),0);assert.equal(await app.mongo.collection('orders').countDocuments({customerEmail:'guest@test.invalid'}),0);}
    finally{await app.mongo.command({collMod:'orderemailjobs',validator:{}});}
  });
  await t.test('packing label and scanned receipt stay scoped to one package',async()=>{
    const {order,subOrders,guestAccessToken:access}=await place();
    const own=subOrders.find(sub=>sub.sellerId==='sel_test_pantry');
    const other=subOrders.find(sub=>sub._id!==own._id);
    const seller=await login(accounts.seller);
    const customer=await login(accounts.customer);
    const admin=await login(accounts.admin,true);
    const labelPath=id=>`/documents/packages/${id}/receipt-label`;
    const scannedPath=`/documents/package-receipts/${own._id}`;
    assert.equal((await req(labelPath(own._id),{access})).status,401);
    assert.equal((await req(labelPath(own._id),{token:customer})).status,403);
    assert.equal((await req(labelPath(other._id),{token:seller})).status,403);
    for(const token of [seller,admin]){
      const label=await req(labelPath(own._id),{token});
      assert.equal(label.status,200);
      assert.match(label.headers.get('content-disposition'),/RECEIPT-LABEL\.pdf/);
      assert.match(label.headers.get('cache-control'),/no-store/);
      assert.ok(label.data.includes(Buffer.from(`http://127.0.0.1:4173/package-receipt/${own._id}`)));
      assert.ok(!label.data.includes(Buffer.from(access)));
    }
    for(const options of [{},{access:'A'.repeat(43)},{token:customer},{token:seller}]){
      assert.equal((await req(scannedPath,options)).status,403);
    }
    const invoice=await req(scannedPath,{access});
    assert.equal(invoice.status,200);
    assert.deepEqual(invoice.data.documents.map(d=>d.kind),['invoice']);
    for(const id of [other._id+':invoice',own._id+':packing-slip',order._id+':summary']){
      assert.equal((await req(`${scannedPath}/${encodeURIComponent(id)}?format=pdf`,{access})).status,404);
    }
    await app.mongo.collection('suborders').updateOne({_id:own._id},{$set:{fulfillmentStatus:'delivered'}});
    await recordCashMovement('receipt',own._id,{amountLkr:own.grossTotalLkr,bankReference:'STAGING-QR-PACKAGE-001'},{_id:'usr_test_admin',email:accounts.admin});
    const paid=await req(scannedPath,{access});
    assert.deepEqual(paid.data.documents.map(d=>d.kind).sort(),['invoice','receipt']);
    const pdf=await req(`${scannedPath}/${own._id}%3Areceipt?format=pdf`,{access});
    assert.equal(pdf.status,200);
    assert.ok(!pdf.data.includes(Buffer.from('/admin/orders/')));
    await app.mongo.collection('orders').updateOne({_id:order._id},{$set:{guestAccessExpiresAt:new Date(0)}});
    assert.equal((await req(scannedPath,{access})).status,403);
    const registered=await place({token:customer});
    const customerPackage=`/documents/package-receipts/${registered.subOrders[0]._id}`;
    assert.equal((await req(customerPackage,{token:customer})).status,200);
    assert.equal((await req(customerPackage,{access})).status,403);
  });
  await t.test('collection, refund and cancellation get separate documents without changing the original invoice',async()=>{
    const {order,subOrders,guestAccessToken:access}=await place();const sub=subOrders[0];
    const original=await app.mongo.collection('orderdocuments').findOne({_id:`${sub._id}:invoice`});
    assert.equal(await app.mongo.collection('orderdocuments').countDocuments({kind:'receipt'}),0);
    await app.mongo.collection('suborders').updateOne({_id:sub._id},{$set:{fulfillmentStatus:'delivered'}});
    await recordCashMovement('receipt',sub._id,{amountLkr:sub.grossTotalLkr,bankReference:'COURIER-REFERENCE-001'},{_id:'usr_test_admin',email:accounts.admin});
    assert.ok(await app.mongo.collection('orderdocuments').findOne({_id:`${sub._id}:receipt`}));
    const admin=await login(accounts.admin,true);
    await assertAdminQr(`/documents/orders/${order._id}/${sub._id}%3Areceipt`,order._id,admin,access);
    await app.mongo.collection('suborders').updateOne({_id:sub._id},{$set:{fulfillmentStatus:'returned'}});
    await recordCashMovement('refund',sub._id,{amountLkr:sub.grossTotalLkr,bankReference:'REFUND-REFERENCE-001'},{_id:'usr_test_admin',email:accounts.admin});
    assert.ok(await app.mongo.collection('orderdocuments').findOne({_id:`${sub._id}:refund`}));
    const other=subOrders[1];assert.equal((await req(`/orders/suborders/${other._id}/customer-action`,{access,body:{action:'cancel'}})).status,200);
    assert.ok(await app.mongo.collection('orderdocuments').findOne({_id:`${other._id}:cancellation`}));
    assert.deepEqual(await app.mongo.collection('orderdocuments').findOne({_id:original._id}),original);
    const docs=await req(`/documents/orders/${order._id}`,{access});assert.ok(docs.data.documents.some(d=>d.kind==='refund'));
  });
  await t.test('email worker retries safely, respects configuration, protects capabilities and prevents concurrent duplicates',async()=>{
    const placed=await place();let calls=0;const bodies=[];
    const sender=async(_url,options)=>{calls++;bodies.push(options);return new Response(JSON.stringify({id:'provider-id'}),{status:calls===1?503:200});};
    assert.equal((await processOrderEmails({fetchImpl:sender})).configurationRequired,true);assert.equal(calls,0);
    Object.assign(process.env,{ORDER_EMAIL_ENABLED:'true',RESEND_API_KEY:'test-api-only',RESEND_EMAIL_DOMAIN:'example.invalid'});
    try {
      await processOrderEmails({fetchImpl:sender,limit:1});assert.equal(calls,1);
      let job=await app.mongo.collection('orderemailjobs').findOne({orderId:placed.order._id});assert.equal(job.status,'pending');
      await app.mongo.collection('orderemailjobs').updateOne({_id:job._id},{$set:{nextAttemptAt:new Date(0)}});
      await Promise.all([processOrderEmails({fetchImpl:sender}),processOrderEmails({fetchImpl:sender})]);assert.equal(calls,2);
      assert.equal(bodies[0].body,bodies[1].body);assert.equal(bodies[0].headers['Idempotency-Key'],bodies[1].headers['Idempotency-Key']);
      assert.ok(JSON.parse(bodies[1].body).text.includes(placed.guestAccessToken));
      job=await app.mongo.collection('orderemailjobs').findOne({_id:job._id});assert.equal(job.status,'sent');assert.equal(job.encryptedAccess,undefined);
      assert.equal((await req('/documents/email-worker',{body:{}})).status,401);
      const admin=await login(accounts.admin,true);assert.equal((await req('/documents/email-status',{token:admin})).data.counts.sent,1);
    }finally{process.env.ORDER_EMAIL_ENABLED='false';process.env.RESEND_API_KEY='';}
    const escaped=confirmationEmail({orderNumber:'<script>',items:[{title:'<img onerror="x">',quantity:1,sellerName:'Seller',lineTotalLkr:1}],subtotalLkr:1,deliveryLkr:1,totalLkr:2},'https://yaans.lk/track-order');assert.ok(!escaped.html.includes('<script>'));assert.ok(!escaped.html.includes('<img'));
  });
  await t.test('free budgets defer work and expired ambiguous attempts require review without sending',async()=>{
    const placed=await place();Object.assign(process.env,{ORDER_EMAIL_ENABLED:'true',RESEND_API_KEY:'test-api-only',RESEND_EMAIL_DOMAIN:'example.invalid'});
    let calls=0;const sender=async()=>{calls++;return new Response(JSON.stringify({id:'never'}));};
    const date=new Date();
    try {
      await app.mongo.collection('orderemailbudgets').insertOne({_id:`day:${date.toISOString().slice(0,10)}`,count:95});
      await processOrderEmails({fetchImpl:sender,limit:1});assert.equal(calls,0);
      let job=await app.mongo.collection('orderemailjobs').findOne({orderId:placed.order._id});assert.equal(job.status,'pending');assert.equal(job.lastError,'FREE_PLAN_BUDGET');assert.equal(job.attempts,0);
      await app.mongo.collection('orderemailjobs').updateOne({_id:job._id},{$set:{nextAttemptAt:new Date(0),firstAttemptAt:new Date(Date.now()-21*3600000)}});
      await processOrderEmails({fetchImpl:sender});assert.equal(calls,0);
      job=await app.mongo.collection('orderemailjobs').findOne({_id:job._id});assert.equal(job.status,'attention');assert.equal(job.encryptedAccess,undefined);
      await app.mongo.collection('orderemailjobs').updateOne({_id:job._id},{$set:{status:'pending',createdAt:new Date(Date.now()-21*3600000),nextAttemptAt:new Date(0),leaseUntil:new Date(0)},$unset:{firstAttemptAt:1}});
      await processOrderEmails({fetchImpl:sender});assert.equal(calls,0);
      assert.equal((await app.mongo.collection('orderemailjobs').findOne({_id:job._id})).status,'attention');
    } finally {process.env.ORDER_EMAIL_ENABLED='false';process.env.RESEND_API_KEY='';}
  });

  await t.test('tampered or truncated encrypted capabilities never produce an email',async()=>{
    const placed=await place();const job=await app.mongo.collection('orderemailjobs').findOne({orderId:placed.order._id});
    const altered=Buffer.from(job.encryptedAccess,'base64url');altered[altered.length-1]^=1;
    Object.assign(process.env,{ORDER_EMAIL_ENABLED:'true',RESEND_API_KEY:'test-api-only',RESEND_EMAIL_DOMAIN:'example.invalid'});
    let calls=0;
    try {
      for(const invalid of ['AA',altered.toString('base64url')]){
        await app.mongo.collection('orderemailjobs').updateOne({_id:job._id},{$set:{encryptedAccess:invalid,nextAttemptAt:new Date(0),leaseUntil:new Date(0)}});
        await processOrderEmails({fetchImpl:async()=>{calls++;return new Response(JSON.stringify({id:'never'}));}});
        assert.equal(calls,0);assert.equal((await app.mongo.collection('orderemailjobs').findOne({_id:job._id})).lastError,'DELIVERY_RETRY');
      }
    }finally{process.env.ORDER_EMAIL_ENABLED='false';process.env.RESEND_API_KEY='';}
  });

});
