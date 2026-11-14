import { fileURLToPath } from 'node:url';

const assets = {
  NotoSans: fileURLToPath(new URL('../assets/fonts/NotoSans.ttf', import.meta.url)),
  NotoSansSinhala: fileURLToPath(new URL('../assets/fonts/NotoSansSinhala.ttf', import.meta.url)),
  NotoSansTamil: fileURLToPath(new URL('../assets/fonts/NotoSansTamil.ttf', import.meta.url))
};
const logo = fileURLToPath(new URL('../assets/brand/yaans-logo-horizontal-white.png', import.meta.url));
const palette = {brand:'#791B20', gold:'#F4BF43', ink:'#172438', muted:'#657184', line:'#E1E5EB', light:'#F6F7FA', green:'#176147', greenLight:'#EAF5EF', amberLight:'#FFF7E5', red:'#942C32'};
const headings = {invoice:'INVOICE', summary:'ORDER SUMMARY', 'packing-slip':'PACKING SLIP', receipt:'PAYMENT RECEIPT', refund:'REFUND CONFIRMATION', cancellation:'CANCELLATION'};
const segmenter = new Intl.Segmenter('en', {granularity:'grapheme'});

// PDF rendering and local artwork load only after the document access check.
// All positions and page breaks are bounded here; PDFKit never lays out untrusted HTML.
export async function documentPdf(doc) {
  const {default: PDFDocument} = await import('pdfkit');
  const pdf = new PDFDocument({size:'A4', margin:0, bufferPages:true, info:{Title:`${doc.title} ${doc.number}`, Author:'Yaans.lk'}});
  const chunks=[];
  const complete=new Promise((resolve,reject)=>{pdf.on('data',chunk=>chunks.push(chunk));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);});
  for(const [name,path] of Object.entries(assets)) pdf.registerFont(name,path);
  const W=pdf.page.width, H=pdf.page.height, M=42, CW=W-M*2, bottom=H-83;
  const packing=doc.kind==='packing-slip';
  const money=value=>Number(value).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2});
  const date=value=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Colombo'}).format(new Date(value));
  const runs=value=>String(value ?? '').split(/([\u0D80-\u0DFF\u200D]+|[\u0B80-\u0BFF]+)/).filter(Boolean);
  const font=(part,bold)=>/[\u0D80-\u0DFF]/.test(part)?'NotoSansSinhala':/[\u0B80-\u0BFF]/.test(part)?'NotoSansTamil':bold?'Helvetica-Bold':'NotoSans';
  const widths=new Map();
  function width(value,size,bold=false){
    const key=`${size}:${bold}:${value}`;
    if(!widths.has(key)) widths.set(key,runs(value).reduce((sum,part)=>sum+pdf.font(font(part,bold)).fontSize(size).widthOfString(part),0));
    return widths.get(key);
  }
  function lines(value,max,size,bold=false){
    const result=[];
    for(const paragraph of String(value ?? '').split('\n')){
      let line='';
      for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
        if(width(line?`${line} ${word}`:word,size,bold)<=max){line=line?`${line} ${word}`:word;continue;}
        if(line){result.push(line);line='';}
        if(width(word,size,bold)<=max){line=word;continue;}
        for(const {segment} of segmenter.segment(word)){
          if(line && width(line+segment,size,bold)>max){result.push(line);line='';}
          line+=segment;
        }
      }
      result.push(line);
    }
    return result;
  }
  const height=(value,max,size=9,bold=false)=>lines(value,max,size,bold).length*size*1.45;
  function text(value,x,y,max,{size=9,color=palette.ink,bold=false,align='left'}={}){
    for(const line of lines(value,max,size,bold)){
      let cursor=x+(align==='right'?max-width(line,size,bold):align==='center'?(max-width(line,size,bold))/2:0);
      for(const part of runs(line)){
        pdf.font(font(part,bold)).fontSize(size).fillColor(color).text(part,cursor,y,{lineBreak:false});
        cursor+=width(part,size,bold);
      }
      y+=size*1.45;
    }
    return y;
  }
  const rule=(x,y,w,color=palette.line)=>pdf.moveTo(x,y).lineTo(x+w,y).lineWidth(0.6).strokeColor(color).stroke();
  const box=(x,y,w,h,color)=>pdf.roundedRect(x,y,w,h,7).fill(color);
  function continuation(){
    pdf.addPage();
    pdf.rect(0,0,W,72).fill(palette.brand);
    pdf.image(logo,M,20,{width:115});
    text(headings[doc.kind] || doc.title,235,19,W-235-M,{size:12,bold:true,color:'#FFFFFF',align:'right'});
    text(doc.number,220,39,W-220-M,{size:7.5,color:'#F1DCDD',align:'right'});
    return 92;
  }
  function tableHeader(y){
    box(M,y,CW,29,palette.ink);
    text('DESCRIPTION',M+12,y+9,packing?CW-100:248,{size:8,bold:true,color:'#FFFFFF'});
    text('QTY',packing?M+CW-72:307,y+9,packing?60:40,{size:8,bold:true,color:'#FFFFFF',align:'center'});
    if(!packing){text('UNIT PRICE',347,y+9,90-12,{size:8,bold:true,color:'#FFFFFF',align:'right'});text('AMOUNT',437,y+9,W-M-437-12,{size:8,bold:true,color:'#FFFFFF',align:'right'});}
    return y+29;
  }

  pdf.rect(0,0,W,112).fill(palette.brand);
  pdf.rect(0,108,W,4).fill(palette.gold);
  pdf.image(logo,M,27,{width:155});
  text('SRI LANKAN MARKETPLACE',M,82,220,{size:7.5,color:'#F4DDDE'});
  text(headings[doc.kind] || doc.title,230,28,W-M-230,{size:doc.kind==='refund'?18:22,bold:true,color:'#FFFFFF',align:'right'});
  text(doc.number,220,65,W-M-220,{size:8,color:'#FAE7E7',align:'right'});
  text(doc.kind==='invoice'?'COMMERCIAL INVOICE':doc.title.toUpperCase(),220,84,W-M-220,{size:7,color:'#F4BF43',align:'right'});

  const meta=[['DOCUMENT DATE',date(doc.issuedAt)],['ORDER NUMBER',doc.orderNumber],['SELLER PACKAGE',doc.packageNumber || 'All seller shipments']];
  const metaW=CW/3;
  let metaHeight=0;
  meta.forEach(([label,value],i)=>{
    const x=M+i*metaW;
    text(label,x,133,metaW-12,{size:7,bold:true,color:palette.muted});
    text(value,x,149,metaW-12,{size:9,bold:true});
    metaHeight=Math.max(metaHeight,height(value,metaW-12,9,true));
  });
  let y=149+metaHeight+19;
  const status=doc.kind==='receipt'?'Payment collection recorded':doc.kind==='refund'?'Refund recorded':doc.kind==='cancellation'?'Order package cancelled':packing?'Prepared for seller fulfilment':'Payment pending at order placement - pay on delivery';
  const positive=['receipt','refund'].includes(doc.kind);
  const statusColor=positive?palette.green:doc.kind==='cancellation'?palette.red:palette.brand;
  box(M,y,CW,32,positive?palette.greenLight:palette.amberLight);
  pdf.circle(M+14,y+16,3).fill(statusColor);
  text(status,M+26,y+9,CW-40,{size:8.5,bold:true,color:statusColor});
  y+=51;
  const cardW=(CW-16)/2;
  const issuer=[doc.issuer.name,doc.issuer.address,doc.issuer.phone].filter(Boolean).join('\n');
  const address=doc.customer;
  const recipient=[address.recipientName,address.addressLine1,address.addressLine2,[address.city,address.district,address.postalCode].filter(Boolean).join(', '),address.phone].filter(Boolean).join('\n');
  const cardH=Math.max(height(issuer,cardW-28),height(recipient,cardW-28))+48;
  for(const [i,label,value] of [[0,doc.packageNumber?'ISSUED BY / SELLER':'MARKETPLACE',issuer],[1,'DELIVER TO / CUSTOMER',recipient]]){
    const x=M+i*(cardW+16);
    box(x,y,cardW,cardH,palette.light);
    text(label,x+14,y+14,cardW-28,{size:7,bold:true,color:palette.brand});
    text(value,x+14,y+32,cardW-28,{size:9});
  }
  y+=cardH+22;
  text(packing?'PACKAGE CONTENTS':'ORDER ITEMS',M,y,CW,{size:9,bold:true});
  if(!packing)text('All amounts in LKR',M,y,CW,{size:8,color:palette.muted,align:'right'});
  y+=22;
  if(y+90>bottom)y=continuation();
  let needsTableHeader=true;
  for(const [index,item] of doc.items.entries()){
    const details=[item.sku?`SKU: ${item.sku}`:'',item.variantLabel || 'Standard',doc.kind==='summary'?item.sellerName:''].filter(Boolean).join('  |  ');
    const descW=packing?CW-111:241;
    const titleH=height(item.title,descW,9.5);
    const detailH=height(details,descW,7.5);
    const amountW=W-M-437-20;
    const rowH=Math.max(titleH+detailH+22,height(String(item.quantity),packing?60:40,9)+22,packing?0:height(money(item.lineTotalLkr),amountW,9)+22,packing?0:height(money(item.unitPriceLkr),70,8.5)+22);
    const endingSpace=index===doc.items.length-1 ? (packing?145:180) : 0;
    if(y+rowH+endingSpace+(needsTableHeader?29:0)>bottom){y=continuation();needsTableHeader=true;}
    if(needsTableHeader){y=tableHeader(y);needsTableHeader=false;}
    if(index%2===0)pdf.rect(M,y,CW,rowH).fill('#F7F8FA');
    text(item.title,M+12,y+11,descW,{size:9.5});
    text(details,M+12,y+11+titleH+3,descW,{size:7.5,color:palette.muted});
    text(item.quantity,packing?M+CW-72:307,y+12,packing?60:40,{size:9,align:'center'});
    if(!packing){text(money(item.unitPriceLkr),347,y+12,78,{size:8.5,align:'right'});text(money(item.lineTotalLkr),437,y+12,W-M-437-12,{size:9,bold:true,align:'right'});}
    y+=rowH;rule(M,y,CW);
  }
  y+=23;
  const note=doc.legacy?'Historical copy based on saved order records. Seller details were not captured at checkout.':doc.kind==='invoice'?'This commercial invoice is not a tax invoice. Prices and seller details reflect the order at purchase.':doc.kind==='receipt'?'Payment collection has been recorded. This receipt does not indicate that the seller payout is complete.':doc.kind==='refund'?'The recorded refund is shown here. The original invoice and payment record remain available separately.':doc.kind==='cancellation'?'This confirms cancellation of this package. The total shown is the original order value, not an amount due.':packing?'Check the quantities before sealing this package. Refer to the commercial invoice for payment amounts.':'This summary combines the seller packages in your order. Each seller invoice is available separately.';
  if(packing){
    const notes=[note,address.deliveryNotes?`Delivery notes: ${address.deliveryNotes}`:''].filter(Boolean).join('\n\n');
    const panelH=height(notes,CW-28,8)+79;
    if(y+panelH>bottom)y=continuation();
    box(M,y,CW,panelH,palette.light);
    text(`TOTAL QUANTITY: ${doc.items.reduce((sum,item)=>sum+Number(item.quantity),0)}`,M+14,y+14,CW-28,{size:10,bold:true});
    text(notes,M+14,y+38,CW-28,{size:8,color:palette.muted});
    text('Packed by: ____________________     Date: ____________________',M+14,y+panelH-25,CW-28,{size:8,color:palette.muted});
  }else{
    const notesW=232, totalsX=318, totalsW=W-M-totalsX;
    const totalsH=157;
    if(y+Math.max(totalsH,height(note,notesW,8)+56)>bottom)y=continuation();
    text(doc.kind==='invoice'?'INVOICE NOTES':'DOCUMENT NOTES',M,y+3,notesW,{size:8,bold:true,color:palette.brand});
    text(note,M,y+23,notesW,{size:8,color:palette.muted});
    text(`Payment method: ${doc.paymentMethod || 'COD'}`,M,y+30+height(note,notesW,8),notesW,{size:8,bold:true});
    box(totalsX,y,totalsW,totalsH,palette.light);
    text('Items subtotal',totalsX+14,y+14,110,{size:8.5,color:palette.muted});
    text(money(doc.subtotalLkr),totalsX+115,y+14,totalsW-129,{size:9,align:'right'});
    text('Delivery fee',totalsX+14,y+37,110,{size:8.5,color:palette.muted});
    text(money(doc.deliveryLkr),totalsX+115,y+37,totalsW-129,{size:9,align:'right'});
    rule(totalsX+14,y+61,totalsW-28);
    text('Order total',totalsX+14,y+72,110,{size:9,bold:true});
    text(money(doc.totalLkr),totalsX+115,y+72,totalsW-129,{size:9,bold:true,align:'right'});
    box(totalsX,y+99,totalsW,58,positive?palette.green:palette.brand);
    const label=doc.kind==='receipt'?'PAYMENT RECEIVED (LKR)':doc.kind==='refund'?'REFUND RECORDED (LKR)':doc.kind==='cancellation'?'ORIGINAL TOTAL (LKR)':'TOTAL (LKR)';
    text(label,totalsX+14,y+110,totalsW-28,{size:7,bold:true,color:positive?'#E1F2E8':'#F4DCA1'});
    const total=money(doc.amountLkr ?? doc.totalLkr);
    const totalSize=Math.min(19,19*(totalsW-28)/Math.max(width(total,19,true),1));
    text(total,totalsX+14,y+126,totalsW-28,{size:totalSize,bold:true,color:'#FFFFFF',align:'right'});
  }
  const pages=pdf.bufferedPageRange();
  for(let index=pages.start;index<pages.start+pages.count;index++){
    pdf.switchToPage(index);
    rule(M,H-57,CW);
    text('Thank you for shopping with Yaans.lk',M,H-44,CW-95,{size:8,bold:true,color:palette.brand});
    text('Saved order records | yaans.lk',M,H-30,CW-95,{size:6.5,color:palette.muted});
    text(`Page ${index+1} of ${pages.count}`,M,H-40,CW,{size:7,color:palette.muted,align:'right'});
  }
  pdf.end();return complete;
}
