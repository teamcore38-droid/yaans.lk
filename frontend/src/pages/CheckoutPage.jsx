import { useBusinessSettings } from '../hooks/useBusinessSettings.js';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  MapPin,
  Banknote,
  CreditCard,
  Truck,
  Store,
  ShieldCheck,
  Package
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { checkoutKey, clearCheckoutKey, rememberGuestAccess } from '../utils/orderAccess.js';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';
import { beforeCustomerAuth, prepareCustomerAuth, readCheckoutDraft, saveCheckoutDraft, clearCheckoutDraft } from '../utils/checkoutDraft.js';
import { customerAuthPath } from '../../../shared/customerRedirect.js';

export default function CheckoutPage() {
  const business=useBusinessSettings();
  const {
    user,
    cartItems,
    cartQuote,
    selectedDistrict,
    setSelectedDistrict,
    clearCart,
    showToast
  } = useMarketplace();
  const navigate = useNavigate();

  const [draft] = useState(() => readCheckoutDraft(cartItems, user));
  const [recipientName, setRecipientName] = useState(draft?.recipientName || user?.name || '');
  const [phone, setPhone] = useState(draft?.phone || user?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(draft?.customerEmail || user?.email || '');
  const [addressLine1, setAddressLine1] = useState(draft?.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(draft?.addressLine2 || '');
  const [city, setCity] = useState(draft?.city || '');
  const [postalCode, setPostalCode] = useState(draft?.postalCode || '');
  const [deliveryNotes, setDeliveryNotes] = useState(draft?.deliveryNotes || '');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [codConfirmed, setCodConfirmed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [placedResult, setPlacedResult] = useState(null);
  const submissionLock = useRef(false);
  const previousAccount = useRef(user?._id);
  const prefilledAccount = useRef(null);
  const [signInRequired, setSignInRequired] = useState(false);

  useEffect(() => {
    if (draft && DEFAULT_SL_DISTRICTS.includes(draft.district)) setSelectedDistrict(draft.district);
  }, [draft, setSelectedDistrict]);

  useEffect(() => {
    const save = () => {
      if (!placedResult && !submissionLock.current) saveCheckoutDraft(cartItems, user, {
        recipientName, phone, customerEmail, addressLine1, addressLine2, city, postalCode, deliveryNotes, district: selectedDistrict
      });
    };
    window.addEventListener(beforeCustomerAuth, save);
    return () => window.removeEventListener(beforeCustomerAuth, save);
  }, [cartItems, user, recipientName, phone, customerEmail, addressLine1, addressLine2, city, postalCode, deliveryNotes, selectedDistrict, placedResult]);

  // Pre-fill default saved address when user is signed in
  useEffect(() => {
    if (previousAccount.current && previousAccount.current !== user?._id) {
      clearCheckoutDraft();
      setRecipientName(''); setPhone(''); setCustomerEmail(''); setAddressLine1(''); setAddressLine2(''); setCity(''); setPostalCode(''); setDeliveryNotes('');
      prefilledAccount.current = null;
    }
    previousAccount.current = user?._id;
    if (user && prefilledAccount.current !== user._id) {
      prefilledAccount.current = user._id;
      setRecipientName((prev) => prev || user.name || '');
      setPhone((prev) => prev || user.phone || '');
      setCustomerEmail((prev) => prev || user.email || '');
      const defAddr = (user.addresses || []).find((a) => a.isDefault) || user.addresses?.[0];
      if (defAddr && defAddr.district === selectedDistrict && !addressLine1 && !draft) {
        setRecipientName(defAddr.recipientName);
        setPhone(defAddr.phone);
        setAddressLine1(defAddr.addressLine1);
        setAddressLine2(defAddr.addressLine2 || '');
        setCity(defAddr.city);
        setPostalCode(defAddr.postalCode || '');
      }
    }
  }, [user, addressLine1, selectedDistrict, draft]);

  const applySavedAddress = (addr) => {
    setRecipientName(addr.recipientName);
    setPhone(addr.phone);
    setAddressLine1(addr.addressLine1);
    setAddressLine2(addr.addressLine2 || '');
    setCity(addr.city);
    setPostalCode(addr.postalCode || '');
    setSelectedDistrict(addr.district);
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (submissionLock.current) return;
    if (!codConfirmed && paymentMethod === 'COD') {
      showToast('Please confirm the Cash on Delivery (COD) agreement.', 'error');
      return;
    }
    submissionLock.current = true;
    const scope = user?._id || 'guest';
    const complete = (result) => {
      rememberGuestAccess(result.order.orderNumber, result.guestAccessToken);
      clearCheckoutKey(scope);
      clearCheckoutDraft();
      setPlacedResult(result);
      clearCart();
      showToast(`Order ${result.order.orderNumber} placed successfully!`);
    };
    try {
      setSubmitting(true);
      const res = await apiRequest('/orders/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': checkoutKey(scope) },
        body: JSON.stringify({
          items: cartItems.map((c) => ({
            productId: c.productId,
            variantLabel: c.variantLabel,
            quantity: c.quantity
          })),
          customerEmail: customerEmail || 'guest@yaans.lk',
          shippingAddress: {
            recipientName,
            phone,
            addressLine1,
            addressLine2,
            city,
            district: selectedDistrict,
            postalCode,
            deliveryNotes
          },
          paymentMethod: 'COD',
          codConfirmedByCustomer: codConfirmed
        })
      });
      complete(res);
    } catch (err) {
      if (err.code === 'IDEMPOTENCY_CONFLICT') {
        try {
          const previous = await apiRequest('/orders/checkout-result', { method: 'POST', headers: { 'Idempotency-Key': checkoutKey(scope) } });
          complete(previous);
          showToast('Your earlier checkout was completed. Please review the confirmed order.');
        } catch (recoveryError) { showToast(recoveryError.message, 'error'); }
      } else {
        if (err.status === 401) setSignInRequired(true);
        // Keep the key after an ambiguous network/server failure, including reloads.
        showToast(err.message, 'error');
      }
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  // Order Confirmation View
  if (placedResult) {
    const { order, subOrders = [] } = placedResult;
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Cash on Delivery Order Confirmed
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                Thank you! Your Order #{order.orderNumber} is Confirmed
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                We have split your order into <strong>{subOrders.length} seller shipment(s)</strong> for fast dispatch to{' '}
                <strong>{order.shippingAddress.city}, {order.shippingAddress.district} District</strong>.
              </p>
            </div>
          </div>

          {placedResult.guestAccessToken && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-2 text-sm">
              <p className="font-bold">Save your guest tracking access code</p>
              <p>You will need this code to view or cancel your order when you are not signed in. Keep it private.</p>
              <code className="block break-all select-all font-mono">{placedResult.guestAccessToken}</code>
            </div>
          )}

          {/* Per-Seller Split Packages */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              Individual Seller Shipments ({subOrders.length})
            </h2>
            {subOrders.map((sub) => (
              <div
                key={sub._id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-700" />
                    <span>Package #{sub.subOrderNumber}</span>
                    <span className="text-slate-400">•</span>
                    <span>Seller: {sub.sellerName} ({sub.sellerDistrict})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    COD Due on Delivery: {formatLkr(sub.grossTotalLkr)}
                  </span>
                </div>
                <div className="text-slate-600">
                  Items: {sub.items.map((i) => `${i.title} (x${i.quantity})`).join(', ')}
                </div>
                <div className="text-slate-500">
                  Courier Tracking: <strong className="text-slate-800">{sub.trackingCode}</strong> ({sub.courierPartner})
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-300">Total Cash on Delivery (COD) Payable</div>
              <div className="text-xl font-extrabold text-amber-400">
                {formatLkr(order.grandTotalLkr)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/track-order?orderNumber=${order.orderNumber}${placedResult.guestAccessToken ? `#access=${encodeURIComponent(placedResult.guestAccessToken)}` : ''}`}
                className="px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Track Order #{order.orderNumber}
              </Link>
              <Link
                to="/"
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="bg-white p-8 rounded-xl border border-slate-200 space-y-3">
          <h1 className="text-lg font-bold text-slate-900">No items in cart to checkout</h1>
          <Link
            to="/products"
            className="inline-block px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900">
          Sri Lankan Marketplace Checkout
        </h1>
        {user && <p className="text-xs text-slate-600">Signed in as {user.name} ({user.email})</p>}
        {(!user || signInRequired) && <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm space-y-2">
          <p role={signInRequired ? 'alert' : undefined}>{signInRequired ? 'Your session has expired. Sign in again to continue safely; your order has not been resubmitted.' : 'You can purchase as a guest, or sign in to use saved addresses and keep this order in your account.'}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to={customerAuthPath('login', '/checkout')} onClick={event => { if (submissionLock.current) event.preventDefault(); else prepareCustomerAuth(); }} className="font-bold text-sky-700 hover:underline">{signInRequired ? 'Sign in again' : 'Sign in to continue checkout'}</Link>
            {!signInRequired && <a href="#delivery-details" className="font-semibold text-slate-700 hover:underline">Continue as guest</a>}
          </div>
        </div>}
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Sri Lankan Delivery Address & Payment Method (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Saved Addresses Selector if Logged In */}
          {user?.addresses?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select a Saved Sri Lankan Address
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {user.addresses.map((addr) => (
                  <button
                    key={addr._id}
                    type="button"
                    onClick={() => applySavedAddress(addr)}
                    className="p-3 rounded-lg border border-slate-200 hover:border-slate-900 text-left bg-slate-50 transition text-xs"
                  >
                    <div className="font-bold text-slate-900">{addr.label} — {addr.district}</div>
                    <div className="text-slate-600 truncate">{addr.addressLine1}, {addr.city}</div>
                    <div className="text-slate-500">{addr.phone}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Address Form */}
          <div id="delivery-details" className="scroll-mt-4 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <MapPin className="w-4 h-4 text-slate-700" />
              1. Sri Lankan Delivery Address
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Recipient Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g., Kasun Perera"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sri Lankan Mobile Number (For Courier Call) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 077 412 3987"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Email Address (For Order Tracking Receipt)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g., kasun@gmail.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Street Address / House No. / Lane *
                </label>
                <input
                  type="text"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g., No. 42/B, Fife Road, Thimbirigasyaya"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Landmark / Apartment / Optional Line 2
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="e.g., Near Isipathana Mawatha Junction"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Administrative District (25 Districts) *
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  {DEFAULT_SL_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d} District
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Town / City *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Colombo 05 / Maharagama / Katugastota"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Postal Code (Optional)
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g., 00500"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Courier Delivery Notes
                </label>
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="e.g., Call before arriving at gate"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <Banknote className="w-4 h-4 text-slate-700" />
              2. Payment Method
            </h2>

            <div className="space-y-3 text-xs">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition ${
                  paymentMethod === 'COD'
                    ? 'payment-card-selected'
                    : 'payment-card-unselected'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                  className="mt-1 accent-blue-600 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span>Cash on Delivery (COD) — Pay in LKR (Rs.)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#00985A] text-white text-[10px] font-bold whitespace-nowrap shrink-0">
                      Recommended
                    </span>
                  </div>
                  <p className="text-slate-700 mt-0.5 leading-snug">
                    <span className="sm:hidden">Pay cash to rider.</span>
                    <span className="hidden sm:inline">
                      Pay cash in Sri Lankan Rupees directly to the delivery rider when each seller package arrives at your doorstep.
                    </span>
                  </p>

                  <div className="mt-2.5 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={codConfirmed}
                      onChange={(e) => setCodConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 accent-blue-600 shrink-0"
                    />
                    <span className="text-slate-900 font-semibold leading-snug">
                      I confirm this COD order and agree to have{' '}
                      <strong className="font-extrabold">{formatLkr(cartQuote?.grandTotalLkr || 0)}</strong> ready on delivery.
                    </span>
                  </div>
                </div>
              </label>

              {/* Future Online Payment Integration Readiness */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl payment-card-unselected">
                <input type="radio" disabled className="mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span>
                      <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1.5 align-text-bottom text-slate-700" />
                      Online Card / LankaQR / PayHere (Gateway Architecture Ready)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E2DCE2] text-slate-700 text-[10px] font-bold whitespace-nowrap shrink-0">
                      Phase 2 Integration
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5 leading-snug">
                    <span className="sm:hidden">Online payments coming soon.</span>
                    <span className="hidden sm:inline">
                      Visa, MasterCard, and LankaQR instant online payments are pre-architected for future activation.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Multi-Seller Split Order Breakdown & Place Order Button (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 sticky top-28">
          <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-200 pb-3">
            3. Multi-Seller Shipment Split
          </h2>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {(cartQuote?.sellerGroups || []).map((grp, i) => (
              <div
                key={grp.sellerId}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-slate-600" />
                    Shipment {i + 1}: {grp.sellerName}
                  </span>
                  <span className="text-slate-500 font-medium">From {grp.sellerDistrict}</span>
                </div>
                {grp.returnPolicies && <p>{grp.returnPolicies.every(rule=>rule.enabled)?`${Math.min(...grp.returnPolicies.map(rule=>rule.days))}-day returns for this package from delivery`:'Standard whole-package returns are unavailable because an item is excluded. Contact support for individual-item assistance.'}</p>}
                {grp.items.map((it) => (
                  <div
                    key={`${it.productId}-${it.variantLabel}`}
                    className="flex justify-between text-slate-600"
                  >
                    <span className="truncate pr-2">
                      {it.quantity}x {it.title} ({it.variantLabel})
                    </span>
                    <span className="font-medium text-slate-900 shrink-0">
                      {formatLkr(it.lineTotalLkr)}
                    </span>
                  </div>
                ))}
                <div className="pt-1.5 border-t border-slate-200 flex justify-between text-slate-700 font-semibold">
                  <span>Courier to {selectedDistrict}:</span>
                  <span>
                    {grp.deliveryFeeLkr === 0 ? 'FREE' : formatLkr(grp.deliveryFeeLkr)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-slate-900">
                {formatLkr(cartQuote?.itemsSubtotalLkr || 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Combined Delivery Fees ({selectedDistrict}):</span>
              <span className="font-semibold text-slate-900">
                {formatLkr(cartQuote?.totalDeliveryFeeLkr || 0)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Taxes:</span>
              <span>{cartQuote?.policySnapshot?.taxMessage || business.pricing.taxMessage}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
              <span className="font-extrabold text-slate-900 text-sm">
                Total Payable on Delivery:
              </span>
              <span className="text-xl font-extrabold text-slate-900">
                {formatLkr(cartQuote?.grandTotalLkr || 0)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:bg-slate-300 text-slate-950 font-extrabold text-sm shadow-sm transition"
          >
            {submitting
              ? 'Splitting & Confirming Order...'
              : `Confirm COD Order (${formatLkr(cartQuote?.grandTotalLkr || 0)})`}
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            By placing your order, you agree to Yaans.lk{' '}
            <Link to="/terms" target="_blank" className="underline hover:text-slate-800 font-medium">
              Terms & Conditions
            </Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" className="underline hover:text-slate-800 font-medium">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </form>
    </div>
  );
}
