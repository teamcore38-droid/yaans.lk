import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';
const password='Staff-product-password!123', personal='Staff-personal-password!456';
test('permission-scoped staff product editing preserves inventory and administration barriers', {timeout:180000}, async t=>{
  const app=await startIsolatedApp();t.after(()=>app.close());t.beforeEach(()=>app.reset());
  async function req(path,token,body,method=body?'POST':'GET',headers={}){
    const r=await fetch(app.url+'/api'+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json().catch(()=>({})),headers:r.headers};
  }
  async function login(email,pass=TEST_PASSWORD,path='/auth/login'){const result=await req(path,null,{email,password:pass});assert.equal(result.status,200);return result.data.token;}
  async function setup(){
    const admin=await login(accounts.admin,TEST_PASSWORD,'/auth/admin/login');
    const created=await req('/admin/staff',admin,{name:'Product Staff',email:'products@test.invalid',phone:'0771234567',password,currentPassword:TEST_PASSWORD});assert.equal(created.status,201);
    const temp=await login('products@test.invalid',password,'/auth/staff/login');
    const changed=await req('/auth/staff/password',temp,{currentPassword:password,newPassword:personal});assert.equal(changed.status,200);
    return {admin,id:created.data.staff._id,token:changed.data.token};
  }
  const permission=(admin,id,value)=>req(`/admin/staff/${id}/product-permission`,admin,{currentPassword:TEST_PASSWORD,canEditProducts:value},'PATCH');
  const product=(token,id='prd_test_spice')=>req('/staff/products/'+id,token);
  await t.test('default denial, administrator reauthentication, per-person permission, revocation and privileged-field rejection',async()=>{
    const {admin,id,token}=await setup();
    assert.equal((await req('/staff/products',token)).status,403);
    assert.equal((await req('/staff/products/upload-image',token,{})).status,403);
    assert.equal((await permission(token,id,true)).status,403);
    assert.equal((await req(`/admin/staff/${id}/product-permission`,admin,{canEditProducts:true,currentPassword:'wrong'},'PATCH')).status,401);
    assert.equal((await permission(admin,id,true)).status,200);
    assert.equal((await req('/staff/products',token)).status,401);
    const editor=await login('products@test.invalid',personal,'/auth/staff/login');
    assert.equal((await req('/auth/me',editor)).data.user.canEditProducts,true);
    for(const productId of ['prd_test_spice','prd_test_lamp']){
      const p=(await product(editor,productId)).data.product;
      assert.equal(p.adminNote,undefined);assert.equal(p.sellerId,undefined);
      for(const key of ['approvalStatus','isFeatured','isDeal','sellerId','commissionRatePercent','soldCount','lastEditedBy','canEditProducts']){
        assert.equal((await req('/staff/products/'+productId,editor,{revision:p.revision,[key]:'forged'},'PUT')).status,400,key);
      }
      assert.equal((await req('/staff/products/'+productId,editor,null,'DELETE')).status,404);
      assert.equal((await req('/admin/products/'+productId,editor,{title:'forged'},'PUT')).status,403);
    }
    assert.equal((await req('/staff/products/upload-image',editor,{})).status,400);
    await permission(admin,id,false);assert.equal((await product(editor)).status,401);
    const limited=await login('products@test.invalid',personal,'/auth/staff/login');assert.equal((await product(limited)).status,403);
  });
  await t.test('validated edits work across sellers, are durably audited, and stale inventory edits are rejected',async()=>{
    const {admin,id}=await setup();await permission(admin,id,true);const editor=await login('products@test.invalid',personal,'/auth/staff/login');
    const p=(await product(editor)).data.product;
    const original=await app.mongo.collection('products').findOne({_id:p._id});
    const saved=await req('/staff/products/'+p._id,editor,{revision:p.revision,title:'Staff edited spice',priceLkr:1100,stock:90,
      variants:[{name:'Weight',values:[{label:'100 g',priceLkr:1100,stock:90}]}],images:['https://example.invalid/spice.png'],categorySlug:p.categorySlug},'PUT');
    assert.equal(saved.status,200);
    const stored=await app.mongo.collection('products').findOne({_id:p._id});assert.equal(stored.lastEditedById,id);assert.equal(stored.approvalStatus,original.approvalStatus);assert.equal(stored.sellerId,original.sellerId);
    assert.ok(await app.mongo.collection('securityevents').findOne({event:'STAFF_PRODUCT_EDITED',userId:id,'metadata.productId':p._id}));
    const stale=(await product(editor)).data.product;
    const checkout=await req('/orders/checkout',null,{items:[{productId:p._id,variantLabel:'100 g',quantity:1}],shippingAddress,paymentMethod:'COD',codConfirmedByCustomer:true},'POST',{'Idempotency-Key':randomUUID()});assert.equal(checkout.status,201);
    assert.equal((await req('/staff/products/'+p._id,editor,{revision:stale.revision,stock:90},'PUT')).status,409);
    assert.equal((await app.mongo.collection('products').findOne({_id:p._id})).stock,89);
    const current=(await product(editor)).data.product;
    assert.equal((await req('/staff/products/'+p._id,editor,{revision:current.revision,variants:[]},'PUT')).status,409);
    const lamp=(await product(editor,'prd_test_lamp')).data.product;
    assert.equal((await req('/staff/products/'+lamp._id,editor,{revision:lamp.revision,title:'Staff edited lamp'},'PUT')).status,200);
    const fresh=(await product(editor,'prd_test_lamp')).data.product;
    const races=await Promise.all(['A','B'].map(suffix=>req('/staff/products/'+fresh._id,editor,{revision:fresh.revision,description:'Concurrent '+suffix},'PUT')));
    assert.deepEqual(races.map(result=>result.status).sort(),[200,409]);
    await req('/orders/checkout',null,{items:[{productId:lamp._id,quantity:1}],shippingAddress,paymentMethod:'COD',codConfirmedByCustomer:true},'POST',{'Idempotency-Key':randomUUID()});
    const lampWithOrder=(await product(editor,lamp._id)).data.product;
    assert.equal((await req('/staff/products/'+lamp._id,editor,{revision:lampWithOrder.revision,variants:[{name:'Color',values:[{label:'Red',priceLkr:2000,stock:5}]}]},'PUT')).status,409);
    const published=await req('/marketplace/products/prd_test_lamp');assert.equal(published.data.product.title,'Staff edited lamp');
  });
  await t.test('malformed values and audit persistence failure cannot change product records; reads are bounded and indexed',async()=>{
    const {admin,id}=await setup();await permission(admin,id,true);const editor=await login('products@test.invalid',personal,'/auth/staff/login');
    const p=(await product(editor)).data.product;
    for(const patch of [{priceLkr:0},{stock:-1},{stock:1.5},{images:['javascript:alert(1)']},{variants:[{name:'Size',values:[{label:'x',priceLkr:10,stock:1},{label:'x',priceLkr:10,stock:2}]}]},{categorySlug:'missing'},{title:{'$ne':'x'}}]){
      assert.equal((await req('/staff/products/'+p._id,editor,{revision:p.revision,...patch},'PUT')).status,400);
    }
    await app.mongo.command({collMod:'securityevents',validator:{event:{$ne:'STAFF_PRODUCT_EDITED'}}});
    try{assert.ok((await req('/staff/products/'+p._id,editor,{revision:p.revision,title:'Must roll back'},'PUT')).status>=500);}finally{await app.mongo.command({collMod:'securityevents',validator:{}});}
    assert.equal((await app.mongo.collection('products').findOne({_id:p._id})).title,p.title);
    await app.mongo.collection('products').insertMany(Array.from({length:60},(_,i)=>({_id:`prd_extra_${String(i).padStart(3,'0')}`,title:'Extra',slug:`extra-${i}`,adminNote:'private'})));
    const bsonId=new mongoose.Types.ObjectId();await app.mongo.collection('products').insertOne({_id:bsonId,slug:'bson-product',title:'BSON Product'});
    const page=(await req('/staff/products',editor));assert.equal(page.data.products.length,25);assert.match(page.headers.get('cache-control'),/no-store/);assert.equal(page.data.products[0].adminNote,undefined);
    const next=(await req('/staff/products?before='+page.data.nextCursor,editor)).data;assert.ok(next.products.every(p=>!page.data.products.some(q=>q._id===p._id)));
    let cursor=page.data.nextCursor;const ids=page.data.products.map(product=>String(product._id));
    while(cursor){const result=(await req('/staff/products?before='+cursor,editor)).data;ids.push(...result.products.map(product=>String(product._id)));cursor=result.nextCursor;}
    assert.ok(ids.includes(String(bsonId)));assert.equal(new Set(ids).size,ids.length);
    const plan=await app.mongo.collection('products').find({}).sort({_id:1}).limit(26).explain('executionStats');assert.ok(plan.executionStats.totalDocsExamined<=26);
    const browser=await req('/auth/staff/login',null,{email:'products@test.invalid',password:personal},'POST',{'X-Yaans-Client':'browser'});
    const cookie=browser.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    assert.equal((await req('/staff/products/'+p._id,null,{revision:p.revision,title:'CSRF'},'PUT',{Cookie:cookie})).status,403);
  });
});
