import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Store,
  ShoppingBag,
  MapPin,
  Banknote,
  Package,
  XCircle,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

const SellerModerationTab = lazy(() => import('./admin/SellerModerationTab.jsx'));
const ProductModerationTab = lazy(() => import('./admin/ProductModerationTab.jsx'));
const BannerManagementTab = lazy(() => import('./admin/BannerManagementTab.jsx'));
const DistrictShippingTab = lazy(() => import('./admin/DistrictShippingTab.jsx'));
const SettlementsTab = lazy(() => import('./admin/SettlementsTab.jsx'));
const OrdersTab = lazy(() => import('./admin/OrdersTab.jsx'));
const AdminAccountTab = lazy(() => import('./admin/AdminAccountTab.jsx'));
const AdminAuditLogTab = lazy(() => import('./admin/AdminAuditLogTab.jsx'));

export default function AdminDashboardPage() {
  const {
    user,
    logout,
    refreshUser,
    showToast,
    refreshCategories,
    categories: marketplaceCategories
  } = useMarketplace();
  const navigate = useNavigate();

  const [activeTab, setActiveTabState] = useState(() => {
    return localStorage.getItem('yaans_admin_active_tab') || 'sellers';
  });
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    localStorage.setItem('yaans_admin_active_tab', tab);
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Shared Config States for Header / Tabs
  const [districtsState, setDistrictsState] = useState([]);
  const [shippingMode, setShippingMode] = useState('custom'); // 'custom' | 'flat'
  const [flatShippingRate, setFlatShippingRate] = useState(350);
  const [bannersState, setBannersState] = useState([]);
  const [generalCfg, setGeneralCfg] = useState({
    defaultCommissionPercent: 8,
    homemadeCommissionPercent: 5,
    codEnabledGlobally: true,
    codMaxOrderLimitLkr: 75000,
    globalFreeShippingMinLkr: 0
  });

  const fetchOverview = useCallback(async (isRetry = false) => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await apiRequest(`/admin/overview?_t=${Date.now()}`);
      setData(res);
      setDistrictsState(res.platformConfig?.districts || []);
      setBannersState(res.platformConfig?.banners || []);
      if (res.platformConfig) {
        setShippingMode(res.platformConfig.shippingMode || 'custom');
        setFlatShippingRate(res.platformConfig.flatShippingRateLkr ?? 350);
        setGeneralCfg({
          defaultCommissionPercent: res.platformConfig.defaultCommissionPercent ?? 8,
          homemadeCommissionPercent: res.platformConfig.homemadeCommissionPercent ?? 5,
          codEnabledGlobally: res.platformConfig.codEnabledGlobally ?? true,
          codMaxOrderLimitLkr: res.platformConfig.codMaxOrderLimitLkr ?? 75000,
          globalFreeShippingMinLkr: res.platformConfig.globalFreeShippingMinLkr ?? 0
        });
      }
    } catch (err) {
      if (!isRetry) {
        // Auto-retry once after 800ms for transient serverless cold-start or token check
        setTimeout(() => {
          fetchOverview(true);
        }, 800);
      } else {
        setFetchError(err.message || 'Unable to load dashboard data.');
      }
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

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
            <XCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Access Denied</h1>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            You are currently signed in as <strong className="text-slate-900">{user.name}</strong> (
            {user.role} role). This dashboard requires Administrator privileges.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
            >
              Back to Marketplace
            </Link>
            <button
              type="button"
              onClick={async () => {
                if(await logout())navigate('/admin/login');
              }}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
            >
              Sign In to Admin Console
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

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Connecting to Admin Services</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {fetchError || 'Establishing connection to the Yaans.lk marketplace overview.'}
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => fetchOverview(true)}
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Dashboard Data
          </button>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const sellers = data?.sellers || [];
  const products = data?.products || [];
  const orders = data?.orders || [];
  const subOrders = data?.subOrders || [];
  const settlements = data?.settlements || [];
  const categories = data?.categories || marketplaceCategories || [];

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
          <button
            type="button"
            onClick={() => fetchOverview(true)}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 font-bold"
            title="Refresh marketplace statistics and banners"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>
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
          <div className="text-[11px] font-bold uppercase text-slate-400">Active Sellers &amp; Catalog</div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {metrics.approvedSellersCount} / {metrics.totalSellers} Sellers
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics.totalProducts} Products • {metrics.totalCustomers} Customers
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {[
          { id: 'sellers', label: `Seller Approvals & Commission (${sellers.length})`, icon: Store },
          { id: 'products', label: `Product & Category Moderation (${products.length})`, icon: ShoppingBag },
          { id: 'banners', label: `Homepage Banners (${bannersState.length || 0})`, icon: ImageIcon },
          {
            id: 'districts',
            label:
              shippingMode === 'flat'
                ? `25 Districts & COD (Flat Rate: Rs. ${flatShippingRate})`
                : '25 Sri Lankan Districts & COD Matrix',
            icon: MapPin
          },
          { id: 'settlements', label: 'Commissions & Seller Settlements', icon: Banknote },
          { id: 'orders', label: `All Split Orders (${orders.length})`, icon: Package },
          { id: 'account', label: 'Admin Account & Security', icon: ShieldCheck },
          { id: 'audit', label: `Security & Audit Logs (${data?.platformConfig?.adminAuditLogs?.length || 0})`, icon: ShieldAlert }
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

      <Suspense
        fallback={
          <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
        }
      >
        {/* TAB 1: SELLER APPLICATIONS & MANAGEMENT */}
        {activeTab === 'sellers' && (
          <SellerModerationTab
            sellers={sellers}
            generalCfg={generalCfg}
            handleSellerModeration={handleSellerModeration}
          />
        )}

        {/* TAB 2: PRODUCT & CATEGORY MODERATION */}
        {activeTab === 'products' && (
          <ProductModerationTab
            products={products}
            categories={categories}
            showToast={showToast}
            fetchOverview={fetchOverview}
            refreshCategories={refreshCategories}
          />
        )}

        {/* TAB 3: HOMEPAGE HERO BANNERS */}
        {activeTab === 'banners' && (
          <BannerManagementTab
            bannersState={bannersState}
            categories={categories}
            showToast={showToast}
            fetchOverview={fetchOverview}
          />
        )}

        {/* TAB 4: 25 SRI LANKAN DISTRICTS DELIVERY FEE & COD MATRIX */}
        {activeTab === 'districts' && (
          <DistrictShippingTab
            districtsState={districtsState}
            setDistrictsState={setDistrictsState}
            shippingMode={shippingMode}
            setShippingMode={setShippingMode}
            flatShippingRate={flatShippingRate}
            setFlatShippingRate={setFlatShippingRate}
            showToast={showToast}
            fetchOverview={fetchOverview}
          />
        )}

        {/* TAB 5: COMMISSIONS & SELLER SETTLEMENT RECONCILIATION */}
        {activeTab === 'settlements' && (
          <SettlementsTab
            generalCfg={generalCfg}
            setGeneralCfg={setGeneralCfg}
            sellers={sellers}
            subOrders={subOrders}
            settlements={settlements}
            showToast={showToast}
            fetchOverview={fetchOverview}
          />
        )}

        {/* TAB 6: ALL MASTER ORDERS & SPLIT SUB-ORDERS */}
        {activeTab === 'orders' && <OrdersTab orders={orders} subOrders={subOrders} />}

        {/* TAB 7: ADMIN ACCOUNT & SECURITY CREDENTIALS */}
        {activeTab === 'account' && (
          <AdminAccountTab user={user} refreshUser={refreshUser} showToast={showToast} />
        )}

        {/* TAB 8: SECURITY & AUDIT LOGS */}
        {activeTab === 'audit' && (
          <AdminAuditLogTab auditLogs={data?.platformConfig?.adminAuditLogs || []} />
        )}
      </Suspense>
    </div>
  );
}
