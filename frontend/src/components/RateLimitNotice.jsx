import React, { useEffect, useState } from 'react';

export default function RateLimitNotice() {
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const received = event => {
      const until=event.detail?.retryAt;
      if(!Number.isFinite(until) || until<=Date.now() || until>Date.now()+86400000)return;
      setDeadline(until);setSeconds(Math.ceil((until-Date.now())/1000));
    };
    window.addEventListener('yaans:rate-limited',received);
    return () => window.removeEventListener('yaans:rate-limited',received);
  },[]);
  useEffect(() => {
    if(!deadline)return;
    const timer=setInterval(()=>setSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000))),1000);
    return ()=>clearInterval(timer);
  },[deadline]);
  useEffect(()=>{if(seconds===0 && deadline)setDeadline(0);},[seconds,deadline]);
  if(!seconds)return null;
  return <aside role="status" aria-live="polite" className="bg-amber-100 text-amber-950 px-4 py-3 text-sm flex items-center justify-center gap-4">
    <span>Please wait {seconds} {seconds===1?'second':'seconds'} before retrying that action. You can continue browsing.</span>
    <button type="button" aria-label="Dismiss waiting message" onClick={()=>{setSeconds(0);setDeadline(0);}} className="font-bold underline">Dismiss</button>
  </aside>;
}
