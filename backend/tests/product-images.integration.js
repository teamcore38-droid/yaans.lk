import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD } from '../../tests/support/fixtures.js';

test('gallery writes retain ownership checks, validate every entry and persist image order', {timeout:180000}, async t => {
  const app=await startIsolatedApp(); t.after(()=>app.close());
  async function request(path, token, body, method='PUT') {
    const response=await fetch(app.url+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  }
  const seller=(await request('/auth/login',null,{email:accounts.seller,password:TEST_PASSWORD},'POST')).data.token;
  const admin=(await request('/auth/admin/login',null,{email:accounts.admin,password:TEST_PASSWORD},'POST')).data.token;
  const images=Array.from({length:8},(_,i)=>`https://example.com/product-${i}.jpg`);
  assert.equal((await request('/seller/products/prd_test_spice',seller,{images})).status,200);
  assert.equal((await request('/seller/products/prd_test_lamp',seller,{images})).status,403);
  for(const [path,token] of [['/seller/products/prd_test_spice',seller],['/admin/products/prd_test_spice',admin]]) {
    for(const invalid of [[],[...images,'/ninth.jpg'],['javascript:alert(1)'],{url:'/image.jpg'}]) {
      assert.equal((await request(path,token,{images:invalid})).status,400);
    }
    const reordered=[...images].reverse();
    assert.equal((await request(path,token,{images:reordered})).status,200);
    assert.deepEqual((await app.mongo.collection('products').findOne({_id:'prd_test_spice'})).images,reordered);
  }
  assert.equal((await request('/seller/products',seller,{title:'New gallery',description:'Test gallery',priceLkr:100,images:[...images,'/ninth.jpg']},'POST')).status,400);
  assert.equal((await request('/seller/products/bulk-import',seller,{items:[{title:'New gallery',description:'Test gallery',priceLkr:100,images:['javascript:alert(1)']}]},'POST')).status,400);

  // Exercise multipart, authentication, decoding and CDN handoff without real credentials or external writes.
  const original=cloudinary.uploader.upload_stream; const oldUrl=process.env.CLOUDINARY_URL;
  t.after(()=>{cloudinary.uploader.upload_stream=original;process.env.CLOUDINARY_URL=oldUrl;});
  process.env.CLOUDINARY_URL='cloudinary://test:test@isolated-test';
  let stored;
  cloudinary.uploader.upload_stream=(options, callback)=>new Writable({write(chunk,_encoding,done){stored=chunk;done();},final(done){callback(null,{secure_url:'https://res.cloudinary.com/isolated-test/image/upload/v1/test.webp',public_id:'test',format:'webp'});done();}});
  const input=await sharp({create:{width:1800,height:900,channels:3,background:'red'}}).png().toBuffer();
  const body=new FormData();body.append('image',new Blob([input],{type:'image/png'}),'product.png');
  const response=await fetch(app.url+'/api/seller/upload-image',{method:'POST',headers:{Authorization:`Bearer ${seller}`},body});
  assert.equal(response.status,201);assert.equal((await response.json()).provider,'cloudinary');
  const metadata=await sharp(stored).metadata();assert.equal(metadata.width,1600);assert.equal(metadata.format,'webp');
});
