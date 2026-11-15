import OrderDocuments from '../../components/OrderDocuments.jsx';
import React from 'react';
import { formatLkr } from '../../utils/api.js';

export default function OrdersTab({ orders, subOrders }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-extrabold text-slate-900">
        All Marketplace Orders &amp; Multi-Seller Split Packages
      </h2>
      <div className="space-y-4">
        {orders.map((ord) => {
          const subs = subOrders.filter((s) => s.parentOrderId === ord._id);
          return (
            <div
              key={ord._id}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <span className="font-extrabold text-slate-900 text-sm">
                    Master Order #{ord.orderNumber}
                  </span>
                  <span className="ml-2 text-slate-600">
                    Customer: <strong>{ord.shippingAddress?.recipientName}</strong> (
                    {ord.shippingAddress?.district} District)
                  </span>
                </div>
                <div className="font-bold text-slate-900">
                  Grand Total: {formatLkr(ord.grandTotalLkr)} ({ord.paymentMethod}) •{' '}
                  <span className="uppercase text-sky-700">
                    {ord.overallStatus?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <OrderDocuments orderId={ord._id} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {subs.map((sub) => (
                  <div
                    key={sub._id}
                    className="p-3 rounded-lg bg-white border border-slate-200 space-y-1"
                  >
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{sub.subOrderNumber} — {sub.sellerName}</span>
                      <span className="uppercase text-amber-800">
                        {sub.fulfillmentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Items: {formatLkr(sub.itemsSubtotalLkr)} | Delivery:{' '}
                      {formatLkr(sub.deliveryFeeLkr)} | Commission ({sub.commissionRatePercent}%):{' '}
                      <strong>{formatLkr(sub.commissionAmountLkr)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
