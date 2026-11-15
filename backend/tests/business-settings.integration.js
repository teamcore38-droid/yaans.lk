import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';
import { DEFAULT_BUSINESS_SETTINGS } from '../../shared/businessSettings.js';
test('business publishing, safety boundaries and order policy snapshots', {timeout:180000}, async t=>{
  const app=await startIsolatedApp();t.after(()=>app.close());t.beforeEach(()=>app.reset());
  const fresh=()=>structuredClone(DEFAULT_BUSINESS_SETTINGS);
  async function req(path,token,body,method=body?'POST':'GET',headers={}){const response=await fetch(app.url+'/api'+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json().catch(()=>({})),headers:response.headers};}
  async function login(email,admin=false){const result=await req(admin?'/auth/admin/login':'/auth/login',null,{email,password:TEST_PASSWORD});assert.equal(result.status,200);return result.data.token;}
  const settingsPath='/admin/business-settings';
  async function publish(token,settings){const data=(await req(settingsPath,token)).data;const draft=await req(settingsPath+'/draft',token,{revision:data.revision,settings,currentPassword:TEST_PASSWORD},'PUT');assert.equal(draft.status,200,JSON.stringify(draft.data));const result=await req(settingsPath+'/publish',token,{revision:draft.data.revision,currentPassword:TEST_PASSWORD});assert.equal(result.status,200,JSON.stringify(result.data));return result;}
  async function place(){const result=await req('/orders/checkout',null,{items:[{productId:'prd_test_lamp',quantity:1}],shippingAddress,paymentMethod:'COD',codConfirmedByCustomer:true},'POST',{'Idempotency-Key':randomUUID()});assert.equal(result.status,201);return result.data;}
  await t.test('only reauthenticated administrators can draft/publish and public endpoints never leak drafts or credentials',async()=>{
    const admin=await login(accounts.admin,true),customer=await login(accounts.customer),seller=await login(accounts.seller);
    assert.equal((await req(settingsPath)).status,401);
    for(const token of [customer,seller])assert.equal((await req(settingsPath,token)).status,403);
    const settings=fresh();settings.identity.name='Private draft';settings.legal.terms='Draft legal text';
    assert.equal((await req(settingsPath+'/draft',admin,{revision:0,settings,currentPassword:'wrong'},'PUT')).status,401);
    const draft=await req(settingsPath+'/draft',admin,{revision:0,settings,currentPassword:TEST_PASSWORD},'PUT');assert.equal(draft.status,200);
    const publicBefore=await req('/marketplace/categories');assert.equal(publicBefore.data.businessSettings.identity.name,'Yaans.lk');assert.ok(!JSON.stringify(publicBefore.data).includes('Private draft'));
    assert.equal((await req(settingsPath+'/publish',admin,{revision:0,currentPassword:TEST_PASSWORD})).status,409);
    assert.equal((await req(settingsPath+'/publish',admin,{revision:1,currentPassword:TEST_PASSWORD})).status,200);
    const live=await req('/marketplace/categories');assert.equal(live.data.businessSettings.identity.name,'Private draft');assert.equal(live.data.businessVersion,1);assert.equal((await req('/marketplace/policies/1')).data.settings.identity.name,'Private draft');assert.ok(!JSON.stringify(live.data).includes(TEST_PASSWORD));
    assert.ok(await app.mongo.collection('securityevents').findOne({event:'BUSINESS_SETTINGS_PUBLISHED'}));
    const restored=await req(settingsPath+'/restore',admin,{revision:2,version:0,currentPassword:TEST_PASSWORD});assert.equal(restored.status,200);
    assert.equal((await req('/marketplace/categories')).data.businessSettings.identity.name,'Private draft');
    const browser=await req('/auth/admin/login',null,{email:accounts.admin,password:TEST_PASSWORD},'POST',{'X-Yaans-Client':'browser'});const cookie=browser.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    assert.equal((await req(settingsPath+'/publish',null,{revision:3,currentPassword:TEST_PASSWORD},'POST',{Cookie:cookie})).status,403);
  });
  await t.test('shipping rules, purchase limits and seller overrides are enforced on the server',async()=>{
    const admin=await login(accounts.admin,true),seller=await login(accounts.seller);const settings=fresh();settings.delivery.surchargeAfterItems=1;settings.delivery.surchargePerItemLkr=12;settings.pricing.maxQuantityPerSelection=2;settings.pricing.maxCartSelections=1;settings.home.deals.limit=1;
    await publish(admin,settings);
    await app.mongo.collection('sellers').updateOne({_id:'sel_test_home'},{$set:{'shippingPolicy.freeShippingThresholdLkr':0}});
    const quote=await req('/orders/quote',null,{items:[{productId:'prd_test_lamp',quantity:2}],destinationDistrict:'Colombo'});assert.equal(quote.status,200);assert.equal(quote.data.totalDeliveryFeeLkr,292);
    assert.equal((await req('/orders/quote',null,{items:[{productId:'prd_test_lamp',quantity:3}],destinationDistrict:'Colombo'})).status,400);
    assert.equal((await req(settingsPath+'/sellers/sel_test_pantry/shipping',admin,{currentPassword:TEST_PASSWORD,shippingPolicy:{preparationDays:99}},'PATCH')).status,400);
    assert.equal((await req('/seller/profile',seller,{shippingPolicy:{preparationDays:99}},'PUT')).status,400);
    assert.equal((await req(settingsPath+'/sellers/sel_test_pantry/shipping',admin,{currentPassword:TEST_PASSWORD,shippingPolicy:{preparationDays:3,freeShippingThresholdLkr:3000}},'PATCH')).status,200);
    const page=await req('/marketplace/products/prd_test_spice?destinationDistrict=Kandy');assert.match(page.data.shippingEstimate.estimatedDays,/3 business day/);
    const cfg=(await req('/admin/overview',admin)).data.platformConfig;cfg.districts[0].estimatedDays='5-6 business days';assert.equal((await req('/admin/config/districts',admin,{districts:cfg.districts},'PUT')).status,200);
    assert.match((await req('/marketplace/products/prd_test_lamp?destinationDistrict=Colombo')).data.shippingEstimate.estimatedDays,/5-6/);
    await app.mongo.collection('products').updateMany({_id:{$in:['prd_test_spice','prd_test_lamp']}},{$set:{isDeal:true}});
    assert.equal((await req('/marketplace/home')).data.dealProducts.length,1);
  });
  await t.test('orders retain their original return policy across later publication; late returns are rejected without touching finance',async()=>{
    const admin=await login(accounts.admin,true);const settings=fresh();settings.returns.days=14;settings.returns.refundMaxDays=8;await publish(admin,settings);
    const placed=await place();assert.equal(placed.order.policySnapshot.version,1);assert.equal(placed.subOrders[0].returnPolicy.days,14);
    settings.returns.enabled=false;settings.returns.days=1;await publish(admin,settings);
    const sub=placed.subOrders[0];await app.mongo.collection('suborders').updateOne({_id:sub._id},{$set:{fulfillmentStatus:'delivered',deliveredAt:new Date(Date.now()-10*86400000).toISOString()}});
    const requested=await req(`/orders/suborders/${sub._id}/customer-action`,null,{action:'request_return',reason:'Defective'},'POST',{'X-Order-Access-Token':placed.guestAccessToken});assert.equal(requested.status,200);
    assert.equal(requested.data.subOrder.refund,undefined);assert.equal(requested.data.subOrder.settlementStatus,'held_for_return');
    settings.returns.enabled=true;settings.returns.days=2;await publish(admin,settings);const late=await place();await app.mongo.collection('suborders').updateOne({_id:late.subOrders[0]._id},{$set:{fulfillmentStatus:'delivered',deliveredAt:new Date(Date.now()-3*86400000).toISOString()}});
    assert.equal((await req(`/orders/suborders/${late.subOrders[0]._id}/customer-action`,null,{action:'request_return'},'POST',{'X-Order-Access-Token':late.guestAccessToken})).status,409);
    assert.equal((await app.mongo.collection('suborders').findOne({_id:late.subOrders[0]._id})).fulfillmentStatus,'delivered');
  });
  await t.test('new seller defaults, configured commission rates and disabled COD match public claims',async()=>{
    const admin=await login(accounts.admin,true);const settings=fresh();settings.delivery.defaultFreeShippingLkr=6000;settings.delivery.defaultIntraDistrictFeeLkr=320;settings.references.sellerTypes[1].commissionPercent=6;settings.returns.productOverrides=[{id:'prd_test_lamp',eligible:false,days:7}];await publish(admin,settings);
    const signup=await req('/auth/register-seller',null,{name:'Artisan',email:'artisan@test.invalid',phone:'0771234567',password:TEST_PASSWORD,storeName:'Artisan Store',sellerType:'Artisan & Craft',district:'Kandy',city:'Kandy',nicOrBrNumber:'TEST',bankName:'Sampath Bank'});assert.equal(signup.status,201);assert.equal(signup.data.seller.shippingPolicy.freeShippingThresholdLkr,6000);assert.equal(signup.data.seller.commissionRateOverride,null);
    assert.equal((await req('/marketplace/products/prd_test_lamp')).data.returnPolicy.enabled,false);
    assert.equal((await req('/admin/config/general',admin,{codEnabledGlobally:false},'PUT')).status,200);
    assert.equal((await req('/marketplace/products/prd_test_lamp')).data.codAvailable,false);
    assert.equal((await req('/orders/quote',null,{items:[{productId:'prd_test_lamp',quantity:1}],destinationDistrict:'Colombo'})).data.codAvailable,false);
  });
  await t.test('failed publication rolls back archive and live settings together; compact checkout reads retain the write guard',async()=>{
    const admin=await login(accounts.admin,true);const settings=fresh();settings.identity.name='Must not publish';
    const draft=await req(settingsPath+'/draft',admin,{revision:0,settings,currentPassword:TEST_PASSWORD},'PUT');assert.equal(draft.status,200);
    await app.mongo.command({collMod:'securityevents',validator:{event:{$ne:'BUSINESS_SETTINGS_PUBLISHED'}}});
    try{assert.ok((await req(settingsPath+'/publish',admin,{revision:1,currentPassword:TEST_PASSWORD})).status>=500);}finally{await app.mongo.command({collMod:'securityevents',validator:{}});}
    assert.equal((await req('/marketplace/categories')).data.businessSettings.identity.name,'Yaans.lk');
    assert.equal(await app.mongo.collection('businesspublications').countDocuments({_id:1}),0);
    const compact=await app.db.getStore({platformConfig:true},{compactConfig:true});assert.equal(compact.platformConfig.businessDraft,undefined);compact.platformConfig.globalFreeShippingMinLkr=123;
    await app.db.persistStore(compact);
    const stored=await app.mongo.collection('platformconfigs').findOne({key:'main_config'});assert.equal(stored.businessDraft.identity.name,'Must not publish');assert.equal(stored.globalFreeShippingMinLkr,123);
  });

});
