import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, ShieldCheck, Truck, Banknote, ShoppingBag, AlertTriangle, CheckCircle2, Store } from 'lucide-react';

export default function TermsConditionsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-700" />
            Electronic Transactions Act No. 19 of 2006
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
            Consumer Affairs Authority Act No. 9 of 2003
          </span>
          <span className="text-xs text-slate-500 font-medium ml-auto">
            Last Updated: January 2026
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Terms and Conditions
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
          Welcome to Yaans.lk. These Terms and Conditions constitute a legally binding electronic agreement under the <strong>Electronic Transactions Act, No. 19 of 2006</strong> of Sri Lanka between you (as a &quot;Customer&quot;, &quot;Buyer&quot;, &quot;Seller&quot;, or &quot;User&quot;) and <strong>Yaans.lk Multi-Vendor Marketplace Operations</strong>.
        </p>

        {/* Quick Highlights Strip */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100 text-xs text-slate-700">
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Truck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">All 25 SL Districts</strong>
              Transparent courier calculations directly per seller origin and delivery district.
            </div>
          </div>
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Banknote className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">Cash on Delivery (LKR)</strong>
              Pay in Sri Lankan Rupees upon parcel arrival. No surprise tax surcharge.
            </div>
          </div>
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Store className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900">Direct From Local Sellers</strong>
              Connecting homemade producers, artisans, and retail stores with island-wide buyers.
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">1</span>
            Acceptance & Electronic Contract Formation
          </h2>
          <p>
            By accessing Yaans.lk, creating an account, browsing products, placing an order, or registering as a vendor, you agree to be bound by these Terms and Conditions and our{' '}
            <Link to="/privacy" className="text-sky-700 underline font-semibold">
              Privacy Policy
            </Link>.
          </p>
          <p className="text-xs sm:text-sm text-slate-600">
            In accordance with Sections 11 and 12 of the <strong>Electronic Transactions Act, No. 19 of 2006 (as amended by Act No. 25 of 2017)</strong>, your digital confirmation, order clicks, and account submissions have the equivalent legal validity and enforceability of handwritten signatures on paper contracts under Sri Lankan law.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">2</span>
            Nature of the Multi-Vendor Marketplace
          </h2>
          <p>
            Yaans.lk operates as an online multi-vendor intermediary platform. We provide the digital catalog, search facilities, per-district courier routing engine, and order coordination tools that connect independent third-party vendors (such as homemade food creators, artisans, cottage industries, and retail shops) with consumers across Sri Lanka.
          </p>
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs sm:text-sm space-y-2 text-amber-950">
            <p>
              <strong>Intermediary Role:</strong> When you purchase a product on Yaans.lk, the commercial contract of sale is formed directly between you (the Buyer) and the registered merchant (the Seller) whose storefront offers that item.
            </p>
            <p>
              Yaans.lk monitors vendor standards, facilitates dispute resolution, and regulates marketplace integrity, but does not manufacture the goods listed by independent vendors.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">3</span>
            Pricing, Currency & Consumer Transparency (CAA Act)
          </h2>
          <p>
            In compliance with the regulations of the <strong>Consumer Affairs Authority (CAA) Act, No. 9 of 2003</strong> of Sri Lanka:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Exclusively in LKR:</strong> All prices displayed on Yaans.lk are in Sri Lankan Rupees (Rs. / LKR).
            </li>
            <li>
              <strong>Transparent Pricing:</strong> There are no surprise service fees or hidden checkout markups. Taxes are explicitly listed as Rs. 0 (Exempt) on consumer retail purchases where applicable.
            </li>
            <li>
              <strong>Item Subtotal vs Delivery Fees:</strong> Delivery fees for each seller are itemized transparently in your multi-seller cart prior to checkout confirmation based on your destination district.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">4</span>
            Cash on Delivery (COD) & Payment Obligations
          </h2>
          <p>
            Cash on Delivery (COD) is the primary payment method for transactions on Yaans.lk, facilitating convenient trade across Sri Lanka without requiring credit cards:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Payment upon Delivery:</strong> By selecting Cash on Delivery and checking the COD confirmation, you confirm that you have ordered the specified items and agree to tender the exact amount in Sri Lankan Rupees to the courier upon parcel arrival.
            </li>
            <li>
              <strong>Good-Faith Commitment:</strong> Under Sri Lankan contract principles, placing an order generates a bona fide commercial commitment. Unjustified or malicious refusal to receive COD orders causes immediate financial loss to small cottage producers and independent couriers.
            </li>
            <li>
              <strong>Abuse & COD Blacklisting:</strong> Repeated unjustified order cancellations after dispatch, fake phone numbers, or deliberate refusal to accept delivery will result in permanent account suspension and restriction from using Cash on Delivery across the platform.
            </li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">5</span>
            Island-Wide Delivery Across All 25 Districts
          </h2>
          <p>
            Yaans.lk integrates with established domestic courier logistics networks servicing all 25 administrative districts across the 9 provinces of Sri Lanka:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-2">
            <div className="font-bold text-slate-900">Estimated Delivery Timelines:</div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li><strong>Western Province (Colombo, Gampaha, Kalutara):</strong> 2 to 4 working days from seller dispatch.</li>
              <li><strong>Other Outstation Districts (Kandy, Galle, Jaffna, Kurunegala, etc.):</strong> 3 to 7 working days depending on distance and local courier routing.</li>
            </ul>
            <p className="text-slate-500 text-xs pt-1">
              Note: Unforeseen severe weather, public holidays, or logistics disruptions may occasionally impact courier transit times. You can track real-time parcel dispatch status via our <Link to="/track-order" className="text-sky-700 underline font-semibold">Track Order</Link> page.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">6</span>
            Product Standards, Homemade Goods & Seller Obligations
          </h2>
          <p>
            Yaans.lk is dedicated to championing Sri Lankan cottage industries, pottery makers, and home kitchens while preserving consumer safety:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Food Hygiene (Food Act No. 26 of 1980):</strong> All sellers offering homemade edible items, traditional sweets, spices, and tea must follow hygienic preparation and secure packaging standards.
            </li>
            <li>
              <strong>Cosmetics & Herbal Products:</strong> Ayurveda, herbal remedies, and personal care products must adhere to domestic quality standards and National Medicines Regulatory Authority (NMRA) guidelines where applicable.
            </li>
            <li>
              <strong>Prohibited Items:</strong> Counterfeit goods, weapons, prescription drugs, fireworks, hazardous chemicals, and pirated media are strictly prohibited. Violating stores are banned immediately.
            </li>
            <li>
              <strong>Seller KYC:</strong> Sellers must verify their identity using a valid National Identity Card (NIC) or Business Registration (BR) number in accordance with Sri Lankan commercial standards.
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">7</span>
            Returns, Damaged Items & Refunds (CAA Compliance)
          </h2>
          <p>
            Under Section 13 and Section 32 of the Consumer Affairs Authority Act, buyers are entitled to receive goods that conform to their description and are fit for purpose:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
            <li>
              <strong>Inspection upon Receipt:</strong> When the courier hands over the parcel, the customer is encouraged to examine the external packaging for any visible damage or tampering before payment.
            </li>
            <li>
              <strong>Reporting Defective or Incorrect Goods:</strong> If an item is delivered broken, expired, defective, or significantly different from the listing, the customer must report it within <strong>48 to 72 hours</strong> of receipt by contacting support or submitting photos via the <Link to="/track-order" className="text-sky-700 underline font-semibold">Track Order</Link> portal.
            </li>
            <li>
              <strong>Perishable Items Exception:</strong> Fresh or perishable homemade foods cannot be returned once opened, unless delivered spoiled or damaged.
            </li>
            <li>
              <strong>Refund Settlements:</strong> Approved refunds are credited via direct Sri Lankan bank transfer or original payment method within 3 to 7 working days.
            </li>
          </ul>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">8</span>
            Prohibited Conduct & Computer Crime Act No. 24 of 2007
          </h2>
          <p>
            Users are strictly prohibited from attempting unauthorized access to Yaans.lk servers, scraping database listings, injecting malicious scripts, manipulating district pricing algorithms, or conducting distributed denial of service attacks. Any such activities will be reported to the Sri Lanka Police Computer Crime Division for statutory prosecution under the <strong>Computer Crime Act, No. 24 of 2007</strong>.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">9</span>
            Governing Law & Dispute Jurisdiction
          </h2>
          <p>
            These Terms and Conditions and any non-contractual obligations arising out of or in connection with them shall be governed by and construed in accordance with the substantive <strong>laws of the Democratic Socialist Republic of Sri Lanka</strong>.
          </p>
          <p className="text-xs sm:text-sm text-slate-600">
            Any dispute, controversy, or claim arising out of or relating to this marketplace, which cannot be amicably settled between the parties, shall be submitted to the exclusive jurisdiction of the competent courts of <strong>Colombo, Sri Lanka</strong>.
          </p>
        </section>

        {/* Section 10 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">10</span>
            Contact & Support
          </h2>
          <p>
            For inquiries regarding our terms, order issues, or seller policies, please contact our support desk:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <p><strong>Support Email:</strong> <a href="mailto:support@yaans.lk" className="text-sky-700 underline font-semibold">support@yaans.lk</a></p>
            <p><strong>Marketplace Address:</strong> Colombo, Western Province, Sri Lanka</p>
            <p><strong>Operating Hours:</strong> Monday – Saturday, 9:00 AM – 6:00 PM (Sri Lanka Time)</p>
          </div>
        </section>

      </div>
    </div>
  );
}
