import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../utils/api.js';
import { imageUrl } from '../utils/images.js';

export default function ProductImageGalleryEditor({ images = [], onChange, endpoint, onBusyChange, disabled = false, onError }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [url, setUrl] = useState('');
  const alive = useRef(true), uploading = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusyChange?.(false); }; }, [onBusyChange]);
  async function upload(event, index = null) {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length || uploading.current || disabled) return;
    if (index === null && images.length + files.length > 8) { setError('A product can have up to eight images.'); return; }
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{images.map((source, index) => <div key={`${index}:${source}`} className="border rounded p-2 space-y-2">
      <img src={imageUrl(source, 240)} alt={`Product image ${index + 1}`} loading="lazy" className="w-full h-24 object-contain" />
      <p className="text-xs font-bold">{index === 0 ? 'Main image' : `Image ${index + 1}`}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {index > 0 && <button type="button" onClick={() => move(index, 0)} aria-label={`Make image ${index + 1} main`}>Make main</button>}
        <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move image ${index + 1} earlier`}>Earlier</button>
        <button type="button" disabled={index === images.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move image ${index + 1} later`}>Later</button>
        <button type="button" onClick={() => onChange(images.filter((_, i) => i !== index))} aria-label={`Remove image ${index + 1}`}>Remove</button>
      </div>
      <label className="block text-xs">Replace image {index + 1}<input className="block w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp" disabled={images.length > 8} onChange={event => upload(event, index)} /></label>
    </div>)}</div>
    <label className="block">Add product images<input className="block w-full text-xs" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={images.length >= 8} onChange={upload} /></label>
    <div className="flex gap-2"><label className="flex-1">Image URL<input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="Or paste image URL..." className="block w-full border rounded p-2" disabled={images.length >= 8} /></label><button type="button" disabled={!url || images.length >= 8} onClick={addUrl}>Add image URL</button></div>
    {busy && <p role="status">Uploading images…</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
  </fieldset>;
}
