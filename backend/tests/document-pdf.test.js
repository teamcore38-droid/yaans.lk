import assert from 'node:assert/strict';
import {test} from 'node:test';
import {documentPdf} from '../src/services/documentPdf.js';

const invoice={kind:'invoice',title:'Commercial invoice',number:'YLK-2026-1001-S1-INVOICE',orderNumber:'YLK-2026-1001',packageNumber:'YLK-2026-1001-S1',issuedAt:'2026-11-14T18:45:00Z',paymentMethod:'COD',issuer:{name:'Local Seller',address:'12 Market Road, Colombo',phone:'0771234567'},customer:{recipientName:'Customer',addressLine1:'24 Lake Road',city:'Kandy',district:'Kandy'},items:[{title:'Handwoven basket / සිංහල / தமிழ்',sku:'BASKET-01',variantLabel:'Natural / Large',quantity:2,unitPriceLkr:1500,lineTotalLkr:3000}],subtotalLkr:3000,deliveryLkr:350,totalLkr:3350};
const pages=buffer=>(buffer.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;

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
