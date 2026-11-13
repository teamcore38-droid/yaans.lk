import { fileURLToPath } from 'node:url';
// Loaded only for an authorized download. No PDF code enters the checkout/browser bundle.
export async function documentPdf(doc) {
  const {default: PDFDocument}=await import('pdfkit');
  const pdf=new PDFDocument({size:'A4',margin:45,info:{Title:`${doc.title} ${doc.number}`,Author:'Yaans.lk'}});
  const chunks=[];const complete=new Promise((resolve,reject)=>{pdf.on('data',chunk=>chunks.push(chunk));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);});
  const fonts = Object.fromEntries(['NotoSans','NotoSansSinhala','NotoSansTamil'].map(name=>[name,fileURLToPath(new URL(`../assets/fonts/${name}.ttf`,import.meta.url))]));
  for (const [name,path] of Object.entries(fonts)) pdf.registerFont(name,path);
  const money=n=>`LKR ${Number(n).toFixed(2)}`;
  const text=(value,size=10)=>{
    const parts=String(value ?? '').split(/([\u0D80-\u0DFF]+|[\u0B80-\u0BFF]+)/).filter(Boolean);
    pdf.fontSize(size);
    parts.forEach((part,index)=>pdf.font(/[\u0D80-\u0DFF]/.test(part)?'NotoSansSinhala':/[\u0B80-\u0BFF]/.test(part)?'NotoSansTamil':'NotoSans').text(part,{width:500,continued:index<parts.length-1}));
    pdf.moveDown(0.5);
  };
  text('Yaans.lk',20);text(doc.title,17);text(doc.number);text(`Issued: ${new Date(doc.issuedAt).toISOString().slice(0,10)}`);
  text(`Order: ${doc.orderNumber}${doc.packageNumber?` / ${doc.packageNumber}`:''}`);
  text(`Issuer: ${doc.issuer.name}`);if(doc.issuer.address)text(doc.issuer.address);if(doc.issuer.phone)text(doc.issuer.phone);
  text('Deliver to',12);
  const address=doc.customer;
  text([address.recipientName,address.addressLine1,address.addressLine2,address.city,address.district,address.postalCode,address.phone].filter(Boolean).join('\n'));
  if(doc.legacy)text('Historical copy from saved order records. Issuer details were not captured at checkout.');
  if(doc.kind==='invoice')text('Commercial invoice. Not a tax invoice. Payment was pending at order placement.');
  if(doc.kind==='summary')text('Order summary across sellers. Payment pending at order placement - pay on delivery.');
  if(doc.paymentStatus)text(doc.paymentStatus,12);
  text('Items',12);
  for(const item of doc.items){
    text(`${item.title}\n${item.sellerName || ''} | ${item.sku || ''} | ${item.variantLabel || 'Standard'} | Quantity: ${item.quantity}`);
    if(doc.kind!=='packing-slip')text(`${money(item.unitPriceLkr)} each | ${money(item.lineTotalLkr)}`);
  }
  if(doc.kind!=='packing-slip'){
    text(`Items subtotal: ${money(doc.subtotalLkr)}`);text(`Delivery: ${money(doc.deliveryLkr)}`);text(`Total: ${money(doc.totalLkr)}`,13);
    if(doc.amountLkr!==undefined)text(`${doc.kind==='refund'?'Refund':'Payment'} amount: ${money(doc.amountLkr)}`,12);
  }else text(`Payment method: ${doc.paymentMethod}. Refer to the invoice for amounts.`);
  pdf.end();return complete;
}
