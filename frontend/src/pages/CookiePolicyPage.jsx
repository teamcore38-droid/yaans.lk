import { useBusinessSettings } from '../hooks/useBusinessSettings.js';
import PublishedPolicy, { PolicySummary } from '../components/PublishedPolicy.jsx';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ShieldCheck, CheckCircle2, RotateCcw, AlertCircle, Info, Settings } from 'lucide-react';

const STORAGE_KEY = 'yaans_cookie_consent';

export default function CookiePolicyPage() {
  const business=useBusinessSettings();
  const [currentStatus, setCurrentStatus] = useState('Checking...');
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (!val) {
        setCurrentStatus('Default / Essential Only');
      } else {
        const parsed = JSON.parse(val);
        setCurrentStatus(parsed.status === 'accepted' ? 'Accepted (Essential & District Preferences)' : 'Dismissed (Essential Only)');
      }
    } catch {
      setCurrentStatus('Essential Storage Only');
    }
  }, []);

  const handleResetConsent = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setCurrentStatus('Reset to Default');
      setResetMessage('Your preferences were reset. The non-intrusive cookie notice is now available.');
      window.dispatchEvent(new Event('yaans:reset-cookie-consent'));
      setTimeout(() => setResetMessage(''), 4000);
    } catch (e) {
      setResetMessage('Unable to clear local storage in this environment.');
    }
  };

  if (business.legal.cookies) return <PublishedPolicy kind="cookies"/>;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <PolicySummary kind="cookies"/>
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1.5">
            <Cookie className="w-3.5 h-3.5 text-amber-700" />
            Cookie & Local Storage Policy
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Zero Cross-Site Ad Tracking
          </span>
          <span className="text-xs text-slate-500 font-medium ml-auto">
            Current published policy - see version above
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Cookie & Local Storage Policy
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
          Yaans.lk values your attention and privacy. We believe in providing a seamless, fast shopping experience without annoying you with intrusive popups or tracking your online activities across external websites.
        </p>

        {/* Quick Highlights Box */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100 text-xs text-slate-700">
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">Non-Intrusive Design</strong>
              No full-screen blocking modals or annoying consent walls that disrupt shopping.
            </div>
          </div>
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">Sri Lankan District Memory</strong>
              Remembers your chosen district to calculate accurate courier fees instantly.
            </div>
          </div>
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">Persistent Multi-Vendor Cart</strong>
              Keeps items from multiple sellers safely preserved in your browser.
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Preference Box */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Settings className="w-4 h-4" />
              Your Device Cookie Preference State
            </div>
            <div className="text-base sm:text-lg font-extrabold text-white">
              Current Status: <span className="text-amber-300">{currentStatus}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              You can reset your cookie acknowledgement at any time. When reset, the subtle bottom notice will become visible again, letting you re-confirm your preference.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetConsent}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs transition shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Cookie Consent
          </button>
        </div>

        {resetMessage && (
          <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{resetMessage}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-700 space-y-2">
        <h2 className="font-bold text-slate-900">Google sign-in security cookie</h2>
        <p>When you start optional Google customer sign-in, Yaans sets an essential, HttpOnly cookie named __Host-yaans_google in production (yaans_google during local development). It binds the Google response to your browser, expires after ten minutes and is cleared when sign-in completes or fails. It is not used for advertising. Google may use its own cookies when you visit Google to sign in.</p>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center justify-center">1</span>
            What Are Cookies and Browser Web Storage?
          </h2>
          <p>
            Cookies and web storage technologies (specifically HTML5 <code>localStorage</code> and <code>sessionStorage</code>) are compact text or data entries stored locally on your mobile device or computer browser when you visit a website.
          </p>
          <p className="text-xs sm:text-sm text-slate-600">
            Unlike intrusive tracking networks that follow you across the internet, Yaans.lk uses browser storage strictly for functional marketplace operations, such as remembering what you added to your cart, retaining your login session, and recalling your delivery district so you don&apos;t have to re-enter it repeatedly.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center justify-center">2</span>
            Exact Storage Keys Used on Yaans.lk
          </h2>
          <p>
            In accordance with Sri Lankan transparency principles under the <strong>Personal Data Protection Act, No. 9 of 2022 (PDPA)</strong>, here is an itemized breakdown of what we store on your device:
          </p>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs sm:text-sm">
            <div className="bg-slate-50 border-b border-slate-200 font-bold text-slate-900 grid grid-cols-12 p-3">
              <div className="col-span-4 sm:col-span-3">Storage Key</div>
              <div className="col-span-3 sm:col-span-2">Category</div>
              <div className="col-span-5 sm:col-span-7">Purpose & Lifecycle</div>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 p-3 items-start gap-2">
                <div className="col-span-4 sm:col-span-3 font-mono text-xs font-bold text-slate-900 break-all">yaans_checkout_draft_v1</div>
                <div className="col-span-3 sm:col-span-2"><span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-semibold">Functional</span></div>
                <div className="col-span-5 sm:col-span-7 text-xs text-slate-600">If you leave checkout to sign in, sessionStorage temporarily keeps your entered delivery details in that tab. Drafts can be restored for up to 30 minutes for the same cart and account, and are cleared on logout or completed checkout. Expired or invalid drafts are discarded when accessed. Passwords, authentication tokens and payment details are excluded.</div>
              </div>
              <div className="grid grid-cols-12 p-3 items-start gap-2">
                <div className="col-span-4 sm:col-span-3 font-mono text-xs font-bold text-slate-900 break-all">__Host-yaans_session</div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold">Strictly Necessary</span>
                </div>
                <div className="col-span-5 sm:col-span-7 text-xs text-slate-600">
                  An essential HttpOnly session cookie authenticates your account. Authentication tokens are not kept in localStorage. Local development uses yaans_session; logout revokes the session.
                </div>
              </div>

              <div className="grid grid-cols-12 p-3 items-start gap-2">
                <div className="col-span-4 sm:col-span-3 font-mono text-xs font-bold text-slate-900">yaans_district</div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-semibold">Functional</span>
                </div>
                <div className="col-span-5 sm:col-span-7 text-xs text-slate-600">
                  Saves your chosen Sri Lankan district (e.g. Colombo, Kandy, Galle, Jaffna) so courier rates are calculated accurately across all products automatically.
                </div>
              </div>

              <div className="grid grid-cols-12 p-3 items-start gap-2">
                <div className="col-span-4 sm:col-span-3 font-mono text-xs font-bold text-slate-900">yaans_cart</div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold">Strictly Necessary</span>
                </div>
                <div className="col-span-5 sm:col-span-7 text-xs text-slate-600">
                  Maintains selected items from multiple sellers in your multi-vendor cart so your cart doesn&apos;t disappear when navigating pages.
                </div>
              </div>

              <div className="grid grid-cols-12 p-3 items-start gap-2">
                <div className="col-span-4 sm:col-span-3 font-mono text-xs font-bold text-slate-900">yaans_cookie_consent</div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">Preference</span>
                </div>
                <div className="col-span-5 sm:col-span-7 text-xs text-slate-600">
                  Remembers your consent choice so that the cookie notice stays hidden and never pesters you again on subsequent visits.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center justify-center">3</span>
            No Third-Party Advertising Cookies
          </h2>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 space-y-2">
            <p className="font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Our Commitment to Respectful, Clean Commerce
            </p>
            <p>
              Unlike many web platforms, <strong>Yaans.lk does not host third-party behavioral advertising cookies, affiliate trackers, or surveillance pixels</strong>. We do not sell your search habits or contact information to data brokers or social media ad engines.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center justify-center">4</span>
            How You Can Control and Clear Cookies
          </h2>
          <p>
            You have full autonomy over your device storage. Most internet browsers automatically accept cookies, but you can alter your browser settings to reject or delete them:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Google Chrome (Desktop & Android):</strong> Navigate to <em>Settings &gt; Privacy and security &gt; Third-party cookies & Site data</em> to review or clear stored data.
            </li>
            <li>
              <strong>Apple Safari (iOS & macOS):</strong> Navigate to <em>Settings &gt; Safari &gt; Advanced &gt; Website Data</em> to remove stored entries.
            </li>
            <li>
              <strong>Mozilla Firefox:</strong> Navigate to <em>Settings &gt; Privacy & Security &gt; Cookies and Site Data</em>.
            </li>
            <li>
              <strong>Microsoft Edge:</strong> Navigate to <em>Settings &gt; Cookies and site permissions &gt; Manage and delete cookies and site data</em>.
            </li>
          </ul>
          <p className="text-xs text-slate-500 pt-1">
            <strong>Please Note:</strong> If you disable essential local storage entirely, you will not be able to add items to your shopping cart or remain logged in to your account.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center justify-center">5</span>
            Questions and Privacy Inquiries
          </h2>
          <p>
            For questions about this policy or our data handling practices under the Sri Lankan Personal Data Protection Act, please see our{' '}
            <Link to="/privacy" className="text-sky-700 underline font-semibold">
              Privacy Policy
            </Link>{' '}
            or contact us at{' '}
            <a href={`mailto:${business.identity.privacyEmail}`} className="text-sky-700 underline font-semibold">
              privacy@yaans.lk
            </a>.
          </p>
        </section>

      </div>
    </div>
  );
}
