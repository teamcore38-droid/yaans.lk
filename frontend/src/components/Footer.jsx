import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, Banknote, Store, Scale, Cookie } from 'lucide-react';

export default function Footer() {
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
              <div className="text-xs sm:text-sm font-bold text-slate-900">Cash on Delivery (COD)</div>
              <div className="text-xs text-slate-600">Pay in LKR (Rs.) when package arrives</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">Direct from Local Sellers</div>
              <div className="text-xs text-slate-600">Home kitchens, artisans & retail stores</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">Verified Marketplace</div>
              <div className="text-xs text-slate-600">Moderated sellers & easy order tracking</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 text-sm">
        <div>
          <img
            src="/brand/yaans-logo-horizontal-dark.png"
            alt="Yaans.lk"
            className="h-9 w-auto object-contain mb-3"
          />
          <p className="text-xs text-slate-600 leading-relaxed">
            Yaans.lk is Sri Lanka&apos;s practical multi-vendor online marketplace connecting home-based producers, small businesses, and retail vendors with shoppers across all 25 districts.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            Shop Marketplace
          </h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li><Link to="/products?homemade=true" className="hover:text-slate-900">Sri Lankan Homemade Products</Link></li>
            <li><Link to="/products?deals=true" className="hover:text-slate-900">Today&apos;s Value Deals in LKR</Link></li>
            <li><Link to="/products?category=electronics" className="hover:text-slate-900">Electronics & Accessories</Link></li>
            <li><Link to="/products?category=home-kitchen" className="hover:text-slate-900">Clay Cookware & Home</Link></li>
            <li><Link to="/products?category=ayurveda-beauty" className="hover:text-slate-900">Ayurveda & Herbal Care</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
            Make Money with Yaans.lk
          </h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li><Link to="/seller/register" className="hover:text-slate-900 font-semibold text-sky-700">Register as a Seller</Link></li>
            <li><Link to="/seller/dashboard" className="hover:text-slate-900">Seller Portal Dashboard</Link></li>
            <li><span className="text-slate-500">5% Low Commission for Homemade Sellers</span></li>
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
            <li><Link to="/admin" className="hover:text-slate-900">Marketplace Admin Portal</Link></li>
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
            © {new Date().getFullYear()} Yaans.lk Multi-Vendor Marketplace • Built for Sri Lanka • All prices in LKR (Rs.) with No Tax Surcharge.
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
    </footer>
  );
}
