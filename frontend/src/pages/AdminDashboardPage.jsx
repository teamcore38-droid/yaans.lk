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
  Image as ImageIcon,
  Edit3,
  Trash2,
  X,
  Upload,
  AlertTriangle,
  Check,
  Plus
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

export default function AdminDashboardPage() {
  const { user, login, showToast, refreshCategories } = useMarketplace();
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

  // Category Edit Modal State
  const [editingCategory, setEditingCategory] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [uploadingCatCover, setUploadingCatCover] = useState(false);
  const [uploadingSubCatIndex, setUploadingSubCatIndex] = useState(null);
  const [catEditForm, setCatEditForm] = useState({
    name: '',
    quadHeadline: '',
    description: '',
    imageUrl: '',
    subCategories: []
  });

  // Admin Product Edit Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingAdminImage, setUploadingAdminImage] = useState(false);
  const [adminProdForm, setAdminProdForm] = useState({
    title: '',
    sku: '',
    categorySlug: 'homemade-pantry',
    subCategorySlug: '',
    description: '',
    highlights: '',
    priceLkr: '',
    compareAtPriceLkr: '',
    stock: '15',
    imageUrl: '',
    isHomemade: false,
    isFeatured: false,
    isDeal: false,
    codEligible: true,
    approvalStatus: 'approved',
    adminNote: '',
    tags: ''
  });
  const [adminVariantGroupName, setAdminVariantGroupName] = useState('Set Size');
  const [adminVariantRows, setAdminVariantRows] = useState([]);

  const handleAddAdminVariantRow = () => {
    setAdminVariantRows((prev) => [
      ...prev,
      {
        label: '',
        priceLkr: adminProdForm.priceLkr || '',
        stock: adminProdForm.stock || '15'
      }
    ]);
  };

  const handleAdminVariantRowChange = (index, field, value) => {
    setAdminVariantRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveAdminVariantRow = (index) => {
    setAdminVariantRows((prev) => prev.filter((_, idx) => idx !== index));
  };

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

  const openEditProductModal = (prod) => {
    setEditingProduct(prod);
    setAdminProdForm({
      title: prod.title || '',
      sku: prod.sku || '',
      categorySlug: prod.categorySlug || 'homemade-pantry',
      subCategorySlug: prod.subCategorySlug || '',
      description: prod.description || '',
      highlights: Array.isArray(prod.highlights) ? prod.highlights.join('\n') : '',
      priceLkr: prod.priceLkr !== undefined ? String(prod.priceLkr) : '',
      compareAtPriceLkr: prod.compareAtPriceLkr ? String(prod.compareAtPriceLkr) : '',
      stock: prod.stock !== undefined ? String(prod.stock) : '15',
      imageUrl: prod.images?.[0] || '',
      isHomemade: Boolean(prod.isHomemade),
      isFeatured: Boolean(prod.isFeatured),
      isDeal: Boolean(prod.isDeal),
      codEligible: prod.codEligible !== false,
      approvalStatus: prod.approvalStatus || 'approved',
      adminNote: prod.adminNote || '',
      tags: Array.isArray(prod.tags) ? prod.tags.join(', ') : ''
    });

    const existingVg = prod.variants?.[0];
    setAdminVariantGroupName(existingVg?.name || 'Set Size');
    if (existingVg?.values?.length > 0) {
      setAdminVariantRows(
        existingVg.values.map((v) => ({
          label: v.label || '',
          priceLkr: v.priceLkr !== undefined ? String(v.priceLkr) : '',
          stock: v.stock !== undefined ? String(v.stock) : '15'
        }))
      );
    } else {
      setAdminVariantRows([]);
    }
  };

  const closeEditProductModal = () => {
    setEditingProduct(null);
  };

  const handleAdminImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      setUploadingAdminImage(true);
      const res = await apiRequest('/seller/upload-image', {
        method: 'POST',
        body: formData
      });
      setAdminProdForm((prev) => ({ ...prev, imageUrl: res.url }));
      showToast('Product image uploaded successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingAdminImage(false);
    }
  };

  const handleSaveAdminProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      setSavingProduct(true);
      const validVariants = adminVariantRows
        .filter((v) => v.label && v.label.trim())
        .map((v) => ({
          label: v.label.trim(),
          priceLkr: Number(v.priceLkr) || Number(adminProdForm.priceLkr) || 0,
          stock: Math.max(0, Number(v.stock) || 0)
        }));

      const payload = {
        title: adminProdForm.title,
        sku: adminProdForm.sku,
        categorySlug: adminProdForm.categorySlug,
        subCategorySlug: adminProdForm.subCategorySlug,
        description: adminProdForm.description,
        highlights: adminProdForm.highlights,
        priceLkr: Number(adminProdForm.priceLkr),
        compareAtPriceLkr: adminProdForm.compareAtPriceLkr ? Number(adminProdForm.compareAtPriceLkr) : null,
        stock: Number(adminProdForm.stock),
        images: adminProdForm.imageUrl ? [adminProdForm.imageUrl] : editingProduct.images,
        variants:
          validVariants.length > 0
            ? [
                {
                  name: (adminVariantGroupName || 'Set Size').trim(),
                  values: validVariants
                }
              ]
            : [],
        isHomemade: adminProdForm.isHomemade,
        isFeatured: adminProdForm.isFeatured,
        isDeal: adminProdForm.isDeal,
        codEligible: adminProdForm.codEligible,
        approvalStatus: adminProdForm.approvalStatus,
        adminNote: adminProdForm.adminNote,
        tags: adminProdForm.tags
      };

      await apiRequest(`/admin/products/${editingProduct._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      showToast(`Product "${adminProdForm.title}" updated successfully by Admin!`);
      closeEditProductModal();
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteAdminProduct = async (productId, title) => {
    if (!window.confirm(`Are you sure you want to permanently remove "${title}" from the marketplace?`)) {
      return;
    }
    try {
      await apiRequest(`/admin/products/${productId}`, {
        method: 'DELETE'
      });
      showToast(`Product "${title}" removed from marketplace.`);
      if (editingProduct && editingProduct._id === productId) {
        closeEditProductModal();
      }
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

  const openEditCategoryModal = (cat) => {
    setEditingCategory(cat);
    setCatEditForm({
      name: cat.name || '',
      quadHeadline: cat.quadHeadline || '',
      description: cat.description || '',
      imageUrl: cat.imageUrl || '',
      subCategories: (cat.subCategories || []).map((s, idx) => ({
        name: s.name || `Sub-category ${idx + 1}`,
        slug: s.slug || `sub-${idx + 1}`,
        imageUrl: s.imageUrl || '',
        bgTint: s.bgTint || '#F3F4F6'
      }))
    });
  };

  const closeEditCategoryModal = () => {
    setEditingCategory(null);
  };

  const handleSubCatChange = (index, field, value) => {
    setCatEditForm((prev) => {
      const next = [...prev.subCategories];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, subCategories: next };
    });
  };

  const handleCatCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      setUploadingCatCover(true);
      const res = await apiRequest('/admin/upload-image', {
        method: 'POST',
        body: formData
      });
      setCatEditForm((prev) => ({ ...prev, imageUrl: res.url }));
      showToast('Department cover image uploaded to Cloudinary!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingCatCover(false);
    }
  };

  const handleSubCatImageUpload = async (index, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      setUploadingSubCatIndex(index);
      const res = await apiRequest('/admin/upload-image', {
        method: 'POST',
        body: formData
      });
      handleSubCatChange(index, 'imageUrl', res.url);
      showToast(`Tile #${index + 1} image uploaded to Cloudinary!`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingSubCatIndex(null);
    }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      setSavingCategory(true);
      await apiRequest(`/admin/categories/${editingCategory._id}`, {
        method: 'PUT',
        body: JSON.stringify(catEditForm)
      });
      showToast(`Department "${catEditForm.name}" updated!`);
      closeEditCategoryModal();
      fetchOverview();
      refreshCategories?.();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete department "${catName}"? Any products currently assigned to it will be safely moved to the default department.`
      )
    ) {
      return;
    }
    try {
      const res = await apiRequest(`/admin/categories/${catId}`, {
        method: 'DELETE'
      });
      showToast(res.message || `Department "${catName}" removed.`);
      fetchOverview();
      refreshCategories?.();
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
      refreshCategories?.();
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
                            <div className="text-slate-500 flex items-center gap-1.5 flex-wrap">
                              <span>SKU: {p.sku}</span>
                              <span>• Stock: {p.stock}</span>
                              <span>• Cat: {p.categorySlug}</span>
                              {p.variants?.[0]?.values?.length > 1 && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                                  {p.variants[0].values.length} Sets / Offers
                                </span>
                              )}
                            </div>
                            {p.lastEditedBy === 'admin' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800 font-bold mt-0.5">
                                Admin Modified
                              </span>
                            )}
                            {p.adminNote && (
                              <div className="text-[10px] text-amber-700 font-medium italic mt-0.5 line-clamp-1">
                                Note: {p.adminNote}
                              </div>
                            )}
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
                        <button
                          type="button"
                          onClick={() => openEditProductModal(p)}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1 shadow-xs transition"
                          title="Edit All Product Fields (Admin Override)"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                        {p.approvalStatus !== 'approved' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleProductModeration(p._id, { approvalStatus: 'approved' })
                            }
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
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
                            className="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 font-semibold transition"
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

          {/* Departments & Homepage 2x2 Quad Cards Management */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  Departments & Homepage 2x2 Quad Cards ({data?.categories?.length || 0})
                </h2>
                <p className="text-xs text-slate-500">
                  Manage marketplace departments, customize homepage 2x2 quad headlines, adjust sub-categories, and control category discovery.
                </p>
              </div>
            </div>

            {/* Existing Categories Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5">Department</th>
                    <th className="py-2.5">Homepage 2x2 Quad Headline</th>
                    <th className="py-2.5">Sub-Categories (4 Tiles)</th>
                    <th className="py-2.5">Listings</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.categories || []).map((cat) => {
                    const catProductsCount = products.filter((p) => p.categorySlug === cat.slug).length;
                    return (
                      <tr key={cat._id || cat.slug}>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={cat.imageUrl || 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=120&q=80'}
                              alt={cat.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-slate-900">{cat.name}</div>
                              <div className="text-[11px] font-mono text-slate-500">slug: {cat.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-slate-800">
                          {cat.quadHeadline || cat.name}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {(cat.subCategories || []).map((sub) => (
                              <span
                                key={sub.slug}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium"
                              >
                                {sub.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                            {catProductsCount} Products
                          </span>
                        </td>
                        <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditCategoryModal(cat)}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1 shadow-xs transition"
                            title="Edit Category & 4 Sub-Categories"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat._id, cat.name)}
                            className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition"
                            title="Delete Department"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add New Category & 2x2 Quad Card Form */}
            <form
              onSubmit={handleCreateCategory}
              className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-end gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Department Name *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g., Ceylon Tea & Coffee"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block font-bold text-slate-700 mb-1">
                  Homepage 2x2 Quad Card Headline *
                </label>
                <input
                  type="text"
                  required
                  value={catHeadline}
                  onChange={(e) => setCatHeadline(e.target.value)}
                  placeholder="e.g., Freshly Brewed Ceylon Tea & Estate Coffee"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Department
              </button>
            </form>
          </div>
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

      {/* ADMIN PRODUCT EDIT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-amber-400" /> Edit Product Listing (Admin Override)
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                    Admin Power
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Seller: <strong>{editingProduct.sellerName}</strong> • District: <strong>{editingProduct.sellerDistrict || 'Sri Lanka'}</strong> • ID: <code className="text-slate-400 font-mono">{editingProduct._id}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditProductModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Form Body */}
            <form onSubmit={handleSaveAdminProduct} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Admin Marketplace Override:</strong> You have full permission to adjust titles, categorization, pricing, inventory stock, and product copy. All changes take effect immediately across Yaans.lk and are recorded in the marketplace audit log.
                </div>
              </div>

              {/* Title & SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={adminProdForm.title}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={adminProdForm.sku}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Category, Subcategory, Approval Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Marketplace Category *</label>
                  <select
                    value={adminProdForm.categorySlug}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, categorySlug: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    {data?.categories?.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    )) || (
                      <>
                        <option value="homemade-pantry">Homemade & Spices</option>
                        <option value="electronics">Electronics & Tech</option>
                        <option value="home-kitchen">Home & Clayware</option>
                        <option value="fashion-handloom">Fashion & Handloom</option>
                        <option value="ayurveda-beauty">Ayurveda & Beauty</option>
                        <option value="fitness-daily-deals">Fitness & Everyday</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Listing Approval Status</label>
                  <select
                    value={adminProdForm.approvalStatus}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, approvalStatus: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border font-bold ${
                      adminProdForm.approvalStatus === 'approved'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : adminProdForm.approvalStatus === 'pending'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-red-300 bg-red-50 text-red-700'
                    }`}
                  >
                    <option value="approved">Approved (Live)</option>
                    <option value="pending">Pending Approval</option>
                    <option value="rejected">Rejected (Hidden)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Available Stock Qty *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adminProdForm.stock}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, stock: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
              </div>

              {/* Price LKR & Compare At Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Selling Price in LKR (Rs.) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adminProdForm.priceLkr}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, priceLkr: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-extrabold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Compare-at / Original Price (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={adminProdForm.compareAtPriceLkr}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, compareAtPriceLkr: e.target.value })}
                    placeholder="Optional (shows discount strike-through)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Product Sets & Variant Offers Builder */}
              <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Sliders className="w-3.5 h-3.5 text-amber-600" />
                      Product Sets, Combo Offers & Variants (Optional)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Configure set options for this listing (e.g. 3-Pot Set vs 5-Pot Set, or 250g vs 500g).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAdminVariantRow}
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
                    value={adminVariantGroupName}
                    onChange={(e) => setAdminVariantGroupName(e.target.value)}
                    placeholder="e.g. Set Size, Pack Option, Weight"
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-slate-800 w-36"
                  />
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    <span>Presets:</span>
                    {['Set Size', 'Pack Option', 'Weight', 'Bottle Size'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAdminVariantGroupName(preset)}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variant Rows Table / List */}
                {adminVariantRows.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase px-1">
                      <div className="col-span-6">Offer / Set Label</div>
                      <div className="col-span-3">Price (Rs.)</div>
                      <div className="col-span-2">Stock</div>
                      <div className="col-span-1 text-right">Del</div>
                    </div>

                    {adminVariantRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="col-span-6">
                          <input
                            type="text"
                            required
                            value={row.label}
                            onChange={(e) => handleAdminVariantRowChange(idx, 'label', e.target.value)}
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
                            onChange={(e) => handleAdminVariantRowChange(idx, 'priceLkr', e.target.value)}
                            placeholder="3250"
                            className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={row.stock}
                            onChange={(e) => handleAdminVariantRowChange(idx, 'stock', e.target.value)}
                            placeholder="20"
                            className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveAdminVariantRow(idx)}
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
                    No set options defined. Sells at base price above. Click <strong>&quot;+ Add Set / Offer&quot;</strong> to configure set tiers (e.g. 3-Pot vs 5-Pot).
                  </div>
                )}
              </div>

              {/* Product Image & Upload */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-slate-600" /> Product Image (Cloudinary or Direct URL)
                  </label>
                  {uploadingAdminImage && (
                    <span className="text-sky-700 font-bold animate-pulse">Uploading file to storage...</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {adminProdForm.imageUrl && (
                    <img
                      src={adminProdForm.imageUrl}
                      alt="Preview"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-300 shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAdminImageUpload}
                      className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                    />
                    <input
                      type="text"
                      value={adminProdForm.imageUrl}
                      onChange={(e) => setAdminProdForm({ ...adminProdForm, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/... or uploaded CDN URL"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Highlights & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Key Highlights <span className="font-normal text-slate-500">(1 point per line)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={adminProdForm.highlights}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, highlights: e.target.value })}
                    placeholder="100% Sri Lankan Spices&#10;No preservatives&#10;Sealed 350g jar"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Description *</label>
                  <textarea
                    rows={4}
                    required
                    value={adminProdForm.description}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Checkboxes / Feature Flags */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-bold text-slate-800 mb-2">Marketplace Visibility & Badges:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminProdForm.isFeatured}
                      onChange={(e) => setAdminProdForm({ ...adminProdForm, isFeatured: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span className="font-semibold text-slate-800">Featured Home</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminProdForm.isDeal}
                      onChange={(e) => setAdminProdForm({ ...adminProdForm, isDeal: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span className="font-semibold text-slate-800">Deal Badge</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminProdForm.isHomemade}
                      onChange={(e) => setAdminProdForm({ ...adminProdForm, isHomemade: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span className="font-semibold text-slate-800">Sri Lankan Cottage</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminProdForm.codEligible}
                      onChange={(e) => setAdminProdForm({ ...adminProdForm, codEligible: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900"
                    />
                    <span className="font-semibold text-slate-800">COD Eligible</span>
                  </label>
                </div>
              </div>

              {/* Admin Moderation Note & Search Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Admin Moderation Note <span className="font-normal text-slate-500">(Visible to seller)</span>
                  </label>
                  <input
                    type="text"
                    value={adminProdForm.adminNote}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, adminNote: e.target.value })}
                    placeholder="e.g. Corrected title capitalization and moved to Homemade category"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-amber-50/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Search Tags <span className="font-normal text-slate-500">(comma separated)</span>
                  </label>
                  <input
                    type="text"
                    value={adminProdForm.tags}
                    onChange={(e) => setAdminProdForm({ ...adminProdForm, tags: e.target.value })}
                    placeholder="cinnamon, organic, spices, kandy"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteAdminProduct(editingProduct._id, editingProduct.title)}
                  className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold inline-flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Product
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeEditProductModal}
                    className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    {savingProduct ? 'Saving Overrides...' : 'Save & Publish Overrides'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category / Department Edit Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            {/* Header */}
            <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 uppercase">
                    Admin Override
                  </span>
                  <span className="text-xs text-slate-500 font-mono">slug: {editingCategory.slug}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Edit Department &amp; Homepage 2x2 Card
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditCategoryModal}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCategory} className="p-6 space-y-5 text-xs">
              {/* Basic Department Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={catEditForm.name}
                    onChange={(e) => setCatEditForm({ ...catEditForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Homepage 2x2 Quad Card Headline
                  </label>
                  <input
                    type="text"
                    value={catEditForm.quadHeadline}
                    onChange={(e) => setCatEditForm({ ...catEditForm, quadHeadline: e.target.value })}
                    placeholder="e.g. Traditional Spices &amp; Homemade Delights"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Department Banner / Cover Image with Device Upload to Cloudinary */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-600" />
                    Department Banner / Cover Image (Cloudinary Upload or CDN URL)
                  </label>
                  {uploadingCatCover && (
                    <span className="text-amber-700 font-bold animate-pulse flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5 animate-spin" /> Uploading to Cloudinary CDN...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={
                      catEditForm.imageUrl ||
                      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80'
                    }
                    alt="Department Cover Preview"
                    className="w-24 h-16 object-cover rounded-lg border border-slate-200 bg-white shadow-xs shrink-0"
                    onError={(e) => {
                      e.target.src =
                        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80';
                    }}
                  />
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCatCoverUpload}
                      disabled={uploadingCatCover}
                      className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-900 hover:file:bg-amber-600 file:cursor-pointer disabled:opacity-50"
                    />
                    <input
                      type="url"
                      value={catEditForm.imageUrl}
                      onChange={(e) => setCatEditForm({ ...catEditForm, imageUrl: e.target.value })}
                      placeholder="https://res.cloudinary.com/... or https://images.unsplash.com/..."
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department Description</label>
                <textarea
                  rows={2}
                  value={catEditForm.description}
                  onChange={(e) => setCatEditForm({ ...catEditForm, description: e.target.value })}
                  placeholder="Short description for SEO and category headers..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              {/* 4 Sub-Categories / 2x2 Homepage Tiles */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      Homepage 2x2 Quad Card Tiles (4 Sub-Categories)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      These 4 tiles are visually rendered inside the homepage department card for quick customer navigation.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {(catEditForm.subCategories || []).map((sub, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 text-[11px]">
                          Tile #{idx + 1}
                        </span>
                        {sub.imageUrl && (
                          <img
                            src={sub.imageUrl}
                            alt=""
                            className="w-6 h-6 object-cover rounded border border-slate-200"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Title</label>
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => handleSubCatChange(idx, 'name', e.target.value)}
                          placeholder="e.g. Ceylon Cinnamon"
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[10px] font-bold text-slate-500">Image</label>
                          <label className="cursor-pointer text-[10px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1">
                            <Upload className="w-2.5 h-2.5" />
                            {uploadingSubCatIndex === idx ? 'Uploading...' : 'Upload'}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingSubCatIndex === idx}
                              className="hidden"
                              onChange={(e) => handleSubCatImageUpload(idx, e.target.files?.[0])}
                            />
                          </label>
                        </div>
                        <input
                          type="url"
                          value={sub.imageUrl}
                          onChange={(e) => handleSubCatChange(idx, 'imageUrl', e.target.value)}
                          placeholder="https://res.cloudinary.com/... or URL"
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-[11px] font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditCategoryModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-slate-900" />
                  {savingCategory ? 'Saving Department...' : 'Save Department Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
