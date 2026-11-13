import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, FileText, UserCheck, AlertCircle, Mail, MapPin, CheckCircle2 } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            PDPA No. 9 of 2022 Compliant
          </span>
          <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 text-xs font-bold border border-sky-200">
            Sri Lanka Data Protection Standard
          </span>
          <span className="text-xs text-slate-500 font-medium ml-auto">
            Effective Date: January 1, 2026
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
          Yaans.lk (&quot;Yaans&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to safeguarding the privacy and personal data of our customers, vendors, and website visitors across Sri Lanka. This Privacy Policy outlines our data governance practices in strict compliance with the <strong>Personal Data Protection Act, No. 9 of 2022 (PDPA)</strong> of Sri Lanka.
        </p>

        {/* Quick Highlights Summary Box */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100 text-xs text-slate-700">
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">No Selling of Data</strong>
              We never sell or rent your personal information to third-party ad networks.
            </div>
          </div>
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">District Delivery Scope</strong>
              Address data is shared only with verified local couriers for order transit.
            </div>
          </div>
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">PDPA Data Subject Rights</strong>
              Right to access, rectify, or request erasure of your data at any time.
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
        
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">1</span>
            Data Controller & Operations in Sri Lanka
          </h2>
          <p>
            Under the Personal Data Protection Act, No. 9 of 2022 (PDPA) of the Democratic Socialist Republic of Sri Lanka, <strong>Yaans.lk Multi-Vendor Marketplace Operations</strong> acts as the <strong>Data Controller</strong> for personal data collected through the Yaans.lk website, mobile interfaces, and associated services.
          </p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <p><strong>Designated Data Protection Officer (DPO):</strong> Compliance & Legal Operations</p>
            <p><strong>Physical Operating Presence:</strong> Colombo, Western Province, Sri Lanka</p>
            <p><strong>Grievance & Privacy Email:</strong> <a href="mailto:privacy@yaans.lk" className="text-sky-700 underline font-semibold">privacy@yaans.lk</a></p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">2</span>
            Legal Grounds for Processing (PDPA Part I & II)
          </h2>
          <p>
            In accordance with the statutory mandates of the Sri Lanka PDPA, Yaans.lk only collects and processes personal data on verified lawful grounds:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Performance of a Contract (Section 6(1)(b)):</strong> Necessary to process your purchases, route orders to appropriate homemade producers or retail sellers, calculate accurate courier fees to your district, and fulfill Cash on Delivery (COD) dispatches.
            </li>
            <li>
              <strong>Explicit Consent (Section 6(1)(a)):</strong> Given when registering a customer or seller account, choosing to receive order alerts, or opting into customer support correspondence.
            </li>
            <li>
              <strong>Statutory & Legal Obligations:</strong> Retention of financial and commercial transaction records required by the Inland Revenue Department of Sri Lanka, the Consumer Affairs Authority (CAA), and domestic bookkeeping mandates.
            </li>
            <li>
              <strong>Legitimate Business Interests:</strong> Investigating fraud, preventing fraudulent COD cancellations, ensuring platform uptime, and resolving multi-vendor disputes.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">3</span>
            Categories of Personal Data We Collect
          </h2>
          <p>
            We adhere to the principle of <strong>Data Minimisation</strong>: we only gather data strictly required to deliver high quality marketplace services across Sri Lanka.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-sky-700" />
                Customer & Buyer Information
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>Full Name and Account Credentials.</li>
                <li>Sri Lankan Contact Telephone Number (required for domestic courier SMS / call prior to delivery).</li>
                <li>Delivery Address: Street address, City, and Destination District (selected from all 25 Sri Lankan administrative districts).</li>
                <li>Order History, items ordered, and Cash on Delivery payment status.</li>
                <li>Optional saved delivery labels (&quot;Home&quot;, &quot;Work&quot;) and Wishlist items.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                Seller & Vendor Information
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>Storefront Name, Proprietor Name, and Business Category (e.g. Homemade, Artisan, Retail).</li>
                <li>National Identity Card (NIC) number or Business Registration (BR) number (under Sri Lankan commercial Know-Your-Customer standards).</li>
                <li>Physical pickup address and warehouse location.</li>
                <li>Sri Lankan Commercial Bank Account Details (Bank name, branch, account number) strictly for payout remittances.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Optional Google customer sign-in</h2>
          <p>
            If you choose Google sign-in, Google shares your account identifier, verified email address and basic profile information with Yaans. We store your Google identifier, email and name to create or link your customer account and authenticate future sign-ins. New Google customers provide delivery phone numbers, districts and addresses at checkout rather than during sign-up. We do not request access to your Gmail inbox, contacts, Drive files or Google password, and do not retain Google access or refresh tokens.
          </p>
          <p>
            Google processes your sign-in under its own <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">Privacy Policy</a>. Short-lived, essential security cookies and server-side challenges protect the sign-in process and expire after ten minutes. Account information is retained under the account retention and deletion provisions of this policy. You can also use email and password; Google-only customers can create an optional password after verifying their linked Google account from Account Security.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">4</span>
            How Personal Data is Shared
          </h2>
          <p>
            Yaans.lk strictly operates as a trusted multi-vendor platform. We share data only with entities essential to completing your order:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Independent Sri Lankan Couriers:</strong> We disclose only the recipient&apos;s name, delivery address, destination district, contact phone number, and COD payable amount in LKR to third-party courier services (e.g., PromptX, Domex, Koombiyo, Pronto, SL Post) to physically execute dispatch.
            </li>
            <li>
              <strong>Fulfilling Marketplace Sellers:</strong> Independent sellers receive the specific order items and recipient delivery destination needed to prepare packaging, affix shipping waybills, and ensure timely handover.
            </li>
            <li>
              <strong>Regulatory & Legal Authorities:</strong> Disclosed solely when strictly mandated under the laws of Sri Lanka, a formal directive from the Data Protection Authority of Sri Lanka, the Consumer Affairs Authority, or a court order from a competent Sri Lankan court.
            </li>
            <li>
              <strong>No Third-Party Advertising Sharing:</strong> We do NOT sell, license, trade, or distribute your email, telephone number, or browsing patterns to data brokers, telemarketers, or external advertisers.
            </li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">5</span>
            Data Storage, Cross-Border Transfers & Security Safeguards
          </h2>
          <p>
            We implement robust organizational and technological safeguards to prevent unauthorized access, alteration, disclosure, or accidental destruction of your personal data:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Cryptographic Protection:</strong> All communication between your device and Yaans.lk is encrypted using standard Transport Layer Security (TLS/HTTPS). User passwords are cryptographically hashed using salted algorithms (bcrypt) and cannot be viewed in plain text.
            </li>
            <li>
              <strong>Cross-Border Transfer Compliance (PDPA Section 26):</strong> Where cloud infrastructure or database servers are hosted in secure data centers outside Sri Lanka, we ensure the hosting territory provides an adequate level of data protection comparable to the Sri Lankan PDPA.
            </li>
            <li>
              <strong>Access Restrictions:</strong> Access to customer addresses, phone numbers, and seller banking records is strictly restricted to authorized staff on a least-privilege, need-to-know basis.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">6</span>
            Your Rights Under the Sri Lanka PDPA
          </h2>
          <p>
            Under Part III (Sections 13 through 16) of the Sri Lanka Personal Data Protection Act, No. 9 of 2022, you hold comprehensive rights as a Data Subject:
          </p>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="p-3 rounded-lg border border-slate-200">
              <strong>1. Right to Access (Section 13):</strong> You may request confirmation of whether Yaans.lk holds your personal data and obtain a readable summary of that data.
            </div>
            <div className="p-3 rounded-lg border border-slate-200">
              <strong>2. Right to Rectification (Section 14):</strong> You can update inaccurate or incomplete addresses, telephone numbers, or profile information directly from your <Link to="/account" className="text-sky-700 underline font-semibold">Customer Account</Link> or by contacting support.
            </div>
            <div className="p-3 rounded-lg border border-slate-200">
              <strong>3. Right to Erasure / Deletion (Section 15):</strong> You may request the deletion of your account and personal data, subject to our statutory obligations to preserve tax and fiscal transaction records under Sri Lankan commercial law.
            </div>
            <div className="p-3 rounded-lg border border-slate-200">
              <strong>4. Right to Object / Withdraw Consent (Section 16):</strong> You may withdraw your consent for non-essential processing at any time without affecting the lawfulness of processing carried out prior to withdrawal.
            </div>
            <div className="p-3 rounded-lg border border-slate-200">
              <strong>5. Right to Appeal & Lodge a Complaint:</strong> If you believe your data has been handled contrary to the PDPA, you have the right to lodge a complaint with the <strong>Data Protection Authority of Sri Lanka</strong>.
            </div>
          </div>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">7</span>
            Cookies and Local Storage
          </h2>
          <p>
            Yaans.lk utilizes minimal, essential local storage to remember your chosen Sri Lankan district, calculate courier rates transparently, and preserve your shopping cart. We do not engage in invasive cross-site tracking. For detailed information, please review our dedicated{' '}
            <Link to="/cookies" className="text-sky-700 underline font-bold">
              Cookie & Storage Policy
            </Link>.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center">8</span>
            Contacting the Data Protection Officer
          </h2>
          <p>
            To exercise your rights under the PDPA or if you have any questions, inquiries, or privacy concerns regarding this policy, please reach out to our team:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-slate-900">Yaans.lk Privacy & Compliance Team</div>
              <div className="text-slate-600">Response turnaround: Within 14 working days as per Sri Lankan statutory guidelines</div>
            </div>
            <a
              href="mailto:privacy@yaans.lk"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shrink-0 transition"
            >
              <Mail className="w-4 h-4" />
              Email privacy@yaans.lk
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
