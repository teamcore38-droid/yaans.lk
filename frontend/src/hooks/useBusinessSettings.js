import { useMemo, useEffect, useState } from 'react';
import { useBusinessConfiguration } from '../context/MarketplaceContext.jsx';
import { businessSettings } from '../../../shared/businessSettings.js';
export function useBusinessSettings() {
  const config = useBusinessConfiguration();
  return useMemo(() => businessSettings(config), [config]);
}

export function useAnnouncementVisibility(settings) {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    if(!settings.enabled)return;
    const boundary=[settings.startAt,settings.endAt].map(Date.parse).filter(time=>time>Date.now()).sort((a,b)=>a-b)[0];
    if(!boundary)return;
    const timer=setTimeout(()=>setNow(Date.now()),Math.min(boundary-Date.now()+10,2147483647));
    return()=>clearTimeout(timer);
  },[settings.enabled,settings.startAt,settings.endAt,now]);
  const current = Date.now();
  return settings.enabled && (!settings.startAt || current>=Date.parse(settings.startAt)) && (!settings.endAt || current<Date.parse(settings.endAt));
}
