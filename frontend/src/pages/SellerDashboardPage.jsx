import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Package,
  ShoppingBag,
  Banknote,
  Settings,
  Plus,
  Upload,
  CheckCircle2,
  Clock,
  Truck,
  Trash2,
  Edit3,
  ExternalLink,
  AlertCircle,
  Sliders,
  Layers
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';

export default function SellerDashboardPage() {
  const { user, login, showToast, categories = [] } = useMarketplace();
  const [activeTab, setActiveTab] = useState('orders');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Product Form State
  const [editingProductId, setEditingProductId] = useState(null);
  const [prodForm, setProdForm] = useState({
    title: '',
    sku: '',
    categorySlug: 'homemade-pantry',
    description: '',
    highlights: '',
    priceLkr: '',
    compareAtPriceLkr: '',
    stock: '25',
    imageUrl: '',
    isHomemade: true
  });
  const [variantGroupName, setVariantGroupName] = useState('Set Size');
  const [variantRows, setVariantRows] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleAddVariantRow = () => {
    setVariantRows((prev) => [
      ...prev,
      {
        label: '',
        priceLkr: prodForm.priceLkr || '',
        stock: prodForm.stock || '15'
      }
    ]);
  };

  const handleVariantRowChange = (index, field, value) => {
    setVariantRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveVariantRow = (index) => {
    setVariantRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Storefront Settings Form State
  const [storeForm, setStoreForm] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/seller/dashboard');
      setData(res);
      if (res.seller) {
        setStoreForm({
          storeName: res.seller.storeName,
          sellerType: res.seller.sellerType,
          description: res.seller.description,
          contactPhone: res.seller.contactPhone,
          district: res.seller.district,
          city: res.seller.city,
          businessAddress: res.seller.businessAddress,
          freeShippingThresholdLkr: res.seller.shippingPolicy?.freeShippingThresholdLkr || 0,
          flatRateIntraLkr: res.seller.shippingPolicy?.flatRateIntraLkr || 280,
          bankName: res.seller.bankDetails?.bankName || 'Sampath Bank',
          branchName: res.seller.bankDetails?.branchName || '',
          accountHolderName: res.seller.bankDetails?.accountHolderName || '',
          accountNumber: res.seller.bankDetails?.accountNumber || ''
        });
      }
    } catch (_err) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === 'seller' || user.role === 'admin')) {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, [user, fetchDashboard]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Yaans.lk Seller Portal Access
          </h1>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Sign in with your verified Seller account to manage your store listings, images, orders, and courier fulfillment.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-3">
            <Link
              to="/login?redirect=/seller/dashboard"
              className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition"
            >
              Sign In to Seller Portal
            </Link>
            <Link
              to="/seller/register"
              className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-sm transition"
            >
              Apply to Sell on Yaans.lk
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== 'seller' && user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center mx-auto text-slate-800">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Seller Account Required
          </h1>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            You are signed in as <strong className="text-slate-900">{user.name}</strong> with a customer account. To open a store, list products, and sell across Sri Lanka, submit your seller application.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-3">
            <Link
              to="/seller/register"
              className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-sm transition"
            >
              Apply as a Seller
            </Link>
            <Link
              to="/"
              className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
            >
              Return to Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const seller = data?.seller;
  const metrics = data?.metrics || {};
  const products = data?.products || [];
  const subOrders = data?.subOrders || [];
  const settlements = data?.settlements || [];

  const handleImageFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      setUploadingImage(true);
      const res = await apiRequest('/seller/upload-image', {
        method: 'POST',
        body: formData
      });
      setProdForm((prev) => ({ ...prev, imageUrl: res.url }));
      showToast(`Image uploaded (${res.provider === 'cloudinary' ? 'Cloudinary CDN' : 'Optimized Storage'})!`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const validVariants = variantRows
        .filter((v) => v.label && v.label.trim())
        .map((v) => ({
          label: v.label.trim(),
          priceLkr: Number(v.priceLkr) || Number(prodForm.priceLkr) || 0,
          stock: Math.max(0, Number(v.stock) || 0)
        }));

      const payload = {
        title: prodForm.title,
        sku: prodForm.sku,
        categorySlug: prodForm.categorySlug,
        description: prodForm.description,
        highlights: prodForm.highlights,
        priceLkr: Number(prodForm.priceLkr),
        compareAtPriceLkr: prodForm.compareAtPriceLkr ? Number(prodForm.compareAtPriceLkr) : null,
        stock: Number(prodForm.stock),
        images: prodForm.imageUrl ? [prodForm.imageUrl] : undefined,
        isHomemade: prodForm.isHomemade,
        variants:
          validVariants.length > 0
            ? [
                {
                  name: (variantGroupName || 'Set Size').trim(),
                  values: validVariants
                }
              ]
            : []
      };

      if (editingProductId) {
        await apiRequest(`/seller/products/${editingProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Product updated!');
      } else {
        await apiRequest('/seller/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('New product added to store!');
      }

      setEditingProductId(null);
      setVariantGroupName('Set Size');
      setVariantRows([]);
      setProdForm({
        title: '',
        sku: '',
        categorySlug: 'homemade-pantry',
        description: '',
        highlights: '',
        priceLkr: '',
        compareAtPriceLkr: '',
        stock: '25',
        imageUrl: '',
        isHomemade: seller?.isHomemadeVendor ?? true
      });
      fetchDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const startEditProduct = (prod) => {
    setEditingProductId(prod._id);
    setProdForm({
      title: prod.title,
      sku: prod.sku,
      categorySlug: prod.categorySlug,
      description: prod.description,
      highlights: (prod.highlights || []).join('\n'),
      priceLkr: String(prod.priceLkr),
      compareAtPriceLkr: prod.compareAtPriceLkr ? String(prod.compareAtPriceLkr) : '',
      stock: String(prod.stock),
      imageUrl: prod.images?.[0] || '',
      isHomemade: Boolean(prod.isHomemade)
    });

    const existingVg = prod.variants?.[0];
    setVariantGroupName(existingVg?.name || 'Set Size');
    if (existingVg?.values?.length > 0) {
      setVariantRows(
        existingVg.values.map((v) => ({
          label: v.label || '',
          priceLkr: v.priceLkr !== undefined ? String(v.priceLkr) : '',
          stock: v.stock !== undefined ? String(v.stock) : '15'
        }))
      );
    } else {
      setVariantRows([]);
    }

    setActiveTab('products');
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await apiRequest(`/seller/products/${productId}`, { method: 'DELETE' });
      showToast('Product deleted');
      fetchDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSubOrderStatusChange = async (subOrderId, fulfillmentStatus, trackingCode) => {
    try {
      await apiRequest(`/seller/suborders/${subOrderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ fulfillmentStatus, trackingCode })
      });
      showToast(`Order updated to ${fulfillmentStatus.replace(/_/g, ' ')}`);
      fetchDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveStoreSettings = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/seller/profile', {
        method: 'PUT',
        body: JSON.stringify({
          storeName: storeForm.storeName,
          sellerType: storeForm.sellerType,
          description: storeForm.description,
          contactPhone: storeForm.contactPhone,
          district: storeForm.district,
          city: storeForm.city,
          businessAddress: storeForm.businessAddress,
          shippingPolicy: {
            freeShippingThresholdLkr: Number(storeForm.freeShippingThresholdLkr) || 0,
            flatRateIntraLkr: Number(storeForm.flatRateIntraLkr) || 280
          },
          bankDetails: {
            bankName: storeForm.bankName,
            branchName: storeForm.branchName,
            accountHolderName: storeForm.accountHolderName,
            accountNumber: storeForm.accountNumber
          }
        })
      });
      showToast('Storefront & shipping settings saved!');
      fetchDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      {/* Seller Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src={seller?.logoUrl}
            alt={seller?.storeName}
            className="w-14 h-14 rounded-xl object-cover border border-slate-200"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                {seller?.storeName} — Seller Portal
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                  seller?.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {seller?.status}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {seller?.sellerType} • Origin: <strong>{seller?.city}, {seller?.district}</strong> • Marketplace Commission:{' '}
              <strong>{data?.effectiveCommissionRate}%</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {seller?.slug && (
            <Link
              to={`/store/${seller.slug}`}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5"
            >
              View Public Storefront <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {seller?.status === 'pending' && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
          <span>
            <strong>Your Seller Application is Pending Admin Approval:</strong> You can prepare your product catalog now. Once a Yaans.lk Admin approves your store, your products will automatically go live in the marketplace.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Gross Item Sales</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {formatLkr(metrics.grossSalesLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{metrics.totalSubOrders} seller packages</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Net Seller Earnings</div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1">
            {formatLkr(metrics.netEarningsLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            After {data?.effectiveCommissionRate}% commission ({formatLkr(metrics.totalCommissionLkr)})
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Ready for Settlement</div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-700 mt-1">
            {formatLkr(metrics.eligibleForPayoutLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Delivered & COD collected</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Settled to Bank</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {formatLkr(metrics.settledEarningsLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{settlements.length} bank payout(s)</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Catalog Listings</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {metrics.totalProducts}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics.approvedProducts} live • {metrics.pendingProducts} pending
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[
          { id: 'orders', label: `Split Orders & COD (${subOrders.length})`, icon: Package },
          { id: 'products', label: `Products & Cloudinary Upload (${products.length})`, icon: ShoppingBag },
          { id: 'earnings', label: 'Earnings & Settlements Ledger', icon: Banknote },
          { id: 'settings', label: 'Storefront & District Shipping Rules', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SELLER SUB-ORDERS & COD FULFILLMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {subOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No orders assigned to your store yet.
            </div>
          ) : (
            subOrders.map((sub) => (
              <div
                key={sub._id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">
                        Sub-Order #{sub.subOrderNumber}
                      </span>
                      <span className="text-xs text-slate-500">
                        (Master Order #{sub.parentOrderNumber})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold uppercase">
                        {sub.fulfillmentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Deliver to: <strong>{sub.customerName}</strong> ({sub.customerPhone}) —{' '}
                      {sub.shippingAddress?.addressLine1}, {sub.shippingAddress?.city},{' '}
                      <strong>{sub.shippingAddress?.district} District</strong>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <div className="text-slate-500">
                      Customer COD Total: <strong>{formatLkr(sub.grossTotalLkr)}</strong>
                    </div>
                    <div className="text-emerald-700 font-bold text-sm">
                      Your Net Payout: {formatLkr(sub.netSellerEarningsLkr)}{' '}
                      <span className="text-[11px] font-normal text-slate-500">
                        (after {sub.commissionRatePercent}% fee)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-7 space-y-2">
                    {sub.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-11 h-11 rounded border border-slate-200 object-cover"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-slate-900">{item.title}</div>
                          <div className="text-slate-500">
                            Variant: {item.variantLabel} • Qty: {item.quantity} ×{' '}
                            {formatLkr(item.unitPriceLkr)}
                          </div>
                        </div>
                        <div className="font-bold text-slate-900">{formatLkr(item.lineTotalLkr)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Fulfillment Action Buttons */}
                  <div className="lg:col-span-5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">Update Fulfillment & COD:</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Settlement: {sub.settlementStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { status: 'packed', label: 'Mark Packed' },
                        { status: 'shipped', label: 'Mark Shipped' },
                        { status: 'out_for_delivery', label: 'Out for Delivery' },
                        { status: 'delivered', label: 'Delivered & COD Collected' }
                      ].map((btn) => (
                        <button
                          key={btn.status}
                          type="button"
                          onClick={() =>
                            handleSubOrderStatusChange(sub._id, btn.status, sub.trackingCode)
                          }
                          className={`px-2.5 py-1.5 rounded-lg font-bold transition ${
                            sub.fulfillmentStatus === btn.status
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: PRODUCTS & CLOUDINARY UPLOAD */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Create / Edit Product Form (5 cols) */}
          <form
            onSubmit={handleSaveProduct}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3.5 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900">
                {editingProductId ? 'Edit Product Listing' : 'Add New Product to Store'}
              </h2>
              {editingProductId && (
                <button
                  type="button"
                  onClick={() => setEditingProductId(null)}
                  className="text-sky-700 font-bold"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Product Title *</label>
              <input
                type="text"
                required
                value={prodForm.title}
                onChange={(e) => setProdForm({ ...prodForm, title: e.target.value })}
                placeholder="e.g., Homemade Crispy Seeni Sambol (350g Glass Jar)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department *</label>
                <select
                  value={prodForm.categorySlug}
                  onChange={(e) => setProdForm({ ...prodForm, categorySlug: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  {(categories.length > 0 ? categories : (data?.categories || [])).map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">SKU Code</label>
                <input
                  type="text"
                  value={prodForm.sku}
                  onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                  placeholder="Auto-generated if empty"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Price (Rs.) *</label>
                <input
                  type="number"
                  required
                  value={prodForm.priceLkr}
                  onChange={(e) => setProdForm({ ...prodForm, priceLkr: e.target.value })}
                  placeholder="1250"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Old Price (Rs.)</label>
                <input
                  type="number"
                  value={prodForm.compareAtPriceLkr}
                  onChange={(e) => setProdForm({ ...prodForm, compareAtPriceLkr: e.target.value })}
                  placeholder="1500"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Stock Qty *</label>
                <input
                  type="number"
                  required
                  value={prodForm.stock}
                  onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            {/* Dynamic Product Sets & Variant Offers Builder */}
            <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Sliders className="w-3.5 h-3.5 text-amber-600" />
                    Product Sets, Combo Offers & Variants (Optional)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Add clickable sets or options for customers (e.g. 3-Pot Set vs 5-Pot Set, or 250g vs 500g).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariantRow}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Set / Offer
                </button>
              </div>

              {/* Option Group Name & Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="font-semibold text-slate-700">Option Type:</span>
                <input
                  type="text"
                  value={variantGroupName}
                  onChange={(e) => setVariantGroupName(e.target.value)}
                  placeholder="e.g. Set Size, Pack Option, Weight"
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-slate-800 w-36"
                />
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                  <span>Presets:</span>
                  {['Set Size', 'Pack Option', 'Weight', 'Bottle Size'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setVariantGroupName(preset)}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant Rows Table / List */}
              {variantRows.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase px-1">
                    <div className="col-span-6">Offer / Set Label</div>
                    <div className="col-span-3">Price (Rs.)</div>
                    <div className="col-span-2">Stock</div>
                    <div className="col-span-1 text-right">Del</div>
                  </div>

                  {variantRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                      <div className="col-span-6">
                        <input
                          type="text"
                          required
                          value={row.label}
                          onChange={(e) => handleVariantRowChange(idx, 'label', e.target.value)}
                          placeholder="e.g. 3-Pot Set + 2 Katu Handi"
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-semibold"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          required
                          value={row.priceLkr}
                          onChange={(e) => handleVariantRowChange(idx, 'priceLkr', e.target.value)}
                          placeholder="3250"
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          value={row.stock}
                          onChange={(e) => handleVariantRowChange(idx, 'stock', e.target.value)}
                          placeholder="20"
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(idx)}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                          title="Remove this set option"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic bg-white p-2.5 rounded-lg border border-dashed border-slate-300 text-center">
                  No sets or offers added. Sells at base price above. Click <strong>&quot;+ Add Set / Offer&quot;</strong> to create multi-item bundles or sets (e.g., 3-Pot vs 5-Pot).
                </div>
              )}
            </div>

            {/* Cloudinary Image Upload */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Product Image (Cloudinary Upload or URL)
                </label>
                {uploadingImage && <span className="text-sky-700 font-semibold">Uploading...</span>}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileUpload}
                className="w-full text-xs"
              />
              <input
                type="text"
                value={prodForm.imageUrl}
                onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })}
                placeholder="Or paste image URL..."
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Description *</label>
              <textarea
                rows={3}
                required
                value={prodForm.description}
                onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                placeholder="Describe ingredients, warranty, size, or craftsmanship..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={prodForm.isHomemade}
                onChange={(e) => setProdForm({ ...prodForm, isHomemade: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Display &quot;Homemade SL&quot; Badge on this listing</span>
            </label>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm"
            >
              {editingProductId ? 'Save Product Changes' : 'Publish Product Listing'}
            </button>
          </form>

          {/* Right: Seller Catalog Table (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">
              Your Store Products ({products.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {products.map((prod) => (
                <div
                  key={prod._id}
                  className="py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={prod.images?.[0]}
                      alt={prod.title}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{prod.title}</div>
                      <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-slate-900">{formatLkr(prod.priceLkr)}</span>
                        <span>• Stock: {prod.stock}</span>
                        <span>• Sold: {prod.soldCount}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            prod.approvalStatus === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {prod.approvalStatus}
                        </span>
                        {prod.variants?.[0]?.values?.length > 1 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                            {prod.variants[0].values.length} Sets / Offers
                          </span>
                        )}
                      </div>
                      {prod.lastEditedBy === 'admin' && (
                        <div className="mt-1 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded inline-flex flex-wrap items-center gap-1">
                          <span className="font-bold">Reviewed & Updated by Marketplace Admin</span>
                          {prod.adminNote && <span className="font-normal italic">• Note: {prod.adminNote}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditProduct(prod)}
                      className="px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-100 font-semibold inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(prod._id)}
                      className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EARNINGS & SETTLEMENTS LEDGER */}
      {activeTab === 'earnings' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">
              Completed Bank Payout Settlements ({settlements.length})
            </h2>
            {settlements.length === 0 ? (
              <p className="text-xs text-slate-500">
                No completed settlements yet. Once delivered COD orders are reconciled by Admin, bank payouts appear here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2">Settlement Ref</th>
                      <th className="py-2">Gross Items</th>
                      <th className="py-2">Yaans.lk Commission</th>
                      <th className="py-2">Net Payout (LKR)</th>
                      <th className="py-2">Bank Reference</th>
                      <th className="py-2">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settlements.map((st) => (
                      <tr key={st._id}>
                        <td className="py-2.5 font-bold text-slate-900">{st.settlementReference}</td>
                        <td className="py-2.5">{formatLkr(st.grossOrderItemsLkr)}</td>
                        <td className="py-2.5 text-red-600">-{formatLkr(st.platformCommissionLkr)}</td>
                        <td className="py-2.5 font-extrabold text-emerald-700">
                          {formatLkr(st.netPayoutLkr)}
                        </td>
                        <td className="py-2.5 font-mono text-slate-600">{st.bankReference}</td>
                        <td className="py-2.5 text-slate-500">
                          {new Date(st.paidAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">
              Per-Order Commission & Net Earnings Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2">Sub-Order</th>
                    <th className="py-2">Fulfillment</th>
                    <th className="py-2">Items Subtotal</th>
                    <th className="py-2">Commission ({data?.effectiveCommissionRate}%)</th>
                    <th className="py-2">Net Seller Earnings</th>
                    <th className="py-2">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subOrders.map((s) => (
                    <tr key={s._id}>
                      <td className="py-2.5 font-bold text-slate-900">{s.subOrderNumber}</td>
                      <td className="py-2.5 uppercase">{s.fulfillmentStatus.replace(/_/g, ' ')}</td>
                      <td className="py-2.5">{formatLkr(s.itemsSubtotalLkr)}</td>
                      <td className="py-2.5 text-red-600">-{formatLkr(s.commissionAmountLkr)}</td>
                      <td className="py-2.5 font-bold text-emerald-700">
                        {formatLkr(s.netSellerEarningsLkr)}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.settlementStatus === 'settled'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.settlementStatus === 'eligible_for_payout'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {s.settlementStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STOREFRONT & SHIPPING SETTINGS */}
      {activeTab === 'settings' && storeForm && (
        <form
          onSubmit={handleSaveStoreSettings}
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-3xl text-xs"
        >
          <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-2.5">
            Storefront Profile, Origin District & Bank Settlement Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Store Name</label>
              <input
                type="text"
                value={storeForm.storeName}
                onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Origin District</label>
              <select
                value={storeForm.district}
                onChange={(e) => setStoreForm({ ...storeForm, district: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                {DEFAULT_SL_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Free Delivery Threshold (LKR, 0 to disable)
              </label>
              <input
                type="number"
                value={storeForm.freeShippingThresholdLkr}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, freeShippingThresholdLkr: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Same-District Flat Rate Override (Rs.)
              </label>
              <input
                type="number"
                value={storeForm.flatRateIntraLkr}
                onChange={(e) => setStoreForm({ ...storeForm, flatRateIntraLkr: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Store Description</label>
              <textarea
                rows={3}
                value={storeForm.description}
                onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={storeForm.bankName}
                onChange={(e) => setStoreForm({ ...storeForm, bankName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={storeForm.accountNumber}
                onChange={(e) => setStoreForm({ ...storeForm, accountNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
          >
            Save Storefront & Shipping Configuration
          </button>
        </form>
      )}
    </div>
  );
}
