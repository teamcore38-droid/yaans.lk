import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Plus,
  User,
  Key,
  Lock,
  Mail,
  Phone,
  Truck,
  Ban,
  RefreshCw,
  Copy
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

export default function AdminDashboardPage() {
  const { user, logout, refreshUser, showToast, refreshCategories, categories: marketplaceCategories } = useMarketplace();
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

  // Admin Profile & Credentials State
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPasswordForEmail: ''
  });
  const [adminPasswordForm, setAdminPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [savingAdminProfile, setSavingAdminProfile] = useState(false);
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setAdminProfileForm((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
    }
  }, [user]);

  const handleUpdateAdminProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingAdminProfile(true);
      const isEmailChanging = adminProfileForm.email.toLowerCase().trim() !== (user.email || '').toLowerCase().trim();
      if (isEmailChanging && !adminProfileForm.currentPasswordForEmail) {
        showToast('Please enter your current password to confirm email/username change.', 'error');
        return;
      }
      const res = await apiRequest('/auth/update-credentials', {
        method: 'PUT',
        body: JSON.stringify({
          newName: adminProfileForm.name,
          newEmail: adminProfileForm.email,
          newPhone: adminProfileForm.phone,
          currentPassword: adminProfileForm.currentPasswordForEmail || undefined
        })
      });
      localStorage.setItem('yaans_token', res.token);
      localStorage.setItem('yaans_user', JSON.stringify(res.user));
      await refreshUser();
      setAdminProfileForm((prev) => ({ ...prev, currentPasswordForEmail: '' }));
      showToast('Admin profile and username updated successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAdminProfile(false);
    }
  };

  const handleUpdateAdminPassword = async (e) => {
    e.preventDefault();
    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (adminPasswordForm.newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    try {
      setSavingAdminPassword(true);
      const res = await apiRequest('/auth/update-credentials', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: adminPasswordForm.currentPassword,
          newPassword: adminPasswordForm.newPassword
        })
      });
      localStorage.setItem('yaans_token', res.token);
      localStorage.setItem('yaans_user', JSON.stringify(res.user));
      await refreshUser();
      setAdminPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Admin password changed successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAdminPassword(false);
    }
  };

  // Editable Districts State
  const [districtsState, setDistrictsState] = useState([]);
  const [shippingMode, setShippingMode] = useState('custom'); // 'custom' | 'flat'
  const [flatShippingRate, setFlatShippingRate] = useState(350);
  const [savingDistricts, setSavingDistricts] = useState(false);
  const [savingShippingMode, setSavingShippingMode] = useState(false);

  // Homepage Banners State
  const [bannersState, setBannersState] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploadingDesktopBanner, setUploadingDesktopBanner] = useState(false);
  const [uploadingMobileBanner, setUploadingMobileBanner] = useState(false);
  const [syncBothBannerImages, setSyncBothBannerImages] = useState(true);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerForm, setBannerForm] = useState({
    title: '',
    imageUrl: '',
    mobileImageUrl: '',
    categorySlug: '',
    ctaLink: '',
    active: true,
    displayOrder: 1
  });
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
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center mx-auto text-sky-800">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Yaans.lk Admin Console Access
          </h1>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            This dashboard is restricted to Yaans.lk Marketplace Administrators. Please sign in with your administrator credentials.
          </p>
          <div className="pt-2">
            <Link
              to="/login?redirect=/admin"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition"
            >
              Sign In to Admin Console
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
            <XCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Access Denied
          </h1>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            You are currently signed in as <strong className="text-slate-900">{user.name}</strong> ({user.role} role).
            This dashboard requires Administrator privileges.
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
              onClick={() => {
                logout();
                navigate('/login?redirect=/admin');
              }}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
            >
              Sign In as Admin
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
      setSavingDistricts(true);
      await apiRequest('/admin/config/districts', {
        method: 'PUT',
        body: JSON.stringify({
          districts: districtsState,
          shippingMode,
          flatShippingRateLkr: Number(flatShippingRate)
        })
      });
      showToast(
        shippingMode === 'flat'
          ? `Flat Islandwide Shipping active at Rs. ${Number(flatShippingRate).toLocaleString()} (Custom district charges disabled).`
          : 'All 25 Sri Lankan district delivery fees & COD settings saved!'
      );
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingDistricts(false);
    }
  };

  const handleToggleShippingMode = async (targetMode) => {
    try {
      setSavingShippingMode(true);
      const res = await apiRequest('/admin/config/shipping-mode', {
        method: 'PUT',
        body: JSON.stringify({
          shippingMode: targetMode,
          flatShippingRateLkr: Number(flatShippingRate)
        })
      });
      setShippingMode(targetMode);
      showToast(res.message);
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingShippingMode(false);
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

  const openAddBannerModal = () => {
    setEditingBanner(null);
    setSyncBothBannerImages(true);
    setBannerForm({
      title: '',
      imageUrl: '',
      mobileImageUrl: '',
      categorySlug: '',
      ctaLink: '/products',
      active: true,
      displayOrder: (bannersState.length || 0) + 1
    });
    setBannerModalOpen(true);
  };

  const openEditBannerModal = (banner) => {
    setEditingBanner(banner);
    const hasLegacyPinkMobile = banner.mobileImageUrl === '/mobile_hero_banner.jpg';
    const isShared = !banner.mobileImageUrl || banner.mobileImageUrl === banner.imageUrl || hasLegacyPinkMobile;
    setSyncBothBannerImages(isShared);

    const resolvedDesktop = banner.imageUrl || banner.mobileImageUrl || '';
    const resolvedMobile = hasLegacyPinkMobile ? resolvedDesktop : (banner.mobileImageUrl || banner.imageUrl || '');

    setBannerForm({
      title: banner.title || '',
      imageUrl: resolvedDesktop,
      mobileImageUrl: resolvedMobile,
      categorySlug: banner.categorySlug || '',
      ctaLink: banner.ctaLink || (banner.categorySlug ? `/products?category=${banner.categorySlug}` : '/products'),
      active: banner.active ?? true,
      displayOrder: banner.displayOrder ?? 1
    });
    setBannerModalOpen(true);
  };

  const closeBannerModal = () => {
    setBannerModalOpen(false);
    setEditingBanner(null);
  };

  const handleBannerImageUpload = async (field, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    const isMobile = field === 'mobileImageUrl';
    try {
      if (isMobile) setUploadingMobileBanner(true);
      else setUploadingDesktopBanner(true);

      const res = await apiRequest('/admin/upload-image', {
        method: 'POST',
        body: formData
      });
      if (res?.url) {
        setBannerForm((prev) => {
          if (syncBothBannerImages) {
            return {
              ...prev,
              imageUrl: res.url,
              mobileImageUrl: res.url
            };
          }
          const next = { ...prev, [field]: res.url };
          if (!isMobile && (!prev.mobileImageUrl || prev.mobileImageUrl === '/mobile_hero_banner.jpg')) {
            next.mobileImageUrl = res.url;
          }
          if (isMobile && (!prev.imageUrl || prev.imageUrl === '/mobile_hero_banner.jpg')) {
            next.imageUrl = res.url;
          }
          return next;
        });
        showToast(
          syncBothBannerImages
            ? 'Banner uploaded to Cloudinary and set for both Desktop and Mobile!'
            : (isMobile
                ? 'Mobile banner image uploaded to Cloudinary CDN!'
                : 'Desktop banner image uploaded to Cloudinary CDN!')
        );
      } else {
        throw new Error('Image upload failed: no URL returned.');
      }
    } catch (err) {
      showToast(err.message || 'Banner upload failed.', 'error');
    } finally {
      if (isMobile) setUploadingMobileBanner(false);
      else setUploadingDesktopBanner(false);
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (!bannerForm.imageUrl && !bannerForm.mobileImageUrl) {
      showToast('Please upload or specify at least one banner image (desktop or mobile).', 'error');
      return;
    }
    const resolvedDesktop = (bannerForm.imageUrl || bannerForm.mobileImageUrl || '').trim();
    let resolvedMobile = (bannerForm.mobileImageUrl || bannerForm.imageUrl || '').trim();
    if (resolvedMobile === '/mobile_hero_banner.jpg' && resolvedDesktop && resolvedDesktop !== '/mobile_hero_banner.jpg') {
      resolvedMobile = resolvedDesktop;
    }
    const payload = {
      ...bannerForm,
      imageUrl: resolvedDesktop,
      mobileImageUrl: resolvedMobile
    };
    try {
      setSavingBanner(true);
      const targetId = editingBanner?.id || editingBanner?._id;
      if (editingBanner && targetId) {
        await apiRequest(`/admin/banners/${targetId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Homepage banner card updated successfully!');
      } else {
        await apiRequest('/admin/banners', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('New homepage banner card created!');
      }
      closeBannerModal();
      await fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingBanner(false);
    }
  };

  const handleDeleteBanner = async (bannerId, title) => {
    if (!bannerId) return;
    if (!window.confirm(`Are you sure you want to remove the banner "${title || 'Untitled'}"?`)) {
      return;
    }
    try {
      await apiRequest(`/admin/banners/${bannerId}`, {
        method: 'DELETE'
      });
      showToast('Banner card removed from homepage.');
      await fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleBannerActive = async (banner) => {
    try {
      const targetId = banner.id || banner._id;
      if (!targetId) return;
      await apiRequest(`/admin/banners/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !banner.active })
      });
      showToast(`Banner "${banner.title || 'Untitled'}" ${banner.active ? 'hidden' : 'activated'}.`);
      await fetchOverview();
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
          { id: 'account', label: 'Admin Account & Security', icon: ShieldCheck }
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
                {sellers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                        <Store className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">No Seller Applications Found</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        New seller registrations will appear here for review, district verification, and custom commission overrides.
                      </p>
                    </td>
                  </tr>
                ) : (
                  sellers.map((s) => (
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
                )))}
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
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <Package className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-800">No Product Listings Submitted Yet</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          Product listings added by verified sellers will be displayed here for catalog moderation and approval.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
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
                  )))}
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

      {/* TAB: HOMEPAGE HERO BANNERS */}
      {activeTab === 'banners' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Hero Section Management
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  Homepage Carousel Banners ({bannersState.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  These auto-swipeable banner cards appear at the top of the homepage on both desktop and mobile screens. Attach them to any parent department or to all products.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddBannerModal}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                Add New Banner Card
              </button>
            </div>

            {bannersState.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">No Homepage Banners Configured</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Add your first banner card to display an auto-sliding hero showcase on the Yaans.lk homepage.
                </p>
                <button
                  type="button"
                  onClick={openAddBannerModal}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Banner
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bannersState.map((banner, idx) => {
                  const matchedCat = (data?.categories || marketplaceCategories || []).find(
                    (c) => c.slug === banner.categorySlug
                  );
                  return (
                    <div
                      key={banner.id || idx}
                      className={`bg-white rounded-xl border overflow-hidden shadow-xs flex flex-col transition hover:shadow-md ${
                        banner.active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50/50'
                      }`}
                    >
                      {/* Banner Image Preview */}
                      <div className="relative aspect-[3.2/1] bg-slate-100 overflow-hidden group">
                        <img
                          src={banner.imageUrl || banner.mobileImageUrl}
                          alt={banner.title || 'Banner'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src =
                              'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80';
                          }}
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-900/80 text-white backdrop-blur-xs">
                            #{banner.displayOrder || idx + 1}
                          </span>
                          {banner.active ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500 text-white shadow-xs">
                              Hidden
                            </span>
                          )}
                        </div>

                        {banner.mobileImageUrl && (
                          <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-200 backdrop-blur-xs border border-emerald-400/30">
                            Dual Desktop + Mobile
                          </div>
                        )}
                      </div>

                      {/* Banner Details */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <h3 className="font-extrabold text-sm text-slate-900 line-clamp-1">
                            {banner.title || 'Untitled Banner Card'}
                          </h3>

                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="text-slate-400 font-semibold">Attached Category:</span>
                            {banner.categorySlug ? (
                              <span className="px-2 py-0.5 rounded font-bold bg-sky-100 text-sky-800">
                                {matchedCat?.name || banner.categorySlug}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                                All Products (/products)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-0.5">
                            <span className="px-1.5 py-0.5 rounded font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              Desktop Banner Active
                            </span>
                            {banner.mobileImageUrl ? (
                              <span className="px-1.5 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Mobile Custom
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">
                                Mobile Auto-Shared
                              </span>
                            )}
                          </div>

                          {/* Dual Device Preview Mini Thumbnails */}
                          <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <div className="flex items-center justify-between text-slate-500 font-bold mb-1">
                                <span>Desktop View</span>
                                <span className="text-[9px] font-mono text-sky-700 bg-sky-50 px-1 rounded">1400×390</span>
                              </div>
                              <div className="aspect-[3.6/1] rounded overflow-hidden border border-slate-200 bg-slate-100">
                                <img
                                  src={banner.imageUrl || banner.mobileImageUrl}
                                  alt="Desktop View"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-slate-500 font-bold mb-1">
                                <span>Mobile View</span>
                                <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded">1080×460</span>
                              </div>
                              <div className="aspect-[2.35/1] rounded overflow-hidden border border-slate-200 bg-slate-100">
                                <img
                                  src={banner.mobileImageUrl || banner.imageUrl}
                                  alt="Mobile View"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="text-[11px] font-mono text-slate-500 truncate pt-0.5">
                            Link: {banner.ctaLink || '/products'}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleBannerActive(banner)}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                              banner.active
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {banner.active ? 'Hide Banner' : 'Show Banner'}
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditBannerModal(banner)}
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1 transition shadow-xs"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBanner(banner.id || banner._id, banner.title)}
                              className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition"
                              title="Delete Banner"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: 25 SRI LANKAN DISTRICTS DELIVERY FEE & COD MATRIX */}
      {activeTab === 'districts' && (
        <div className="space-y-5">
          {/* Top Banner: Marketplace Shipping Strategy & Mode Controller */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Platform Delivery Configuration
                  </span>
                  {shippingMode === 'flat' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      One Shipping Charge Active (Rs. {Number(flatShippingRate).toLocaleString()} for All Places)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Custom 25-District Matrix Active
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  Shipping Fee Control &amp; Universal Override
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Temporarily disable individual district charges and set one flat shipping rate for all places, or switch to the full 25-district matrix. Only one mode can be active at a time.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDistricts}
                  disabled={savingDistricts || savingShippingMode}
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savingDistricts ? 'Saving All Settings...' : 'Save All 25 District Configs'}
                </button>
              </div>
            </div>

            {/* Mutually Exclusive Mode Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: One Unified Shipping Charge (Flat Rate for All Places) */}
              <div
                className={`relative rounded-xl border p-4 transition ${
                  shippingMode === 'flat'
                    ? 'border-amber-400 bg-amber-50/50 shadow-sm ring-2 ring-amber-400/30'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-amber-600" />
                        One Shipping Charge (All Places)
                      </h3>
                      {shippingMode === 'flat' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500 text-slate-950">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-600">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      Temporarily <strong>disables all district shipping charges</strong> and applies a single unified fee for every order to any place in Sri Lanka.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                      Unified Fee:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        Rs.
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={flatShippingRate}
                        onChange={(e) => setFlatShippingRate(Number(e.target.value))}
                        disabled={shippingMode !== 'flat'}
                        className={`w-28 pl-9 pr-3 py-1.5 rounded-lg border font-bold text-xs ${
                          shippingMode === 'flat'
                            ? 'border-amber-400 bg-white text-slate-900'
                            : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        placeholder="350"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">LKR</span>
                  </div>

                  {shippingMode === 'flat' ? (
                    <button
                      type="button"
                      onClick={() => handleToggleShippingMode('custom')}
                      disabled={savingShippingMode}
                      className="px-3.5 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {savingShippingMode ? 'Switching...' : 'Deactivate One Charge'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleShippingMode('flat')}
                      disabled={savingShippingMode}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {savingShippingMode ? 'Switching...' : 'Activate One Charge for All Places'}
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Custom 25-District Matrix */}
              <div
                className={`relative rounded-xl border p-4 transition ${
                  shippingMode === 'custom'
                    ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-400/30'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        Custom 25-District Shipping Charges
                      </h3>
                      {shippingMode === 'custom' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-600">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      Calculates delivery dynamically per district based on <strong>intra-district, standard, and outstation courier fees</strong>.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    25 Individual District Rate Values
                  </span>

                  {shippingMode === 'custom' ? (
                    <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Custom Matrix Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleShippingMode('custom')}
                      disabled={savingShippingMode}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {savingShippingMode ? 'Switching...' : 'Re-enable Custom District Charges'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  25 Sri Lankan Administrative Districts — Courier Fee &amp; COD Matrix
                </h2>
                <p className="text-xs text-slate-500">
                  Configure Same-District (Intra), Standard, and Outstation courier fees in LKR (Rs.) + Cash on Delivery toggle per district.
                </p>
              </div>

              {shippingMode === 'flat' && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                  Rates Below Temporarily Disabled (Flat Rs. {Number(flatShippingRate).toLocaleString()} Active)
                </span>
              )}
            </div>

            {/* Warning banner when Flat Rate is active */}
            {shippingMode === 'flat' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <strong className="font-bold">District Shipping Fees Are Currently Disabled:</strong>
                  <span className="ml-1">
                    One universal shipping charge of <strong>Rs. {Number(flatShippingRate).toLocaleString()}</strong> is currently being applied for all places. The district-specific custom rate inputs below are locked. To resume using individual district fees, click <strong>"Re-enable Custom District Charges"</strong> above.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleShippingMode('custom')}
                  disabled={savingShippingMode}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shrink-0 transition"
                >
                  Re-enable Custom Rates
                </button>
              </div>
            )}

            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-2">District</th>
                    <th className="py-2 px-2">Province</th>
                    <th className="py-2 px-2">
                      Same-District Fee (Rs.)
                      {shippingMode === 'flat' && <span className="block text-[10px] text-amber-700 font-normal">(Disabled)</span>}
                    </th>
                    <th className="py-2 px-2">
                      Standard Fee (Rs.)
                      {shippingMode === 'flat' && <span className="block text-[10px] text-amber-700 font-normal">(Disabled)</span>}
                    </th>
                    <th className="py-2 px-2">
                      Outstation Fee (Rs.)
                      {shippingMode === 'flat' && <span className="block text-[10px] text-amber-700 font-normal">(Disabled)</span>}
                    </th>
                    <th className="py-2 px-2">Est. Delivery Window</th>
                    <th className="py-2 px-2">COD Enabled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districtsState.map((d, idx) => (
                    <tr
                      key={d.code || d.name}
                      className={shippingMode === 'flat' ? 'bg-slate-50/40' : ''}
                    >
                      <td className="py-2 px-2 font-bold text-slate-900">{d.name}</td>
                      <td className="py-2 px-2 text-slate-500">{d.province}</td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={d.intraDistrictFee}
                          disabled={shippingMode === 'flat'}
                          onChange={(e) => {
                            const next = [...districtsState];
                            next[idx] = { ...next[idx], intraDistrictFee: Number(e.target.value) };
                            setDistrictsState(next);
                          }}
                          className={`w-20 px-2 py-1 rounded border font-semibold ${
                            shippingMode === 'flat'
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white border-slate-300'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={d.standardFee}
                          disabled={shippingMode === 'flat'}
                          onChange={(e) => {
                            const next = [...districtsState];
                            next[idx] = { ...next[idx], standardFee: Number(e.target.value) };
                            setDistrictsState(next);
                          }}
                          className={`w-20 px-2 py-1 rounded border font-semibold ${
                            shippingMode === 'flat'
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white border-slate-300'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={d.outstationFee}
                          disabled={shippingMode === 'flat'}
                          onChange={(e) => {
                            const next = [...districtsState];
                            next[idx] = { ...next[idx], outstationFee: Number(e.target.value) };
                            setDistrictsState(next);
                          }}
                          className={`w-20 px-2 py-1 rounded border font-semibold ${
                            shippingMode === 'flat'
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white border-slate-300'
                          }`}
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

      {/* TAB 6: ADMIN ACCOUNT & SECURITY CREDENTIALS */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Admin Identity Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Yaans.lk Master Administrator Account
                  </h2>
                  <p className="text-xs text-slate-500">
                    Highest administrative authority on Yaans.lk marketplace
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 text-xs font-extrabold uppercase tracking-wide">
                Active Super Admin
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Admin Identifier</span>
                <span className="font-mono font-bold text-slate-900">{user.id || user._id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Current Username / Email</span>
                <span className="font-bold text-slate-900">{user.email}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Display Name</span>
                <span className="font-bold text-slate-900">{user.name}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Contact Phone</span>
                <span className="font-bold text-slate-900">{user.phone || '0771002000'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Update Username & Profile Form */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Update Admin Username & Contact Info
                </h3>
                <p className="text-xs text-slate-500">
                  Change the admin login email / username or phone number
                </p>
              </div>

              <form onSubmit={handleUpdateAdminProfile} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Admin Display Name</label>
                  <input
                    type="text"
                    required
                    value={adminProfileForm.name}
                    onChange={(e) => setAdminProfileForm({ ...adminProfileForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Admin Username / Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={adminProfileForm.email}
                    onChange={(e) => setAdminProfileForm({ ...adminProfileForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={adminProfileForm.phone}
                    onChange={(e) => setAdminProfileForm({ ...adminProfileForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {adminProfileForm.email.toLowerCase().trim() !== (user.email || '').toLowerCase().trim() && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
                    <label className="block font-bold text-amber-900 text-xs">
                      Enter Current Password to Confirm Email Change
                    </label>
                    <input
                      type="password"
                      required
                      value={adminProfileForm.currentPasswordForEmail}
                      onChange={(e) =>
                        setAdminProfileForm({
                          ...adminProfileForm,
                          currentPasswordForEmail: e.target.value
                        })
                      }
                      placeholder="Current password"
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingAdminProfile}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {savingAdminProfile ? 'Saving Details...' : 'Save Profile Changes'}
                </button>
              </form>
            </div>

            {/* Change Password Form */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Change Admin Password
                </h3>
                <p className="text-xs text-slate-500">
                  Update your secret administrator password for portal security
                </p>
              </div>

              <form onSubmit={handleUpdateAdminPassword} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Current Password *</label>
                  <input
                    type="password"
                    required
                    value={adminPasswordForm.currentPassword}
                    onChange={(e) =>
                      setAdminPasswordForm({ ...adminPasswordForm, currentPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={adminPasswordForm.newPassword}
                    onChange={(e) =>
                      setAdminPasswordForm({ ...adminPasswordForm, newPassword: e.target.value })
                    }
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={adminPasswordForm.confirmPassword}
                    onChange={(e) =>
                      setAdminPasswordForm({
                        ...adminPasswordForm,
                        confirmPassword: e.target.value
                      })
                    }
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingAdminPassword}
                  className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {savingAdminPassword ? 'Updating Password...' : 'Update Admin Password'}
                </button>
              </form>
            </div>
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

      {/* Banner Create / Edit Modal */}
      {bannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="sticky top-0 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingBanner ? 'Edit Homepage Banner Card' : 'Add New Homepage Banner Card'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Auto-swipeable hero banner card linking to a parent category or all products.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBannerModal}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="p-5 space-y-4 text-xs">
              {/* Banner Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Banner Card Title *
                </label>
                <input
                  type="text"
                  required
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Electronics & Gadgets, Ceylon Tea & Spices"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-slate-900"
                />
              </div>

              {/* Sync Both Displays Toggle */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-950 select-none">
                  <input
                    type="checkbox"
                    checked={syncBothBannerImages}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSyncBothBannerImages(checked);
                      if (checked && bannerForm.imageUrl) {
                        setBannerForm((prev) => ({ ...prev, mobileImageUrl: prev.imageUrl }));
                      }
                    }}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <span>Use one image for both Desktop and Mobile (Recommended)</span>
                </label>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  syncBothBannerImages ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
                }`}>
                  {syncBothBannerImages ? 'Auto-Synced' : 'Independent'}
                </span>
              </div>

              {/* 1. Desktop Banner Image Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Desktop Banner Image</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                        1400 × 390 px (~3.6:1)
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-500">
                      Displayed on desktop monitors and laptop screens.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {bannerForm.mobileImageUrl && bannerForm.mobileImageUrl !== bannerForm.imageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setBannerForm((prev) => ({ ...prev, imageUrl: prev.mobileImageUrl }));
                          showToast('Copied mobile image to desktop banner!');
                        }}
                        className="text-[10px] font-bold text-sky-700 hover:text-sky-900 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Copy className="w-3 h-3" />
                        Copy from Mobile
                      </button>
                    )}
                    <label
                      className={`cursor-pointer text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                        uploadingDesktopBanner
                          ? 'bg-amber-100 text-amber-900 border-amber-300 cursor-wait'
                          : 'bg-white hover:bg-amber-50 text-slate-800 border-slate-300 shadow-xs'
                      }`}
                    >
                      <Upload className={`w-3.5 h-3.5 ${uploadingDesktopBanner ? 'animate-bounce' : ''}`} />
                      {uploadingDesktopBanner ? 'Uploading...' : 'Upload Desktop'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingDesktopBanner}
                        className="hidden"
                        onChange={(e) => {
                          handleBannerImageUpload('imageUrl', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                <input
                  type="text"
                  value={bannerForm.imageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBannerForm((prev) => ({
                      ...prev,
                      imageUrl: val,
                      ...(syncBothBannerImages ? { mobileImageUrl: val } : {})
                    }));
                  }}
                  placeholder="https://res.cloudinary.com/... or /banners/yaans_electronics_tech.webp"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] bg-white"
                />

                {uploadingDesktopBanner && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center gap-2 text-xs font-bold text-amber-900">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin"></span>
                    Uploading desktop banner to Cloudinary...
                  </div>
                )}

                {bannerForm.imageUrl && !uploadingDesktopBanner && (
                  <div className="rounded-lg overflow-hidden border border-slate-200 aspect-[3.6/1] max-h-[110px] bg-slate-100 relative group">
                    <img
                      src={bannerForm.imageUrl}
                      alt="Desktop Banner Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900/80 text-white">
                      Desktop Ready
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Mobile Banner Image Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Mobile Banner Image</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        1080 × 460 px (~2.35:1)
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-500">
                      Displayed on smartphone screens (&lt; 768px).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {bannerForm.imageUrl && bannerForm.imageUrl !== bannerForm.mobileImageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setBannerForm((prev) => ({ ...prev, mobileImageUrl: prev.imageUrl }));
                          showToast('Copied desktop image to mobile banner!');
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Copy className="w-3 h-3" />
                        Copy from Desktop
                      </button>
                    )}
                    <label
                      className={`cursor-pointer text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                        uploadingMobileBanner
                          ? 'bg-amber-100 text-amber-900 border-amber-300 cursor-wait'
                          : 'bg-white hover:bg-amber-50 text-slate-800 border-slate-300 shadow-xs'
                      }`}
                    >
                      <Upload className={`w-3.5 h-3.5 ${uploadingMobileBanner ? 'animate-bounce' : ''}`} />
                      {uploadingMobileBanner ? 'Uploading...' : 'Upload Mobile'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingMobileBanner}
                        className="hidden"
                        onChange={(e) => {
                          handleBannerImageUpload('mobileImageUrl', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                <input
                  type="text"
                  value={bannerForm.mobileImageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBannerForm((prev) => ({
                      ...prev,
                      mobileImageUrl: val,
                      ...(syncBothBannerImages ? { imageUrl: val } : {})
                    }));
                  }}
                  placeholder="https://res.cloudinary.com/... or /banners/yaans_electronics_tech.webp"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] bg-white"
                />

                {bannerForm.mobileImageUrl === '/mobile_hero_banner.jpg' && (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                    <span>Mobile is using the old placeholder image. Click to use your Desktop image instead:</span>
                    <button
                      type="button"
                      onClick={() => setBannerForm((prev) => ({ ...prev, mobileImageUrl: prev.imageUrl }))}
                      disabled={!bannerForm.imageUrl || bannerForm.imageUrl === '/mobile_hero_banner.jpg'}
                      className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-[10px] disabled:opacity-40"
                    >
                      Sync Desktop
                    </button>
                  </div>
                )}

                {uploadingMobileBanner && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center gap-2 text-xs font-bold text-amber-900">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin"></span>
                    Uploading mobile banner to Cloudinary...
                  </div>
                )}

                {bannerForm.mobileImageUrl && !uploadingMobileBanner && (
                  <div className="rounded-lg overflow-hidden border border-slate-200 aspect-[2.35/1] max-h-[110px] bg-slate-100 relative group">
                    <img
                      src={bannerForm.mobileImageUrl}
                      alt="Mobile Banner Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900/80 text-white">
                      Mobile Ready
                    </div>
                  </div>
                )}
              </div>

              {/* Attach to Parent Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Attach to Department / Parent Category
                </label>
                <select
                  value={bannerForm.categorySlug}
                  onChange={(e) => {
                    const slug = e.target.value;
                    setBannerForm((prev) => ({
                      ...prev,
                      categorySlug: slug,
                      ctaLink: slug ? `/products?category=${slug}` : '/products'
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold bg-white text-slate-800"
                >
                  <option value="">None — Link to All Products (/products)</option>
                  {(data?.categories || marketplaceCategories || []).map((cat) => (
                    <option key={cat._id || cat.slug} value={cat.slug}>
                      {cat.name} ({cat.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  When selected, customers clicking this card on the homepage are taken directly to this category.
                </p>
              </div>

              {/* Custom CTA Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Link (URL or Path)
                </label>
                <input
                  type="text"
                  value={bannerForm.ctaLink}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, ctaLink: e.target.value }))}
                  placeholder="/products or /products?category=..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-800"
                />
              </div>

              {/* Display Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bannerForm.displayOrder}
                    onChange={(e) =>
                      setBannerForm((prev) => ({ ...prev, displayOrder: Number(e.target.value) || 1 }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-xs"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                    <input
                      type="checkbox"
                      checked={bannerForm.active}
                      onChange={(e) => setBannerForm((prev) => ({ ...prev, active: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Active on Homepage</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeBannerModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBanner || uploadingDesktopBanner || uploadingMobileBanner}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-slate-900" />
                  {savingBanner ? 'Saving...' : editingBanner ? 'Save Changes' : 'Create Banner Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
