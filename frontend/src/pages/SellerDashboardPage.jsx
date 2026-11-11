import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fulfillmentTransitions } from '../../../shared/orderStatus.js';
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
  AlertTriangle,
  Sliders,
  Layers,
  Download,
  FileSpreadsheet,
  X,
  Check,
  Search,
  FileUp,
  RefreshCw
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';

function parseCsv(text) {
  const lines = text.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const entries = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        entries.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    entries.push(current.trim());
    return entries;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const values = parseLine(rawLine);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });

    const title = obj.title || obj.producttitle || obj.name;
    const priceLkr = Number(obj.pricelkr || obj.price || 0);
    const compareAtPriceLkr =
      obj.compareatpricelkr || obj.compareprice || obj.oldprice
        ? Number(obj.compareatpricelkr || obj.compareprice || obj.oldprice)
        : null;
    const sku = obj.sku || '';
    const categorySlug = obj.category || obj.categoryslug || 'homemade-pantry';
    const subCategorySlug = obj.subcategory || obj.subcategoryslug || '';
    const stock = obj.stock ? Number(obj.stock) : 15;
    const highlights = obj.highlights
      ? obj.highlights
          .split(/;|\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const description = obj.description || obj.desc || '';
    const imageUrl = obj.imageurl || obj.image || obj.images || '';

    if (title && description && priceLkr > 0) {
      items.push({
        title,
        priceLkr,
        compareAtPriceLkr,
        sku,
        categorySlug,
        subCategorySlug,
        stock,
        highlights,
        description,
        imageUrl
      });
    }
  }

  return items;
}

export default function SellerDashboardPage() {
  const { user, login, showToast, categories = [] } = useMarketplace();
  const [activeTab, setActiveTab] = useState('orders');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

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

  // Low-Stock, Bulk CSV & Vacation Mode States
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'in_stock' | 'low' | 'out'
  const [searchProdQuery, setSearchProdQuery] = useState('');
  const [updatingStockId, setUpdatingStockId] = useState(null);

  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [csvImportText, setCsvImportText] = useState('');
  const [parsedImportItems, setParsedImportItems] = useState([]);
  const [importingCsv, setImportingCsv] = useState(false);

  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [vacationNoticeInput, setVacationNoticeInput] = useState('');
  const [updatingVacation, setUpdatingVacation] = useState(false);

  const products = data?.products || [];

  // Filter products by stock and search query (Guaranteed Top-Level Hooks)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (stockFilter === 'low' && (Number(p.stock) <= 0 || Number(p.stock) > 5)) return false;
      if (stockFilter === 'out' && Number(p.stock) > 0) return false;
      if (stockFilter === 'in_stock' && Number(p.stock) <= 0) return false;

      if (searchProdQuery.trim()) {
        const q = searchProdQuery.toLowerCase().trim();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchSku = (p.sku || '').toLowerCase().includes(q);
        const matchCat = (p.categorySlug || '').toLowerCase().includes(q);
        if (!matchTitle && !matchSku && !matchCat) return false;
      }
      return true;
    });
  }, [products, stockFilter, searchProdQuery]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 5),
    [products]
  );
  const outOfStockProducts = useMemo(
    () => products.filter((p) => Number(p.stock) <= 0),
    [products]
  );

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
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
          accountNumber: res.seller.bankDetails?.accountNumber || '',
          isVacationMode: Boolean(res.seller.isVacationMode),
          vacationNotice: res.seller.vacationNotice || ''
        });
        setVacationNoticeInput(res.seller.vacationNotice || '');
      }
    } catch (err) {
      setData(null);
      setFetchError(err.message || 'Unable to load seller store information.');
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

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Connecting to Seller Portal</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {fetchError || 'Unable to establish connection to your seller profile and store listings.'}
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => fetchDashboard()}
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Seller Dashboard
          </button>
        </div>
      </div>
    );
  }

  const seller = data?.seller;
  const metrics = data?.metrics || {};
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
          isVacationMode: Boolean(storeForm.isVacationMode),
          vacationNotice: storeForm.vacationNotice || '',
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

  const handleToggleVacationMode = async (targetMode, notice = '') => {
    try {
      setUpdatingVacation(true);
      const res = await apiRequest('/seller/vacation-mode', {
        method: 'PUT',
        body: JSON.stringify({
          isVacationMode: targetMode,
          vacationNotice: notice || vacationNoticeInput || storeForm?.vacationNotice || ''
        })
      });
      showToast(res.message);
      setVacationModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUpdatingVacation(false);
    }
  };

  const handleQuickStockUpdate = async (productId, deltaOrVal, isDelta = false) => {
    try {
      setUpdatingStockId(productId);
      const body = isDelta ? { delta: deltaOrVal } : { stock: Number(deltaOrVal) };
      const res = await apiRequest(`/seller/products/${productId}/stock`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      showToast(res.message);
      await fetchDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUpdatingStockId(null);
    }
  };

  const handleExportProductsCsv = () => {
    const prods = data?.products || [];
    if (!prods.length) {
      showToast('No products available to export.', 'error');
      return;
    }
    const headers = [
      'Title',
      'SKU',
      'Category',
      'PriceLKR',
      'CompareAtPriceLKR',
      'Stock',
      'Highlights',
      'Description',
      'ImageUrl',
      'Status'
    ];
    const rows = prods.map((p) => [
      `"${(p.title || '').replace(/"/g, '""')}"`,
      `"${p.sku || ''}"`,
      `"${p.categorySlug || ''}"`,
      p.priceLkr || 0,
      p.compareAtPriceLkr || '',
      p.stock || 0,
      `"${(Array.isArray(p.highlights) ? p.highlights.join('; ') : '').replace(/"/g, '""')}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      `"${(p.images?.[0] || '').replace(/"/g, '""')}"`,
      `"${p.approvalStatus || 'pending'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const storeSlug = (data?.seller?.storeName || 'seller').toLowerCase().replace(/\s+/g, '_');
    link.setAttribute('download', `yaans_${storeSlug}_products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${prods.length} products to CSV!`);
  };

  const handleDownloadSampleCsv = () => {
    const sampleHeaders = 'Title,SKU,Category,PriceLKR,CompareAtPriceLKR,Stock,Highlights,Description,ImageUrl';
    const sampleRows = [
      '"Pure Ceylon Cinnamon Sticks 100g","CIN-100","homemade-pantry",1250,1450,30,"100% Organic; Harvested in Matara; Export Grade Alba","Naturally grown hand-rolled sweet Ceylon cinnamon.","https://images.unsplash.com/photo-1596040033229-a9821ebd058d"',
      '"Handmade Clay Curry Pot (Medium)","CLAY-POT-M","home-kitchen",1850,2100,12,"Traditional Sri Lankan Clay; Lead-Free; Seasoned","Earthenware clay cooking pot crafted by local village artisans.","https://images.unsplash.com/photo-1578749556568-bc2c40e68b61"'
    ];
    const content = [sampleHeaders, ...sampleRows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'yaans_sample_product_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || '';
      setCsvImportText(text);
      const parsed = parseCsv(text);
      setParsedImportItems(parsed);
    };
    reader.readAsText(file);
  };

  const handleExecuteBulkImport = async (e) => {
    e.preventDefault();
    if (!parsedImportItems.length) {
      showToast('No valid product rows parsed from CSV. Please check formatting.', 'error');
      return;
    }
    try {
      setImportingCsv(true);
      const res = await apiRequest('/seller/products/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ items: parsedImportItems })
      });
      showToast(res.message);
      setBulkImportModalOpen(false);
      setCsvImportText('');
      setParsedImportItems([]);
      await fetchDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImportingCsv(false);
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
              {seller?.isVacationMode && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-900 flex items-center gap-1 border border-amber-300">
                  <span>🌴</span> On Vacation
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {seller?.sellerType} • Origin: <strong>{seller?.city}, {seller?.district}</strong> • Marketplace Commission:{' '}
              <strong>{data?.effectiveCommissionRate}%</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Vacation Mode Quick Toggle */}
          <button
            type="button"
            onClick={() => {
              setVacationNoticeInput(seller?.vacationNotice || '');
              setVacationModalOpen(true);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 border shadow-2xs ${
              seller?.isVacationMode
                ? 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🌴</span>
            <span>{seller?.isVacationMode ? 'Vacation Mode: Active' : 'Vacation Mode'}</span>
          </button>

          {seller?.slug && (
            <Link
              to={`/store/${seller.slug}`}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 shadow-2xs"
            >
              View Public Storefront <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Vacation Notice Banner when active */}
      {seller?.isVacationMode && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <span className="text-2xl shrink-0">🌴</span>
            <div>
              <div className="font-extrabold text-sm text-amber-950">
                Storefront Vacation Mode is Currently Turned ON
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Notice to customers:{' '}
                <strong>
                  &ldquo;{seller.vacationNotice || 'Orders will be processed upon our return.'}&rdquo;
                </strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setVacationNoticeInput(seller.vacationNotice || '');
                setVacationModalOpen(true);
              }}
              className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg font-bold text-amber-950 text-xs"
            >
              Edit Notice
            </button>
            <button
              type="button"
              disabled={updatingVacation}
              onClick={() => handleToggleVacationMode(false)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs disabled:opacity-50"
            >
              Turn Off Vacation Mode
            </button>
          </div>
        </div>
      )}

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
                      ].filter((btn) => fulfillmentTransitions[sub.fulfillmentStatus]?.includes(btn.status)).map((btn) => (
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
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            {/* Low-Stock Warning Alert Banner */}
            {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Inventory Notice:</strong> {outOfStockProducts.length} product(s) Out of Stock,{' '}
                    {lowStockProducts.length} Low Stock (&le;5 units).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
                  className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-500 font-bold text-slate-950 text-[11px] transition"
                >
                  {stockFilter === 'low' ? 'Show All Products' : 'Filter Low Stock'}
                </button>
              </div>
            )}

            {/* Catalog Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Your Store Products ({products.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Manage inventory, stock levels, and multi-set pricing offers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportProductsCsv}
                  disabled={products.length === 0}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs inline-flex items-center gap-1 shadow-2xs transition disabled:opacity-50"
                  title="Export your product catalog to a spreadsheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCsvImportText('');
                    setParsedImportItems([]);
                    setBulkImportModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1 shadow-2xs transition"
                  title="Import products in bulk from CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bulk Import</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search Input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {[
                  { id: 'all', label: `All (${products.length})` },
                  { id: 'in_stock', label: `In Stock (${products.length - outOfStockProducts.length})` },
                  { id: 'low', label: `Low Stock (${lowStockProducts.length})` },
                  { id: 'out', label: `Out of Stock (${outOfStockProducts.length})` }
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStockFilter(pill.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                      stockFilter === pill.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchProdQuery}
                  onChange={(e) => setSearchProdQuery(e.target.value)}
                  placeholder="Search listings..."
                  className="w-full pl-8 pr-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Products List */}
            <div className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">No matching products found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {searchProdQuery || stockFilter !== 'all'
                      ? 'Try adjusting your search query or filter selection.'
                      : 'Use the form on the left or click "Bulk Import" to add products.'}
                  </p>
                </div>
              ) : (
                filteredProducts.map((prod) => (
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
                        <div className="text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-bold text-slate-900">{formatLkr(prod.priceLkr)}</span>

                          {/* Color-coded stock badge */}
                          {Number(prod.stock) <= 0 ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              Out of Stock (0)
                            </span>
                          ) : Number(prod.stock) <= 5 ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Low Stock: {prod.stock}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium">Stock: {prod.stock}</span>
                          )}

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

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Inline Quick Stock Restock Buttons */}
                      <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50 shadow-2xs">
                        <button
                          type="button"
                          title="Reduce stock by 1"
                          disabled={updatingStockId === prod._id || Number(prod.stock) <= 0}
                          onClick={() => handleQuickStockUpdate(prod._id, -1, true)}
                          className="px-2 py-1 font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-30 transition"
                        >
                          -
                        </button>
                        <span className="px-2 font-mono font-bold text-slate-900 text-[11px]">
                          {updatingStockId === prod._id ? '...' : prod.stock}
                        </span>
                        <button
                          type="button"
                          title="Restock +5 units"
                          disabled={updatingStockId === prod._id}
                          onClick={() => handleQuickStockUpdate(prod._id, 5, true)}
                          className="px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          title="Restock +20 units"
                          disabled={updatingStockId === prod._id}
                          onClick={() => handleQuickStockUpdate(prod._id, 20, true)}
                          className="px-2 py-1 font-bold text-sky-700 hover:bg-sky-100 hover:text-sky-900 border-l border-slate-200 transition"
                        >
                          +20
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEditProduct(prod)}
                        className="px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-100 font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(prod._id)}
                        className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition"
                        title="Delete product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
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

            {/* Store Vacation Mode Card */}
            <div className="sm:col-span-2 p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌴</span>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Store Vacation Mode</h3>
                    <p className="text-[11px] text-slate-500">Temporarily pause orders and display a notice on your storefront</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storeForm.isVacationMode}
                    onChange={(e) => setStoreForm({ ...storeForm, isVacationMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              {storeForm.isVacationMode && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vacation Notice Message for Customers</label>
                  <input
                    type="text"
                    value={storeForm.vacationNotice}
                    onChange={(e) => setStoreForm({ ...storeForm, vacationNotice: e.target.value })}
                    placeholder="e.g. Taking a holiday break until Monday, all pending orders are on schedule!"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              )}
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

      {/* BULK CSV IMPORT MODAL */}
      {bulkImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">Bulk Product Import from CSV</h3>
                  <p className="text-[11px] text-slate-300">Upload or paste spreadsheet rows to create multiple listings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkImportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteBulkImport} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900">Need a starting template?</span>
                  <p className="text-[11px] text-slate-500">Download a pre-formatted sample CSV file with all accepted columns</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-800 text-xs inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  Download Sample CSV
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select CSV File from Computer</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Or Paste Raw CSV Data</label>
                  <span className="text-[11px] text-slate-400">Comma-separated with header row</span>
                </div>
                <textarea
                  rows={5}
                  value={csvImportText}
                  onChange={(e) => {
                    setCsvImportText(e.target.value);
                    const parsed = parseCsv(e.target.value);
                    setParsedImportItems(parsed);
                  }}
                  placeholder={'Title,SKU,Category,PriceLKR,CompareAtPriceLKR,Stock,Highlights,Description\n"Ceylon Spices Jar","SP-01","homemade-pantry",850,,20,"Organic","Fresh organic spices"'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-[11px] bg-slate-50"
                />
              </div>

              {/* Parsed Preview Table */}
              {parsedImportItems.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Parsed {parsedImportItems.length} Valid Products Ready for Import
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Title</th>
                          <th className="p-2">Price (Rs.)</th>
                          <th className="p-2">Stock</th>
                          <th className="p-2">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-900">{item.title}</td>
                            <td className="p-2 font-extrabold text-slate-800">{formatLkr(item.priceLkr)}</td>
                            <td className="p-2">{item.stock}</td>
                            <td className="p-2 text-slate-500 font-mono">{item.categorySlug}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                csvImportText.trim() && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Could not detect any valid product rows. Ensure headers are present: Title, PriceLKR, Description.</span>
                  </div>
                )
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parsedImportItems.length === 0 || importingCsv}
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  {importingCsv ? 'Importing Products...' : `Import ${parsedImportItems.length} Products`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VACATION MODE QUICK MODAL */}
      {vacationModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🌴</span>
                <h3 className="font-extrabold text-sm sm:text-base">Storefront Vacation Mode</h3>
              </div>
              <button
                type="button"
                onClick={() => setVacationModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                When Vacation Mode is activated, customers browsing your storefront and product listings will see a vacation banner notifying them of temporary fulfillment delays.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Vacation Notice to Customers (Optional)
                </label>
                <textarea
                  rows={3}
                  value={vacationNoticeInput}
                  onChange={(e) => setVacationNoticeInput(e.target.value)}
                  placeholder="e.g. Taking a holiday break until Monday, all pending orders are on schedule!"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                {seller?.isVacationMode ? (
                  <button
                    type="button"
                    disabled={updatingVacation}
                    onClick={() => handleToggleVacationMode(false)}
                    className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-bold transition disabled:opacity-50"
                  >
                    Turn Off Vacation
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setVacationModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  disabled={updatingVacation}
                  onClick={() => handleToggleVacationMode(true, vacationNoticeInput)}
                  className="px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold transition shadow-xs disabled:opacity-50"
                >
                  {updatingVacation ? 'Saving...' : seller?.isVacationMode ? 'Update Vacation Notice' : 'Activate Vacation Mode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
