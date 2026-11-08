import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Store,
  ShoppingBag,
  MapPin,
  Banknote,
  Package,
  CheckCircle2,
  XCircle,
  Sliders,
  Image as ImageIcon
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

export default function AdminDashboardPage() {
  const { user, login, showToast } = useMarketplace();
  const [activeTab, setActiveTab] = useState('sellers');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editable Districts State
  const [districtsState, setDistrictsState] = useState([]);
  // Editable General Config State
  const [generalCfg, setGeneralCfg] = useState({
    defaultCommissionPercent: 8,
    homemadeCommissionPercent: 5,
    codEnabledGlobally: true,
    codMaxOrderLimitLkr: 75000,
    globalFreeShippingMinLkr: 0
  });

  // New Category Form
  const [catName, setCatName] = useState('');
  const [catHeadline, setCatHeadline] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/overview');
      setData(res);
      setDistrictsState(res.platformConfig?.districts || []);
      if (res.platformConfig) {
        setGeneralCfg({
          defaultCommissionPercent: res.platformConfig.defaultCommissionPercent ?? 8,
          homemadeCommissionPercent: res.platformConfig.homemadeCommissionPercent ?? 5,
          codEnabledGlobally: res.platformConfig.codEnabledGlobally ?? true,
          codMaxOrderLimitLkr: res.platformConfig.codMaxOrderLimitLkr ?? 75000,
          globalFreeShippingMinLkr: res.platformConfig.globalFreeShippingMinLkr ?? 0
        });
      }
    } catch (_err) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchOverview();
    } else {
      setLoading(false);
    }
  }, [user, fetchOverview]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
          <ShieldCheck className="w-10 h-10 text-slate-800 mx-auto" />
          <h1 className="text-lg font-extrabold text-slate-900">
            Yaans.lk Admin & Management Dashboard
          </h1>
          <p className="text-xs text-slate-600">
            Role-based access required. Sign in as Marketplace Admin to manage sellers, products, 25 Sri Lankan district courier rates, commissions, and seller settlements.
          </p>
          <button
            type="button"
            onClick={() => login('admin@yaans.lk', 'Admin@123')}
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
          >
            1-Click Demo Admin Sign-In
          </button>
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

  const metrics = data?.metrics || {};
  const sellers = data?.sellers || [];
  const products = data?.products || [];
  const orders = data?.orders || [];
  const subOrders = data?.subOrders || [];
  const settlements = data?.settlements || [];

  const handleSellerModeration = async (sellerId, status, commissionRateOverride) => {
    try {
      await apiRequest(`/admin/sellers/${sellerId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, commissionRateOverride })
      });
      showToast(`Seller status updated to ${status}`);
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleProductModeration = async (productId, payload) => {
    try {
      await apiRequest(`/admin/products/${productId}/moderation`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Product listing updated');
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveDistricts = async () => {
    try {
      await apiRequest('/admin/config/districts', {
        method: 'PUT',
        body: JSON.stringify({ districts: districtsState })
      });
      showToast('All 25 Sri Lankan district delivery fees & COD settings saved!');
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveGeneralConfig = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/config/general', {
        method: 'PUT',
        body: JSON.stringify(generalCfg)
      });
      showToast('Marketplace commissions & COD rules updated!');
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSettleSellerPayout = async (sellerId) => {
    try {
      const res = await apiRequest('/admin/settlements/payout', {
        method: 'POST',
        body: JSON.stringify({ sellerId })
      });
      showToast(res.message);
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName || !catHeadline) return;
    try {
      await apiRequest('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: catName, quadHeadline: catHeadline })
      });
      setCatName('');
      setCatHeadline('');
      showToast('New category & 2x2 quad card added!');
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      {/* Admin Top Header */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[11px] font-bold uppercase">
            Desktop-First Management Console
          </span>
          <h1 className="text-lg sm:text-2xl font-extrabold mt-1">
            Yaans.lk Marketplace Administration
          </h1>
          <p className="text-xs text-slate-300">
            Manage Sri Lankan sellers, product moderation, 25-district courier fees, commissions, and COD settlements.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-700">
            <div className="text-slate-400">Pending Seller Approvals</div>
            <div className="text-base font-extrabold text-amber-400">
              {metrics.pendingSellersCount || 0}
            </div>
          </div>
          <div className="bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-700">
            <div className="text-slate-400">Pending Product Reviews</div>
            <div className="text-base font-extrabold text-sky-400">
              {metrics.pendingProductsCount || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Marketplace KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Total Marketplace GMV</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {formatLkr(metrics.totalGmvLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics.totalOrders} Master Orders ({metrics.totalSubOrders} Split Packages)
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Platform Commission</div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1">
            {formatLkr(metrics.totalCommissionEarnedLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            5% Homemade / {generalCfg.defaultCommissionPercent}% Standard
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Unsettled Seller Payouts</div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-700 mt-1">
            {formatLkr(metrics.unsettledPayoutLiabilityLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ready for bank settlement</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Settled to Sellers</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {formatLkr(metrics.totalSettledPayoutsLkr)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Completed CEFT/SLIPS payouts</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Active Sellers & Catalog</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {metrics.approvedSellersCount} / {metrics.totalSellers} Sellers
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics.totalProducts} Products • {metrics.totalCustomers} Customers
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[
          { id: 'sellers', label: `Seller Approvals & Commission (${sellers.length})`, icon: Store },
          { id: 'products', label: `Product & Category Moderation (${products.length})`, icon: ShoppingBag },
          { id: 'districts', label: '25 Sri Lankan Districts & COD Matrix', icon: MapPin },
          { id: 'settlements', label: 'Commissions & Seller Settlements', icon: Banknote },
          { id: 'orders', label: `All Split Orders (${orders.length})`, icon: Package }
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

      {/* TAB 1: SELLER APPLICATIONS & MANAGEMENT */}
      {activeTab === 'sellers' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900">
            Seller Applications, Verification & Commission Overrides
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5">Storefront & Type</th>
                  <th className="py-2.5">District & NIC/BR</th>
                  <th className="py-2.5">Bank Account</th>
                  <th className="py-2.5">Commission %</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sellers.map((s) => (
                  <tr key={s._id}>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900">{s.storeName}</div>
                      <div className="text-slate-500">
                        {s.sellerType} • {s.contactEmail} ({s.contactPhone})
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">
                        {s.city}, {s.district}
                      </div>
                      <div className="text-slate-500">NIC/BR: {s.nicOrBrNumber}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="text-slate-800">{s.bankDetails?.bankName}</div>
                      <div className="text-slate-500 font-mono">{s.bankDetails?.accountNumber}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-bold text-slate-900">
                        {s.commissionRateOverride !== null && s.commissionRateOverride !== undefined
                          ? `${s.commissionRateOverride}% (Custom)`
                          : s.isHomemadeVendor
                          ? `${generalCfg.homemadeCommissionPercent}% (Homemade)`
                          : `${generalCfg.defaultCommissionPercent}% (Default)`}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'pending'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                      {s.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSellerModeration(s._id, 'approved', s.commissionRateOverride)
                          }
                          className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          Approve Seller
                        </button>
                      )}
                      {s.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSellerModeration(s._id, 'rejected', s.commissionRateOverride)
                          }
                          className="px-2.5 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 font-semibold"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT & CATEGORY MODERATION */}
      {activeTab === 'products' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900">
              Product Listing Moderation ({products.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2">Product</th>
                    <th className="py-2">Seller & District</th>
                    <th className="py-2">Price (LKR)</th>
                    <th className="py-2">Badges</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p._id}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.images?.[0]}
                            alt={p.title}
                            className="w-10 h-10 rounded object-cover border border-slate-200"
                          />
                          <div>
                            <div className="font-bold text-slate-900 line-clamp-1">{p.title}</div>
                            <div className="text-slate-500">SKU: {p.sku} • Stock: {p.stock}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-slate-800">{p.sellerName}</div>
                        <div className="text-slate-500">{p.sellerDistrict}</div>
                      </td>
                      <td className="py-2.5 pr-3 font-bold text-slate-900">
                        {formatLkr(p.priceLkr)}
                      </td>
                      <td className="py-2.5 pr-3 space-x-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleProductModeration(p._id, { isFeatured: !p.isFeatured })
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            p.isFeatured
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          Featured
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProductModeration(p._id, { isDeal: !p.isDeal })}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            p.isDeal
                              ? 'bg-amber-400 text-slate-950 border-amber-500'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          Deal
                        </button>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.approvalStatus === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.approvalStatus === 'pending'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.approvalStatus}
                        </span>
                      </td>
                      <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                        {p.approvalStatus !== 'approved' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleProductModeration(p._id, { approvalStatus: 'approved' })
                            }
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold"
                          >
                            Approve
                          </button>
                        )}
                        {p.approvalStatus !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleProductModeration(p._id, { approvalStatus: 'rejected' })
                            }
                            className="px-2.5 py-1 rounded border border-red-300 text-red-700 font-semibold"
                          >
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add New Category & 2x2 Quad Card */}
          <form
            onSubmit={handleCreateCategory}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-end gap-3 text-xs"
          >
            <div>
              <label className="block font-bold text-slate-700 mb-1">New Category Name</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g., Ceylon Tea & Coffee"
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="block font-bold text-slate-700 mb-1">
                Homepage 2x2 Quad Card Headline
              </label>
              <input
                type="text"
                required
                value={catHeadline}
                onChange={(e) => setCatHeadline(e.target.value)}
                placeholder="e.g., Freshly Brewed Ceylon Tea & Estate Coffee"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold"
            >
              Add Category Quad Card
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: 25 SRI LANKAN DISTRICTS DELIVERY FEE & COD MATRIX */}
      {activeTab === 'districts' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                25 Sri Lankan Administrative Districts — Courier Fee & COD Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Configure Same-District (Intra), Standard, and Outstation courier fees in LKR (Rs.) + Cash on Delivery toggle per district.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDistricts}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-sm"
            >
              Save All 25 District Configs
            </button>
          </div>

          <div className="overflow-x-auto max-h-[540px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 px-2">District</th>
                  <th className="py-2 px-2">Province</th>
                  <th className="py-2 px-2">Same-District Fee (Rs.)</th>
                  <th className="py-2 px-2">Standard Fee (Rs.)</th>
                  <th className="py-2 px-2">Outstation Fee (Rs.)</th>
                  <th className="py-2 px-2">Est. Delivery Window</th>
                  <th className="py-2 px-2">COD Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {districtsState.map((d, idx) => (
                  <tr key={d.code || d.name}>
                    <td className="py-2 px-2 font-bold text-slate-900">{d.name}</td>
                    <td className="py-2 px-2 text-slate-500">{d.province}</td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={d.intraDistrictFee}
                        onChange={(e) => {
                          const next = [...districtsState];
                          next[idx] = { ...next[idx], intraDistrictFee: Number(e.target.value) };
                          setDistrictsState(next);
                        }}
                        className="w-20 px-2 py-1 rounded border border-slate-300 font-semibold"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={d.standardFee}
                        onChange={(e) => {
                          const next = [...districtsState];
                          next[idx] = { ...next[idx], standardFee: Number(e.target.value) };
                          setDistrictsState(next);
                        }}
                        className="w-20 px-2 py-1 rounded border border-slate-300 font-semibold"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={d.outstationFee}
                        onChange={(e) => {
                          const next = [...districtsState];
                          next[idx] = { ...next[idx], outstationFee: Number(e.target.value) };
                          setDistrictsState(next);
                        }}
                        className="w-20 px-2 py-1 rounded border border-slate-300 font-semibold"
                      />
                    </td>
                    <td className="py-2 px-2 text-slate-600">{d.estimatedDays}</td>
                    <td className="py-2 px-2">
                      <input
                        type="checkbox"
                        checked={d.codAvailable !== false}
                        onChange={(e) => {
                          const next = [...districtsState];
                          next[idx] = { ...next[idx], codAvailable: e.target.checked };
                          setDistrictsState(next);
                        }}
                        className="rounded border-slate-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMMISSIONS & SELLER SETTLEMENT RECONCILIATION */}
      {activeTab === 'settlements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Global Commission & COD Rules (5 cols) */}
          <form
            onSubmit={handleSaveGeneralConfig}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 text-xs"
          >
            <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-2.5">
              Marketplace Commission & COD Configuration
            </h2>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Standard Retail Seller Commission (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={generalCfg.defaultCommissionPercent}
                onChange={(e) =>
                  setGeneralCfg({ ...generalCfg, defaultCommissionPercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Homemade & Cottage Vendor Commission (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={generalCfg.homemadeCommissionPercent}
                onChange={(e) =>
                  setGeneralCfg({ ...generalCfg, homemadeCommissionPercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Max Cash on Delivery (COD) Order Limit (LKR)
              </label>
              <input
                type="number"
                value={generalCfg.codMaxOrderLimitLkr}
                onChange={(e) =>
                  setGeneralCfg({ ...generalCfg, codMaxOrderLimitLkr: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={generalCfg.codEnabledGlobally}
                onChange={(e) =>
                  setGeneralCfg({ ...generalCfg, codEnabledGlobally: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              <span>Enable Cash on Delivery (COD) Globally</span>
            </label>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              Save Commission & COD Rules
            </button>
          </form>

          {/* Right: Seller Payout Reconciliation Queue (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">
                Seller COD Payment Reconciliation & Payout Queue
              </h2>
              <p className="text-xs text-slate-600">
                When a courier delivers a COD sub-order and remits cash, the seller&apos;s net earnings become eligible for bank payout below.
              </p>

              <div className="space-y-3 pt-2">
                {sellers
                  .filter((s) => s.status === 'approved')
                  .map((s) => {
                    const eligibleSubs = subOrders.filter(
                      (sub) =>
                        sub.sellerId === s._id && sub.settlementStatus === 'eligible_for_payout'
                    );
                    const eligibleTotal = eligibleSubs.reduce(
                      (sum, sub) => sum + sub.netSellerEarningsLkr,
                      0
                    );
                    return (
                      <div
                        key={s._id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{s.storeName}</div>
                          <div className="text-slate-500">
                            {s.bankDetails?.bankName} ({s.bankDetails?.accountNumber}) •{' '}
                            {eligibleSubs.length} delivered sub-order(s) ready
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[11px] text-slate-500">Net Payable</div>
                            <div className="text-sm font-extrabold text-emerald-700">
                              {formatLkr(eligibleTotal)}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={eligibleSubs.length === 0}
                            onClick={() => handleSettleSellerPayout(s._id)}
                            className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 text-slate-950 font-bold"
                          >
                            Settle Payout
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Completed Settlements History */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">
                Settled Bank Payout Ledger ({settlements.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2">Ref</th>
                      <th className="py-2">Seller</th>
                      <th className="py-2">Gross</th>
                      <th className="py-2">Commission</th>
                      <th className="py-2">Net Paid</th>
                      <th className="py-2">Bank Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settlements.map((st) => (
                      <tr key={st._id}>
                        <td className="py-2 font-bold text-slate-900">{st.settlementReference}</td>
                        <td className="py-2">{st.sellerName}</td>
                        <td className="py-2">{formatLkr(st.grossOrderItemsLkr)}</td>
                        <td className="py-2 text-emerald-700 font-semibold">
                          +{formatLkr(st.platformCommissionLkr)}
                        </td>
                        <td className="py-2 font-extrabold text-slate-900">
                          {formatLkr(st.netPayoutLkr)}
                        </td>
                        <td className="py-2 font-mono text-slate-500">{st.bankReference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ALL MASTER ORDERS & SPLIT SUB-ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900">
            All Marketplace Orders & Multi-Seller Split Packages
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
      )}
    </div>
  );
}
