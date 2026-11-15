import React, {useRef,useState} from 'react';
import {apiRequest,formatLkr} from '../utils/api.js';

export default function OrderDocuments({orderId,packageId,accessToken=''}) {
  const [documents,setDocuments]=useState(null),[selected,setSelected]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const dialog=useRef(null);
  const endpoint=`/documents/${packageId?'packages':'orders'}/${encodeURIComponent(packageId || orderId)}`;
  const headers=accessToken?{'X-Order-Access-Token':accessToken}:{};
  async function load(){setBusy(true);setError('');try{const result=await apiRequest(endpoint,{headers,cache:'no-store'});setDocuments(result.documents);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function view(doc){setBusy(true);setError('');try{const result=await apiRequest(`${endpoint}/${encodeURIComponent(doc._id)}`,{headers,cache:'no-store'});setSelected(result.document);dialog.current?.showModal();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function download(doc){setBusy(true);setError('');try{
    const response=await fetch(`${import.meta.env.VITE_API_URL || '/api'}${endpoint}/${encodeURIComponent(doc._id)}?format=pdf`,{credentials:'same-origin',headers:{'X-Yaans-Client':'browser',...headers}});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message || 'Document download failed.');}
    const blob=await response.blob();const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${doc.number}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section aria-label="Order documents" className="border rounded-lg p-3 space-y-3 text-sm">
    <button type="button" disabled={busy} onClick={load} className="font-bold text-sky-800 underline">{documents?'Refresh documents':'View invoices & documents'}</button>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {documents&&<ul className="space-y-3">{documents.map(doc=><li key={doc._id} className="flex flex-wrap gap-3 items-center"><span>{doc.title} {doc.packageNumber?`· ${doc.packageNumber}`:''}</span><button type="button" disabled={busy} onClick={()=>view(doc)} className="text-sky-800 underline" aria-label={`View ${doc.number}`}>View</button><button type="button" disabled={busy} onClick={()=>download(doc)} className="text-sky-800 underline" aria-label={`Download ${doc.number}`}>Download PDF / Print</button></li>)}</ul>}
    <dialog ref={dialog} onClose={()=>setSelected(null)} aria-label="Order document preview" className="rounded-xl p-0 max-w-3xl w-[95vw] max-h-[85vh] overflow-auto backdrop:bg-black/50">
      {selected&&<article>
        <header className="bg-[#791B20] text-white px-5 sm:px-7 py-5 border-b-4 border-[#F4BF43]">
          <div className="flex items-start justify-between gap-4"><img src="/brand/yaans-logo-horizontal-white.png" alt="Yaans.lk" className="w-32 sm:w-40 h-auto"/><button type="button" onClick={()=>dialog.current?.close()} className="text-xs border border-white/50 rounded px-2 py-1">Close document</button></div>
          <h2 className="text-xl font-bold mt-4">{selected.title}</h2><p className="text-xs text-white/80 mt-1 break-all">{selected.number}</p>
        </header>
        <div className="p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-600"><p>Issued {new Date(selected.issuedAt).toLocaleDateString('en-LK',{timeZone:'Asia/Colombo'})}</p><p>Order {selected.orderNumber}</p></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-4"><h3 className="text-xs font-bold uppercase text-[#791B20] mb-2">Issued by / seller</h3><p className="font-semibold">{selected.issuer.name}</p><p className="whitespace-pre-line text-slate-600">{selected.issuer.address}</p>{selected.issuer.phone&&<p className="text-slate-600">{selected.issuer.phone}</p>}</div>
            <div className="bg-slate-50 rounded-lg p-4"><h3 className="text-xs font-bold uppercase text-[#791B20] mb-2">Deliver to / customer</h3><p className="font-semibold">{selected.customer.recipientName}</p><p className="text-slate-600">{[selected.customer.addressLine1,selected.customer.addressLine2,selected.customer.city,selected.customer.district,selected.customer.postalCode].filter(Boolean).join(', ')}</p><p className="text-slate-600">{selected.customer.phone}</p></div>
          </div>
          {selected.legacy&&<p className="bg-amber-50 p-3 rounded text-xs">Historical copy from saved order records.</p>}
          {selected.kind==='invoice'&&<p className="bg-amber-50 p-3 rounded text-xs">Commercial invoice - not a tax invoice. Payment was pending at order placement.</p>}
          {selected.kind==='summary'&&<p className="bg-amber-50 p-3 rounded text-xs">Order summary. Payment was pending at order placement - pay on delivery.</p>}
          {selected.paymentStatus&&<p className="bg-emerald-50 text-emerald-800 p-3 rounded font-bold">{selected.paymentStatus}</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs text-left"><caption className="text-left font-bold mb-3 text-slate-800">{selected.kind==='packing-slip'?'Package contents':'Order items (LKR)'}</caption><thead className="bg-slate-800 text-white"><tr><th scope="col" className="p-3">Description</th><th scope="col" className="p-3 text-center">Qty</th>{selected.kind!=='packing-slip'&&<><th scope="col" className="p-3 text-right whitespace-nowrap">Unit price</th><th scope="col" className="p-3 text-right">Amount</th></>}</tr></thead><tbody>{selected.items.map((item,index)=><tr key={index} className="border-b even:bg-slate-50"><td className="p-3"><p className="font-semibold">{item.title}</p><p className="text-slate-500 mt-1">{[item.sku,item.variantLabel,selected.kind==='summary'?item.sellerName:''].filter(Boolean).join(' · ')}</p></td><td className="p-3 text-center">{item.quantity}</td>{selected.kind!=='packing-slip'&&<><td className="p-3 text-right whitespace-nowrap">{formatLkr(item.unitPriceLkr)}</td><td className="p-3 text-right whitespace-nowrap font-semibold">{formatLkr(item.lineTotalLkr)}</td></>}</tr>)}</tbody></table></div>
          {selected.kind!=='packing-slip'&&<div className="sm:ml-auto sm:w-72 bg-slate-50 rounded-lg overflow-hidden"><div className="p-4 space-y-2 text-sm"><p className="flex justify-between gap-4"><span>Items subtotal</span><span>{formatLkr(selected.subtotalLkr)}</span></p><p className="flex justify-between gap-4"><span>Delivery fee</span><span>{formatLkr(selected.deliveryLkr)}</span></p><p className="border-t pt-2 flex justify-between gap-4 font-bold"><span>Order total</span><span>{formatLkr(selected.totalLkr)}</span></p></div><div className={`${['receipt','refund'].includes(selected.kind)?'bg-emerald-800':'bg-[#791B20]'} text-white p-4`}><p className="text-xs uppercase">{selected.kind==='receipt'?'Payment received':selected.kind==='refund'?'Refund recorded':selected.kind==='cancellation'?'Original total':'Total (LKR)'}</p><p className="text-2xl font-bold mt-1 text-right">{formatLkr(selected.amountLkr ?? selected.totalLkr)}</p></div></div>}
          <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t"><p className="text-xs text-slate-500">Thank you for shopping with Yaans.lk.</p><button type="button" disabled={busy} onClick={()=>download(selected)} className="bg-slate-900 text-white rounded px-4 py-2 font-semibold">Download PDF / Print</button></div>
          <p className="text-xs text-slate-500">Open the downloaded PDF to print or save a copy.</p>
        </div>
      </article>}
    </dialog>
  </section>;
}
