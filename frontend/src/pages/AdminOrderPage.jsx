import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { hasAdminPermission, isOwner } from '../../../shared/adminAccess.js';
import { adminOrderPath } from '../../../shared/adminOrderPath.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';
import OrderDocuments from '../components/OrderDocuments.jsx';
import PackageReceiptLabel from '../components/PackageReceiptLabel.jsx';
import { apiRequest, formatLkr } from '../utils/api.js';

const statusLabel = value => String(value || 'Unknown').replaceAll('_', ' ');

function OrderDetails({ orderId, owner, clearSession }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest(adminOrderPath(orderId), { cache: 'no-store', signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure); });
    return () => controller.abort();
  }, [orderId]);

  if (error) return <div role="alert" className="rounded-xl border bg-white p-5 text-red-800">
    <p>{error.message || 'Unable to load the order.'}</p>
    {error.status === 401 && <Link to="/admin/login" state={{ orderId }} onClick={clearSession} className="font-semibold underline">Sign in again</Link>}
  </div>;
  if (!data) return <p role="status">Loading order details…</p>;

  const { order, packages } = data;
  const address = order.shippingAddress || {};
  const deliveryAddress = [address.addressLine1, address.addressLine2, address.city, address.district, address.postalCode].filter(Boolean).join(', ');
  return <>
    <header className="rounded-xl border bg-white p-5 space-y-2">
      <h1 className="text-2xl font-extrabold break-words">Order {order.orderNumber}</h1>
      <p className="capitalize text-slate-700">{statusLabel(order.overallStatus)} · {order.paymentMethod}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div><dt className="text-slate-600">Items subtotal</dt><dd>{formatLkr(order.itemsSubtotalLkr)}</dd></div>
        <div><dt className="text-slate-600">Delivery</dt><dd>{formatLkr(order.totalDeliveryFeeLkr)}</dd></div>
        <div><dt className="font-semibold">Order total</dt><dd className="font-bold">{formatLkr(order.grandTotalLkr)}</dd></div>
      </dl>
    </header>
    <section aria-label="Delivery details" className="rounded-xl border bg-white p-5 space-y-2 break-words">
      <h2 className="font-bold">Delivery details</h2>
      <p>{address.recipientName}</p>
      <p>{deliveryAddress}</p>
      <p>{address.phone || order.customerPhone}</p>
      {order.customerEmail && <p>{order.customerEmail}</p>}
      {address.deliveryNotes && <p>Delivery notes: {address.deliveryNotes}</p>}
    </section>
    <section aria-label="Seller packages" className="rounded-xl border bg-white p-5 space-y-4 break-words">
      <h2 className="font-bold">Seller packages</h2>
      {packages.map(pkg => <article key={pkg._id} className="border-t pt-3 space-y-2">
        <h3 className="font-semibold">{pkg.subOrderNumber} · {pkg.sellerName}</h3>
        <p className="capitalize text-sm text-slate-600">{statusLabel(pkg.fulfillmentStatus)} · {pkg.courierPartner} {pkg.trackingCode}</p>
        <ul className="space-y-1 text-sm">
          {pkg.items?.map((item, index) => <li key={index} className="flex justify-between gap-3">
            <span>{item.title} × {item.quantity} {item.variantLabel && `(${item.variantLabel})`}</span>
            <span className="shrink-0">{formatLkr(item.lineTotalLkr)}</span>
          </li>)}
        </ul>
        {owner && <PackageReceiptLabel packageId={pkg._id} packageNumber={pkg.subOrderNumber} />}
      </article>)}
      {!packages.length && <p>No seller packages are available for this order.</p>}
    </section>
    {owner && <OrderDocuments orderId={order._id} />}
  </>;
}

export default function AdminOrderPage() {
  const { user, clearSession } = useMarketplace();
  const { orderId } = useParams();
  if (!adminOrderPath(orderId)) return <p role="alert" className="p-6">Invalid order link.</p>;
  if (user?.role !== 'admin') return <Navigate to="/admin/login" state={{ orderId }} replace />;
  if (user.mfaEnabled === false || user.adminMustChangePassword) return <Navigate to="/admin" replace />;
  return <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
    <Link to="/admin" className="inline-block font-semibold text-sky-800 underline">Back to Admin Console</Link>
    {hasAdminPermission(user, 'orders')
      ? <OrderDetails key={`${user._id}:${orderId}`} orderId={orderId} owner={isOwner(user)} clearSession={clearSession} />
      : <p role="alert">Orders access is not assigned to your admin account.</p>}
  </div>;
}
