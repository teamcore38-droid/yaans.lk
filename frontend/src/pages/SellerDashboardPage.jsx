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
  AlertCircle
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';

export default function SellerDashboardPage() {
  const { user, login, showToast } = useMarketplace();
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
    variantName: 'Option',
    variantLabel1: 'Standard Pack',
    variantPrice1: '',
    isHomemade: true
  });
  const [uploadingImage, setUploadingImage] = useState(false);

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

  if (!user || (user.role !== 'seller' && user.role !== 'admin')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
          <Store className="w-10 h-10 text-slate-700 mx-auto" />
          <h1 className="text-lg font-extrabold text-slate-900">
            Yaans.lk Seller Portal Access
          </h1>
          <p className="text-xs text-slate-600">
            Sign in with a Seller account to manage products, Cloudinary images, split orders, and LKR earnings.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => login('kumari@kandykitchen.lk', 'Seller@123')}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs"
            >
              Demo Sign-In: Kandy Homemade Seller
            </button>
            <button
              type="button"
              onClick={() => login('rizwan@colombotech.lk', 'Seller@123')}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
            >
              Demo Sign-In: Colombo Tech Seller
            </button>
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
        variants: prodForm.variantLabel1
          ? [
              {
                name: prodForm.variantName || 'Option',
                values: [
                  {
                    label: prodForm.variantLabel1,
                    priceLkr: Number(prodForm.variantPrice1 || prodForm.priceLkr),
                    stock: Number(prodForm.stock)
                  }
                ]
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
        variantName: 'Option',
        variantLabel1: 'Standard Pack',
        variantPrice1: '',
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
      variantName: prod.variants?.[0]?.name || 'Option',
      variantLabel1: prod.variants?.[0]?.values?.[0]?.label || 'Standard',
      variantPrice1: String(prod.variants?.[0]?.values?.[0]?.priceLkr || prod.priceLkr),
      isHomemade: Boolean(prod.isHomemade)
    });
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
                  <option value="homemade-pantry">Homemade & Spices</option>
                  <option value="electronics">Electronics & Tech</option>
                  <option value="home-kitchen">Home & Clayware</option>
                  <option value="fashion-handloom">Fashion & Handloom</option>
                  <option value="ayurveda-beauty">Ayurveda & Beauty</option>
                  <option value="fitness-daily-deals">Fitness & Everyday</option>
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
                      </div>
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
