import React,{useState} from 'react';
import {apiRequest} from '../../utils/api.js';
export default function OrderEmailStatus(){
  const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function check(retry=false){setBusy(true);setError('');try{if(retry)await apiRequest('/documents/retry-emails',{method:'POST',body:'{}'});setStatus(await apiRequest('/documents/email-status',{cache:'no-store'}));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section aria-label="Order confirmation emails" className="bg-white border rounded-xl p-4 space-y-2 text-sm"><h2 className="font-bold">Order confirmation emails</h2><button disabled={busy} onClick={()=>check()} className="text-sky-800 underline">Check email delivery status</button>{error&&<p role="alert">{error}</p>}{status&&<><p role="status">{status.ready?'Sending enabled':'Email setup required — confirmations remain queued.'}</p><p>Queued: {status.counts.pending||0} · Processing: {status.counts.processing||0} · Accepted by provider: {status.counts.sent||0} · Needs review: {status.counts.attention||0}</p><button disabled={busy||!status.ready} onClick={()=>check(true)} className="text-sky-800 underline">Process queued emails</button></>}</section>;
}
