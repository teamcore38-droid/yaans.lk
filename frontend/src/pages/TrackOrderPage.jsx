import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Store,
  AlertCircle
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useMarketplace();

  const [orderNumber, setOrderNumber] = useState(
    searchParams.get('orderNumber') || 'YLK-2026-1001'
  );
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTracking = async (ordNum, ph = '') => {
    if (!ordNum) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(
        `/orders/track?orderNumber=${encodeURIComponent(ordNum)}&phone=${encodeURIComponent(ph)}`
      );
      setResult(res);
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialOrd = searchParams.get('orderNumber') || 'YLK-2026-1001';
    fetchTracking(initialOrd, '');
  }, [searchParams]);

  const handleCustomerPackageAction = async (subOrderId, action) => {
    const reason =
      action === 'cancel'
        ? 'Customer requested COD cancellation before dispatch'
        : 'Customer requested return after delivery';
    try {
      await apiRequest(`/orders/suborders/${subOrderId}/customer-action`, {
        method: 'POST',
        body: JSON.stringify({ action, reason })
      });
      showToast('Package status updated!');
      fetchTracking(orderNumber, phone);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Track Your Yaans.lk Multi-Seller Order
          </h1>
          <p className="text-xs text-slate-600">
            Enter your Order ID (try sample multi-seller orders{' '}
            <button
              type="button"
              onClick={() => {
                setOrderNumber('YLK-2026-1001');
                fetchTracking('YLK-2026-1001');
              }}
              className="text-sky-700 font-bold underline"
            >
              YLK-2026-1001
            </button>{' '}
            or{' '}
            <button
              type="button"
              onClick={() => {
                setOrderNumber('YLK-2026-1002');
                fetchTracking('YLK-2026-1002');
              }}
              className="text-sky-700 font-bold underline"
            >
              YLK-2026-1002
            </button>
            ) to inspect each seller&apos;s package status.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchTracking(orderNumber, phone);
          }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Order Number (e.g., YLK-2026-1001)"
            className="sm:col-span-5 px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold"
          />
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Recipient Phone (Optional verification)"
            className="sm:col-span-4 px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-3 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : 'Track Order'}
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result?.order && (
        <div className="space-y-4">
          {/* Master Order Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold text-slate-900">
                  Order #{result.order.orderNumber}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 uppercase">
                  {result.order.overallStatus?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Recipient: <strong>{result.order.shippingAddress?.recipientName}</strong> •{' '}
                {result.order.shippingAddress?.addressLine1}, {result.order.shippingAddress?.city},{' '}
                <strong>{result.order.shippingAddress?.district} District</strong>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">
                Total ({result.subOrders?.length || 1} Seller Shipments • {result.order.paymentMethod})
              </div>
              <div className="text-lg font-extrabold text-slate-900">
                {formatLkr(result.order.grandTotalLkr)}
              </div>
            </div>
          </div>

          {/* Individual Seller Packages (SubOrders) */}
          <div className="space-y-4">
            {(result.subOrders || []).map((sub, idx) => (
              <div
                key={sub._id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-bold">
                      Package {idx + 1}: {sub.subOrderNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-slate-600" />
                      {sub.sellerName} (Ships from {sub.sellerDistrict})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-900 uppercase">
                      {sub.fulfillmentStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Items in this Seller Shipment
                    </div>
                    {sub.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-100">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Variant: {item.variantLabel} • Qty: {item.quantity}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-slate-900">
                          {formatLkr(item.lineTotalLkr)}
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span>
                        Courier: <strong>{sub.courierPartner}</strong> • Tracking:{' '}
                        <strong className="text-slate-900">{sub.trackingCode}</strong>
                      </span>
                      <span>
                        Package Total (incl. {formatLkr(sub.deliveryFeeLkr)} delivery):{' '}
                        <strong className="text-slate-900">{formatLkr(sub.grossTotalLkr)}</strong>
                      </span>
                    </div>

                    {/* Customer Cancel or Return Actions */}
                    <div className="pt-2 flex items-center gap-2">
                      {['confirmed', 'packed'].includes(sub.fulfillmentStatus) && (
                        <button
                          type="button"
                          onClick={() => handleCustomerPackageAction(sub._id, 'cancel')}
                          className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold"
                        >
                          Cancel COD Package
                        </button>
                      )}
                      {sub.fulfillmentStatus === 'delivered' && (
                        <button
                          type="button"
                          onClick={() => handleCustomerPackageAction(sub._id, 'request_return')}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                        >
                          Request Return / Exchange
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Fulfillment & COD Log
                    </div>
                    <div className="space-y-2.5">
                      {(sub.statusHistory || []).map((h, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-slate-900 uppercase text-[11px]">
                              {h.status?.replace(/_/g, ' ')}
                            </div>
                            <div className="text-slate-600">{h.note}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(h.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
