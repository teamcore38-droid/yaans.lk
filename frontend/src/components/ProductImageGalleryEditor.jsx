import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../utils/api.js';
import { Pencil, Trash2, Star, ImagePlus, ArrowLeft, ArrowRight } from 'lucide-react';
import { imageUrl, imageSrcSet } from '../utils/images.js';

export default function ProductImageGalleryEditor({ images = [], onChange, endpoint, onBusyChange, disabled = false, onError }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [url, setUrl] = useState('');
  const alive = useRef(true), uploading = useRef(false), addInput = useRef(null), replaceInputs = useRef([]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusyChange?.(false); }; }, [onBusyChange]);
  async function upload(event, index = null) {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length || uploading.current || disabled) return;
    if (images.length > 8 || (index === null && images.length + files.length > 8)) { setError('A product can have up to eight images.'); return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024)) {
      setError('Choose JPG, PNG or WebP files up to 4 MB each.'); return;
    }
    uploading.current = true; setBusy(true); onBusyChange?.(true); setError('');
    let next = [...images];
    try {
      for (const file of files) {
        if (!alive.current) break;
        const body = new FormData(); body.append('image', file);
        const result = await apiRequest(endpoint, { method: 'POST', body });
        if (!alive.current) break;
        if (typeof result?.url !== 'string' || !result.url.trim()) throw new Error('Image upload returned no image URL. Please try again.');
        if (index === null) next = [...next, result.url]; else next[index] = result.url;
        onChange([...next]);
      }
    } catch (failure) { if (alive.current) { setError(failure.message); onError?.(failure); } }
    finally { uploading.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false); } }
  }
  function move(index, target) {
    const next = [...images]; const [image] = next.splice(index, 1); next.splice(target, 0, image); onChange(next);
  }
  function addUrl() {
    if (uploading.current || disabled || images.length >= 8) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || url.length > 2048) throw new Error();
      onChange([...images, url.trim()]); setUrl(''); setError('');
    } catch { setError('Enter a valid HTTPS image URL.'); }
  }
  return <fieldset disabled={busy || disabled} className="border rounded-lg p-3 space-y-3">
    <legend className="font-bold">Product images ({images.length}/8)</legend>
    <p className="text-xs text-slate-600">Use 3–5 photos showing different angles and details. The first image is the main photo. JPG, PNG or WebP, up to 4 MB each. Changes apply when you save the product.</p>
    {images.length > 8 && <p role="status">Your existing photos are preserved. Reduce the gallery to eight before adding or replacing photos.</p>}
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-3">
      {images.map((source, index) => <article key={`${index}:${source}`} aria-label={`Photo ${index + 1}`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 space-y-2">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
          <img src={imageUrl(source, 480)} srcSet={imageSrcSet(source, [240, 360, 480, 640])} sizes="auto, (max-width: 639px) 80vw, 240px" alt={`Product image ${index + 1}`} loading="lazy" decoding="async" className="w-full h-full object-contain" />
          {index === 0 && <span className="absolute top-2 left-2 rounded-md bg-emerald-800 px-2 py-1 text-xs font-bold text-white">Main image</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={images.length > 8} onClick={() => replaceInputs.current[index]?.click()} aria-label={`Edit image ${index + 1}`} className="min-h-11 inline-flex items-center justify-center gap-1 rounded-md border border-slate-400 px-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"><Pencil aria-hidden="true" className="w-4 h-4 shrink-0" />Edit</button>
          <button type="button" onClick={() => onChange(images.filter((_, i) => i !== index))} aria-label={`Remove image ${index + 1}`} className="min-h-11 inline-flex items-center justify-center gap-1 rounded-md border border-red-300 px-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 aria-hidden="true" className="w-4 h-4 shrink-0" />Remove</button>
        </div>
        <input ref={element => { replaceInputs.current[index] = element; }} aria-label={`Replace image ${index + 1}`} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={images.length > 8} onChange={event => upload(event, index)} />
        {index > 0 && <button type="button" onClick={() => move(index, 0)} aria-label={`Make image ${index + 1} main`} className="min-h-11 w-full inline-flex items-center justify-center gap-1 rounded-md border border-slate-400 px-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"><Star aria-hidden="true" className="w-4 h-4" />Make main</button>}
        <div role="group" aria-label={`Order photo ${index + 1}`} className="border-t border-slate-100 pt-2">
          <p className="text-[11px] font-medium text-slate-500">Photo {index + 1} - Change order</p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move image ${index + 1} earlier`} className="min-h-11 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-1 text-xs hover:bg-slate-50 disabled:opacity-40"><ArrowLeft aria-hidden="true" className="w-3 h-3 shrink-0" />Earlier</button>
            <button type="button" disabled={index === images.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move image ${index + 1} later`} className="min-h-11 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-1 text-xs hover:bg-slate-50 disabled:opacity-40">Later<ArrowRight aria-hidden="true" className="w-3 h-3 shrink-0" /></button>
          </div>
        </div>
      </article>)}
    </div>
    <input ref={addInput} aria-label="Add product images" className="hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={images.length >= 8} onChange={upload} />
    <button type="button" disabled={images.length >= 8} onClick={() => addInput.current?.click()} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white hover:bg-red-900 disabled:opacity-50"><ImagePlus aria-hidden="true" className="w-5 h-5" />Add photos</button>
    <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 basis-44">Image URL<input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="Or paste image URL..." className="block w-full min-h-11 border rounded p-2" disabled={images.length >= 8} /></label><button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50" disabled={!url || images.length >= 8} onClick={addUrl}>Add image URL</button></div>
    {busy && <p role="status">Uploading images…</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
  </fieldset>;
}
