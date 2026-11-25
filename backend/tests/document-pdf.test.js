import assert from 'node:assert/strict';
import {test} from 'node:test';
import {documentPdf} from '../src/services/documentPdf.js';
import {adminOrderUrl} from '../src/services/adminOrderQr.js';

const invoice={kind:'invoice',title:'Commercial invoice',number:'YLK-2026-1001-S1-INVOICE',orderNumber:'YLK-2026-1001',packageNumber:'YLK-2026-1001-S1',issuedAt:'2026-11-14T18:45:00Z',paymentMethod:'COD',issuer:{name:'Local Seller',address:'12 Market Road, Colombo',phone:'0771234567'},customer:{recipientName:'Customer',addressLine1:'24 Lake Road',city:'Kandy',district:'Kandy'},items:[{title:'Handwoven basket / සිංහල / தமிழ்',sku:'BASKET-01',variantLabel:'Natural / Large',quantity:2,unitPriceLkr:1500,lineTotalLkr:3000}],subtotalLkr:3000,deliveryLkr:350,totalLkr:3350};
const pages=buffer=>(buffer.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;

test('admin order links stay within their deployment environment',()=>{
  assert.equal(adminOrderUrl('ord_ab-12',{VERCEL_ENV:'production'}),'https://yaans.lk/admin/orders/ord_ab-12');
  assert.equal(adminOrderUrl('ord_ab-12',{VERCEL_ENV:'production',APP_ENV:'staging'}),'https://yaans-lk-staging.vercel.app/admin/orders/ord_ab-12');
  assert.equal(adminOrderUrl('ord_ab-12',{VERCEL_ENV:'preview',APP_ENV:'staging',VERCEL_URL:'branch-test.vercel.app'}),'https://branch-test.vercel.app/admin/orders/ord_ab-12');
  assert.equal(adminOrderUrl('ord_ab-12',{VERCEL_ENV:'preview',VERCEL_URL:'branch-test.vercel.app.example.org'}),null);
  assert.equal(adminOrderUrl('//example.org',{VERCEL_ENV:'production'}),null);
});

test('an admin payment receipt has a clickable QR and fits on a single page',async()=>{
  const orderUrl=adminOrderUrl('ord_01234567-89ab-cdef-0123-456789abcdef',{APP_ENV:'staging'});
  const pdf=await documentPdf({...invoice,kind:'receipt',title:'Payment receipt'}, {orderUrl});
  assert.equal(pages(pdf),1);
  assert.ok(pdf.includes(Buffer.from(orderUrl)));
  assert.ok(pdf.length<100000);
});

test('branded invoice embeds local logo/fonts and keeps a normal order on one page',async()=>{
  const before=structuredClone(invoice);
  const buffer=await documentPdf(invoice);
  assert.equal(buffer.subarray(0,4).toString(),'%PDF');
  assert.equal(pages(buffer),1);
  assert.match(buffer.toString('latin1'),/\/Subtype \/Image/);
  assert.ok(buffer.length<100000);
  assert.deepEqual(invoice,before,'Rendering must not change saved invoice data');
});

test('large multilingual invoices paginate within the download limit',async()=>{
  const items=Array.from({length:100},(_,i)=>({...invoice.items[0],title:`${i+1}. ${invoice.items[0].title} - carefully crafted natural home accessories`,sku:'SKU-'+String(i).padStart(6,'0'),variantLabel:'Large gift set with extra accessories'}));
  const buffer=await documentPdf({...invoice,items,subtotalLkr:300000,totalLkr:300350});
  assert.ok(pages(buffer)>1);
  assert.ok(pages(buffer)<20,'Pagination must not produce blank pages for each text fragment');
  assert.ok(buffer.length<4*1024*1024,'Documents must fit serverless response limits');
});

test('receipt, refund, packing and cancellation layouts handle long addresses and totals',async()=>{
  for(const [kind,title] of [['receipt','Payment receipt'],['refund','Refund confirmation'],['packing-slip','Packing slip'],['cancellation','Cancellation confirmation'],['summary','Order summary']]){
    const buffer=await documentPdf({...invoice,kind,title,number:`YLK-2026-1001-S1-${kind.toUpperCase()}`,issuer:{name:'Seller '.repeat(10),address:'Long business address '.repeat(10)},customer:{...invoice.customer,addressLine2:'Long delivery directions '.repeat(8)},amountLkr:1234567890.12,totalLkr:1234567890.12});
    assert.ok(pages(buffer)>=1 && pages(buffer)<=3,kind);
    assert.ok(buffer.length<200000,kind);
  }
});
