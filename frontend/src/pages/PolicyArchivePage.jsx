import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../utils/api.js';
export default function PolicyArchivePage(){
  const {version,kind}=useParams();const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;setData(null);setError('');apiRequest(`/marketplace/policies/${encodeURIComponent(version)}`).then(result=>{if(active)setData(result);}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[version]);
  if(error)return <p role="alert" className="p-8">{error}</p>;
  if(!data)return <p role="status" className="p-8">Loading published policy...</p>;
  if(!['terms','privacy','cookies'].includes(kind))return <p role="alert">Policy page not found.</p>;
  const settings=data.settings;
  return <div className="max-w-4xl mx-auto p-6 space-y-4"><h1 className="text-2xl font-bold">Published {kind} policy - version {data.version}</h1><p>{data.effectiveAt?`Effective ${new Date(data.effectiveAt).toLocaleDateString()}`:'Original policy'}</p><p>{settings.returns.enabled?`${settings.returns.days}-day returns for eligible items; product and category exceptions apply.`:'Standard returns disabled.'} Approved refund processing target: {settings.returns.refundMinDays}-{settings.returns.refundMaxDays} working days.</p><p>{settings.pricing.taxMessage} Delivery timing follows the destination quote and preparation time recorded at checkout.</p><article className="whitespace-pre-wrap bg-white border p-5">{settings.legal[kind]||'The built-in policy applied together with the operational settings shown here. Refer to your order for item-specific return eligibility, shipping fees and cancellation conditions.'}</article><p>Contact: {settings.identity.supportEmail}</p></div>;
}
