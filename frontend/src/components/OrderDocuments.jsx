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
    <dialog ref={dialog} onClose={()=>setSelected(null)} className="rounded-xl p-5 max-w-3xl w-[95vw] max-h-[85vh] overflow-auto backdrop:bg-black/50">
      {selected&&<article className="space-y-3">
        <div className="flex justify-between gap-4"><h2 className="text-lg font-bold">{selected.title}</h2><button type="button" onClick={()=>dialog.current?.close()}>Close document</button></div>
        <p>{selected.number} · {new Date(selected.issuedAt).toLocaleDateString('en-LK')}</p>
        <p><strong>{selected.issuer.name}</strong><br/>{selected.issuer.address}</p>
        <p>{selected.customer.recipientName}<br/>{[selected.customer.addressLine1,selected.customer.addressLine2,selected.customer.city,selected.customer.district].filter(Boolean).join(', ')}</p>
        {selected.legacy&&<p>Historical copy from saved order records.</p>}
        {selected.kind==='invoice'&&<p>Commercial invoice — not a tax invoice. Payment was pending at order placement.</p>}
        {selected.kind==='summary'&&<p>Order summary. Payment was pending at order placement — pay on delivery.</p>}
        {selected.paymentStatus&&<p className="font-bold">{selected.paymentStatus}</p>}
        <ul>{selected.items.map((item,index)=><li key={index} className="border-b py-2">{item.title} · {item.variantLabel} × {item.quantity}{selected.kind!=='packing-slip'&&` · ${formatLkr(item.lineTotalLkr)}`}</li>)}</ul>
        {selected.kind!=='packing-slip'&&<p>Items: {formatLkr(selected.subtotalLkr)} · Delivery: {formatLkr(selected.deliveryLkr)}<br/><strong>Total: {formatLkr(selected.totalLkr)}</strong>{selected.amountLkr!==undefined&&<><br/>Recorded amount: {formatLkr(selected.amountLkr)}</>}</p>}
        <button type="button" disabled={busy} onClick={()=>download(selected)} className="bg-slate-900 text-white rounded p-2">Download PDF / Print</button>
        <p className="text-xs text-slate-600">Open the downloaded PDF to print or save a copy.</p>
      </article>}
    </dialog>
  </section>;
}
