import { useBusinessConfiguration } from '../context/MarketplaceContext.jsx';
import { useBusinessSettings } from '../hooks/useBusinessSettings.js';
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, Banknote, Store, Scale, Cookie } from 'lucide-react';

export default function Footer() {
  const business = useBusinessSettings();
  const runtime = useBusinessConfiguration();
  return (
    <footer className="bg-white border-t border-slate-200 mt-12 pb-16 md:pb-0">
      {/* Practical Marketplace Value Strip */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">All 25 SL Districts</div>
              <div className="text-xs text-slate-600">Transparent per-seller courier rates</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">{runtime.codEnabledGlobally === false ? 'COD temporarily unavailable' : 'Cash on Delivery (COD)'}</div>
              <div className="text-xs text-slate-600">Pay in LKR (Rs.) when package arrives</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">{business.trust.localTitle}</div>
              <div className="text-xs text-slate-600">{business.trust.localDescription}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">{business.trust.marketplaceTitle}</div>
              <div className="text-xs text-slate-600">{business.trust.marketplaceDescription}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 text-sm">
        <div>
          <img
            src={business.identity.logo}
            alt="Yaans.lk"
            className="h-9 w-auto object-contain mb-3"
          />
          <p className="text-xs text-slate-600 leading-relaxed">
            {business.identity.description}
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            Shop Marketplace
          </h4>
          <ul className="space-y-2 text-xs text-slate-600">
            {business.navigation.footerLinks.map(item=><li key={item.href}><Link to={item.href} className="hover:text-slate-900">{item.label}</Link></li>)}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            Make Money with Yaans.lk
          </h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li><Link to="/seller/register" className="hover:text-slate-900 font-semibold text-sky-700">Register as a Seller</Link></li>
            <li><Link to="/seller/dashboard" className="hover:text-slate-900">Seller Portal Dashboard</Link></li>
            <li><span className="text-slate-500">Commission rates depend on seller type and approved terms</span></li>
            <li><span className="text-slate-500">Automated District Courier Fee Calculation</span></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            Customer Help & Tracking
          </h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li><Link to="/track-order" className="hover:text-slate-900 font-semibold">Track Order (e.g., YLK-2026-1001)</Link></li>
            <li><Link to="/cart" className="hover:text-slate-900">Multi-Seller Shopping Cart</Link></li>
            <li><Link to="/account" className="hover:text-slate-900">Customer Account & Saved Addresses</Link></li>
            <li><Link to="/wishlist" className="hover:text-slate-900">Saved Wishlist Items</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            Legal & Sri Lanka Trust
          </h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li>
              <Link to="/terms" className="hover:text-slate-900 flex items-center gap-1.5 font-medium">
                <Scale className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Terms & Conditions
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-slate-900 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Privacy Policy (PDPA)
              </Link>
            </li>
            <li>
              <Link to="/cookies" className="hover:text-slate-900 flex items-center gap-1.5 font-medium">
                <Cookie className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                Cookie & Storage Policy
              </Link>
            </li>
            <li className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 leading-relaxed block">
                Governed by Sri Lanka PDPA No. 9 of 2022 & Electronic Transactions Act.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div>
            © {new Date().getFullYear()} {business.identity.name} Multi-Vendor Marketplace • Built for Sri Lanka • {business.pricing.taxMessage}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-slate-600 font-medium">
            <Link to="/terms" className="hover:text-slate-900 hover:underline">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-slate-900 hover:underline">
              Privacy Policy (PDPA)
            </Link>
            <span>•</span>
            <Link to="/cookies" className="hover:text-slate-900 hover:underline">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    <div className="max-w-7xl mx-auto p-4 text-xs flex flex-wrap gap-4"><a href={`mailto:${business.identity.supportEmail}`}>Support: {business.identity.supportEmail}</a>{business.identity.supportPhone && <a href={`tel:${business.identity.supportPhone}`}>{business.identity.supportPhone}</a>}{business.identity.whatsapp && <a href={`https://wa.me/${business.identity.whatsapp.replace(/[^0-9]/g,'')}`}>WhatsApp support</a>}</div>
    </footer>
  );
}
