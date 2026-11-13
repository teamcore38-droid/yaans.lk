import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trash2,
  ShoppingBag,
  Store,
  MapPin,
  Truck,
  ArrowRight,
  Banknote
} from 'lucide-react';
import { formatLkr } from '../utils/api.js';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';

function CartItemList({ items, verified = false, updateCartQuantity, removeFromCart }) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <div
          key={`${item.productId}-${item.variantLabel}`}
          className="p-4 flex items-center gap-3 sm:gap-4"
        >
          <img
            src={item.image}
            alt={item.title}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-slate-200 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <Link
              to={`/product/${item.slug || item.productId}`}
              className="text-xs sm:text-sm font-bold text-slate-900 hover:text-sky-700 line-clamp-2"
            >
              {item.title}
            </Link>
            <div className="text-xs text-slate-500 mt-0.5">
              Option: <strong className="text-slate-700">{item.variantLabel}</strong> • Unit:{' '}
              {verified ? formatLkr(item.unitPriceLkr) : 'Pending verification'}
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center border border-slate-300 rounded-lg bg-white">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${item.title}`}
                  onClick={() =>
                    updateCartQuantity(item.productId, item.variantLabel, item.quantity - 1)
                  }
                  className="px-2.5 py-1 text-xs font-bold hover:bg-slate-100"
                >
                  -
                </button>
                <span className="px-2.5 py-1 text-xs font-bold text-slate-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${item.title}`}
                  disabled={item.quantity >= 99}
                  onClick={() =>
                    updateCartQuantity(item.productId, item.variantLabel, item.quantity + 1)
                  }
                  className="px-2.5 py-1 text-xs font-bold hover:bg-slate-100"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                aria-label={`Remove ${item.title}`}
                onClick={() => removeFromCart(item.productId, item.variantLabel)}
                className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-sm sm:text-base font-extrabold text-slate-900">
              {verified ? formatLkr(item.lineTotalLkr) : '—'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CartPage() {
  const {
    cartItems,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    selectedDistrict,
    setSelectedDistrict,
    cartQuote,
    quoteLoading,
    quoteError,
    retryCartQuote
  } = useMarketplace();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-10">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-500">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Your Yaans.lk Shopping Cart is Empty
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Add products from multiple Sri Lankan sellers to a single cart. We automatically calculate district delivery fees and split shipments for you.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/products"
              className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm"
            >
              Browse Marketplace
            </Link>
            <Link
              to="/products?homemade=true"
              className="px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm"
            >
              Explore Homemade SL
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sellerGroups = cartQuote?.sellerGroups || [];
  const quoteReady = !quoteLoading && !quoteError && sellerGroups.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900">
            Multi-Seller Shopping Cart
          </h1>
          <p className="text-xs text-slate-600">
            Items are grouped by seller below so you can see each seller&apos;s exact courier fee to your district.
          </p>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-xs text-slate-500 hover:text-red-600 font-medium"
        >
          Clear Entire Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Seller Shipment Groups (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {quoteError && (
            <div role="alert" className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-sm text-amber-950 space-y-2">
              <p className="font-bold">We couldn't verify your cart.</p>
              <p>{quoteError}</p>
              <p>Your saved items are shown below. Update or remove items, or retry before checkout.</p>
              <button type="button" onClick={retryCartQuote} className="font-bold underline">Retry cart check</button>
            </div>
          )}
          {sellerGroups.length > 0 ? (
            sellerGroups.map((group, idx) => (
              <div
                key={group.sellerId}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
              >
                {/* Seller Shipment Header */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold">
                      Shipment {idx + 1} of {sellerGroups.length}
                    </span>
                    <Store className="w-4 h-4 text-slate-700" />
                    <Link
                      to={`/store/${group.sellerSlug || group.sellerId}`}
                      className="text-xs sm:text-sm font-bold text-slate-900 hover:text-sky-700"
                    >
                      {group.sellerName}
                    </Link>
                    <span className="text-xs text-slate-500 flex items-center gap-0.5">
                      (<MapPin className="w-3 h-3" /> Ships from {group.sellerDistrict})
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-500" />
                    {group.shippingDetails?.isFreeShipping ? (
                      <span className="text-emerald-700 font-bold">FREE Delivery</span>
                    ) : (
                      <span>
                        Courier to {selectedDistrict}:{' '}
                        <strong className="text-slate-900">
                          {formatLkr(group.deliveryFeeLkr)}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Items in this Seller Shipment */}
                <CartItemList items={group.items} verified updateCartQuantity={updateCartQuantity} removeFromCart={removeFromCart} />

                {/* Seller Package Footer Summary */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600">
                  <span>
                    Est. Delivery: <strong>{group.shippingDetails?.estimatedDays}</strong> ({group.shippingDetails?.rateTier || 'Courier'})
                  </span>
                  <span>
                    Package Subtotal + Delivery:{' '}
                    <strong className="text-slate-900">{formatLkr(group.grossTotalLkr)}</strong>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {quoteLoading && <p role="status" className="p-4 text-xs text-slate-500">Checking prices, availability and delivery...</p>}
              <CartItemList items={cartItems} updateCartQuantity={updateCartQuantity} removeFromCart={removeFromCart} />
            </div>
          )}
        </div>

        {/* Right: Order Summary & District Calculator (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 sticky top-28">
          <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-200 pb-3">
            Order Summary (LKR)
          </h2>

          {/* Destination District Selector */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <label className="block font-bold text-slate-800">
              Delivery District (Sri Lanka):
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
            >
              {DEFAULT_SL_DISTRICTS.map((dist) => (
                <option key={dist} value={dist}>
                  {dist} District
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              {quoteReady && <>Your cart has items from <strong>{cartQuote.sellerCount} seller(s)</strong>. </>}Delivery fees are calculated per seller shipment.
            </p>
          </div>

          <div className="space-y-2 text-xs sm:text-sm border-b border-slate-200 pb-3">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-slate-900">
                {quoteReady ? formatLkr(cartQuote.itemsSubtotalLkr) : 'Pending verification'}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>
                Total Delivery Fees{quoteReady ? ` (${cartQuote.sellerCount} shipment${cartQuote.sellerCount > 1 ? 's' : ''})` : ''}:
              </span>
              <span className="font-semibold text-slate-900">
                {quoteReady ? formatLkr(cartQuote.totalDeliveryFeeLkr) : 'Pending verification'}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span>Tax / VAT:</span>
              <span>Rs. 0 (No tax charged)</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-slate-900">Grand Total:</span>
            <span className={quoteReady ? 'text-xl font-extrabold text-slate-900' : 'text-xs font-semibold text-slate-500'}>
              {quoteReady ? formatLkr(cartQuote.grandTotalLkr) : 'Pending verification'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-900">
            <Banknote className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              {!quoteReady ? 'Payment availability will be confirmed after your cart is verified.' : cartQuote.codAvailable
                ? <><strong>Cash on Delivery (COD) Available</strong> for {selectedDistrict} District. Both Guest &amp; Registered Checkout supported.</>
                : <strong>Cash on Delivery is unavailable for this cart or district.</strong>}
            </span>
          </div>

          <button
            type="button"
            disabled={!quoteReady || !cartQuote.codAvailable}
            onClick={() => navigate('/checkout')}
            className="w-full py-3 px-4 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition"
          >
            Proceed to Checkout
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
