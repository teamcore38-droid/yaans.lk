import React from 'react';
import { useBusinessSettings } from '../hooks/useBusinessSettings.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';
export function PolicySummary({ kind }) {
  const business=useBusinessSettings();const config=useMarketplace().businessConfig||{};
  return <section aria-label="Published business policy" className="bg-sky-50 border rounded-xl p-4 text-sm space-y-2">
    <p>Policy version {config.businessVersion||0}. {config.businessEffectiveAt?`Effective ${new Date(config.businessEffectiveAt).toLocaleDateString()}`:'Original policy'}. Existing orders retain their checkout policy.</p>
    {kind==='terms'&&<><p>{business.returns.enabled?`${business.returns.days}-day returns for eligible products, measured from recorded delivery. Category and product exceptions apply; see the order policy.`:'Standard returns are disabled; contact support for assistance.'}</p><p>Approved refund processing target: {business.returns.refundMinDays}-{business.returns.refundMaxDays} working days after approval and verified payment details.</p><p>Delivery estimates include seller preparation and destination transit time. See the destination-specific quote before checkout.</p><p>{business.pricing.taxMessage} Prices are in LKR. Cash on Delivery is the currently supported integration.</p></>}
    <p>Support: <a href={`mailto:${business.identity.supportEmail}`} className="underline">{business.identity.supportEmail}</a>. Privacy: <a href={`mailto:${business.identity.privacyEmail}`} className="underline">{business.identity.privacyEmail}</a>.</p>
  </section>;
}
export default function PublishedPolicy({ kind }) {
  const business=useBusinessSettings();
  return <div className="max-w-4xl mx-auto px-4 py-8 space-y-5"><h1 className="text-2xl font-bold">{kind==='terms'?'Terms & Conditions':kind==='privacy'?'Privacy Policy':'Cookie & Storage Policy'}</h1><PolicySummary kind={kind}/>{kind==='cookies'&&<button onClick={()=>{localStorage.removeItem('yaans_cookie_consent');window.dispatchEvent(new Event('yaans:reset-cookie-consent'));}} className="underline">Reset cookie preferences</button>}<article className="bg-white border rounded p-5 whitespace-pre-wrap">{business.legal[kind]}</article></div>;
}
