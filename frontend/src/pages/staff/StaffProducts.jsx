import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, formatLkr } from '../../utils/api.js';
export default function StaffProducts({ expire }) {
  const [data,setData] = useState({ products: [], nextCursor: null });
  const [form,setForm] = useState(null), [categories,setCategories] = useState([]);
  const [error,setError] = useState(''), [message,setMessage] = useState(''), [busy,setBusy] = useState(false);
  const version = useRef(0), alive = useRef(true);
  const fail = useCallback(error => { if ([401,403].includes(error.status)) expire(); else setError(error.message); }, [expire]);
  const load = useCallback(async (before='') => {
    const current=++version.current; setForm(null); setError('');
    try { const result=await apiRequest(`/staff/products${before ? `?before=${encodeURIComponent(before)}` : ''}`); if (alive.current && current===version.current) setData(result); }
    catch(error) { if(alive.current && current===version.current) fail(error); }
  },[fail]);
  useEffect(()=>{ alive.current=true; load(); return()=>{alive.current=false;version.current++;}; },[load]);
  async function edit(id) {
    const current=++version.current;setForm(null);setError('');setMessage('');
    try {const result=await apiRequest(`/staff/products/${encodeURIComponent(id)}`);if(alive.current && current===version.current){setForm(result.product);setCategories(result.categories);}}
    catch(error){if(alive.current && current===version.current)fail(error);}
  }
  async function save(event) {
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    const {_id,sellerName,...payload}=form;
    try {const result=await apiRequest(`/staff/products/${encodeURIComponent(_id)}`,{method:'PUT',body:JSON.stringify(payload)});if(alive.current){setMessage(result.message);await load();}}
    catch(error){if(alive.current)fail(error);}
    finally{if(alive.current)setBusy(false);}
  }
  async function upload(event) {
    const file=event.target.files?.[0];if(!file||busy)return;setBusy(true);setError('');
    const current=version.current;const body=new FormData();body.append('image',file);
    try{const result=await apiRequest('/staff/products/upload-image',{method:'POST',body});if(alive.current&&current===version.current)setForm(previous=>({...previous,images:[...(previous.images||[]),result.url].slice(0,10)}));}
    catch(error){if(alive.current)fail(error);}finally{if(alive.current)setBusy(false);}
  }
  const text=(key,label,multiline=false)=><label className="block">{label}{multiline?<textarea className="block w-full border rounded p-2" required value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}/>:<input className="block w-full border rounded p-2" required value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>;
  const numeric=(key,label,nullable=false)=><label className="block">{label}<input className="block w-full border rounded p-2" type="number" min={key==='stock'?0:0.01} step={key==='stock'?1:0.01} required={!nullable} value={form[key]??''} onChange={e=>setForm({...form,[key]:nullable&&e.target.value===''?null:Number(e.target.value)})}/></label>;
  function optionChange(groupIndex,optionIndex,key,value){setForm(previous=>({...previous,variants:previous.variants.map((group,i)=>i!==groupIndex?group:{...group,values:group.values.map((option,j)=>j!==optionIndex?option:{...option,[key]:value})})}));}
  return <section aria-label="Staff products" className="space-y-4"><h2 className="text-xl font-bold">Seller products</h2>
    <p className="text-sm">Edit listing details and inventory. Publication decisions and deletion remain with administrators.</p>
    {error&&<p role="alert" className="text-red-700">{error}</p>}{message&&<p role="status" className="text-emerald-800">{message}</p>}
    <div className="flex gap-4"><button disabled={busy} onClick={()=>load()}>Refresh products</button>{data.nextCursor&&<button disabled={busy} onClick={()=>load(data.nextCursor)}>More products</button>}</div>
    <div className="grid md:grid-cols-2 gap-3">{data.products.map(product=><article key={product._id} className="bg-white border rounded p-4"><h3 className="font-bold">{product.title}</h3><p>{product.sellerName} · {product.sku} · {formatLkr(product.priceLkr)} · Stock: {product.stock}</p><button disabled={busy} className="text-sky-800 underline" onClick={()=>edit(product._id)}>Edit {product.title}</button></article>)}</div>
    {form&&<form aria-label="Edit seller product" onSubmit={save} className="bg-white border rounded-xl p-5 space-y-3">
      <h3 className="font-bold">Edit product · {form.sellerName}</h3>
      {text('title','Product title')}{text('sku','SKU')}{text('description','Description',true)}
      <label className="block">Category<select className="block border p-2 w-full" value={form.categorySlug} onChange={e=>setForm({...form,categorySlug:e.target.value,subCategorySlug:''})}>{categories.map(category=><option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>
      <label className="block">Subcategory<input className="block border p-2 w-full" value={form.subCategorySlug||''} onChange={e=>setForm({...form,subCategorySlug:e.target.value})}/></label>
      <label className="block">Highlights (one per line)<textarea className="block border p-2 w-full" value={(form.highlights||[]).join('\n')} onChange={e=>setForm({...form,highlights:e.target.value.split('\n')})}/></label>
      {numeric('priceLkr','Price (LKR)')}{numeric('compareAtPriceLkr','Compare price (LKR)',true)}{numeric('stock','Stock')}
      <label className="block">Image URLs (one per line)<textarea className="block border p-2 w-full" required value={(form.images||[]).join('\n')} onChange={e=>setForm({...form,images:e.target.value.split('\n')})}/></label>
      <label className="block">Upload product image<input className="block" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={busy} onChange={upload}/></label>
      {(form.variants||[]).map((group,i)=><fieldset key={i} className="border p-3 space-y-2"><legend>Variant group {i+1}</legend><label>Group name<input className="border p-2" required value={group.name} onChange={e=>setForm({...form,variants:form.variants.map((g,j)=>j===i?{...g,name:e.target.value}:g)})}/></label>
        {group.values.map((option,j)=><div key={j} className="flex flex-wrap gap-2"><label>Option label<input className="border p-2" required value={option.label} onChange={e=>optionChange(i,j,'label',e.target.value)}/></label><label>Option price<input className="border p-2" type="number" required min="0.01" step="0.01" value={option.priceLkr} onChange={e=>optionChange(i,j,'priceLkr',Number(e.target.value))}/></label><label>Option stock<input className="border p-2" type="number" required min="0" step="1" value={option.stock} onChange={e=>optionChange(i,j,'stock',Number(e.target.value))}/></label><button type="button" onClick={()=>setForm({...form,variants:form.variants.map((g,k)=>k===i?{...g,values:g.values.filter((_,k)=>k!==j)}:g)})}>Remove option</button></div>)}
        <button type="button" onClick={()=>setForm({...form,variants:form.variants.map((g,j)=>j===i?{...g,values:[...g.values,{label:'',priceLkr:form.priceLkr,stock:0}]}:g)})}>Add option</button><button type="button" onClick={()=>setForm({...form,variants:form.variants.filter((_,j)=>j!==i)})}>Remove group</button>
      </fieldset>)}
      <button type="button" onClick={()=>setForm({...form,variants:[...(form.variants||[]),{name:'',values:[{label:'',priceLkr:form.priceLkr,stock:0}]}]})}>Add variant group</button>
      <div className="flex gap-4"><button disabled={busy} className="bg-slate-900 text-white rounded px-4 py-2">Save product changes</button><button type="button" disabled={busy} onClick={()=>{version.current++;setForm(null);}}>Cancel</button></div>
    </form>}
  </section>;
}
