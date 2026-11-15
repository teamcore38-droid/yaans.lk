import { useBusinessSettings } from '../hooks/useBusinessSettings.js';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X, ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'yaans_cookie_consent';

export default function CookieNotice() {
  const business = useBusinessSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Slight delay so it doesn't jarringly flash on initial load
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage access restricted in some private environments
    }
  }, []);

  useEffect(() => {
    const handleReopen = () => setVisible(true);
    window.addEventListener('yaans:reset-cookie-consent', handleReopen);
    return () => window.removeEventListener('yaans:reset-cookie-consent', handleReopen);
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        status: 'accepted',
        timestamp: new Date().toISOString()
      }));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        status: 'dismissed',
        timestamp: new Date().toISOString()
      }));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie & Storage Notice"
      className="fixed bottom-20 md:bottom-5 right-3 md:right-5 left-3 md:left-auto md:max-w-md z-40 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shrink-0 border border-amber-200">
          <Cookie className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs sm:text-sm">
            <span>Cookie & Storage Notice</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> No Ad Tracking
            </span>
          </div>
          <p className="text-slate-600 text-xs mt-1 leading-relaxed">
            {business.legal.cookieNotice}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
            >
              Got it, Continue
            </button>
            <Link
              to="/cookies"
              onClick={() => setVisible(false)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline px-1.5 py-1"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close notice"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
