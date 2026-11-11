import React, { useState } from 'react';
import { Image as ImageIcon, Plus, Edit3, Trash2, X, Upload, Check, Copy } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function BannerManagementTab({
  bannersState,
  categories,
  showToast,
  fetchOverview
}) {
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
    ctaLink: '/products',
    active: true,
    displayOrder: 1
  });

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
    const isShared =
      !banner.mobileImageUrl || banner.mobileImageUrl === banner.imageUrl || hasLegacyPinkMobile;
    setSyncBothBannerImages(isShared);

    const resolvedDesktop = banner.imageUrl || banner.mobileImageUrl || '';
    const resolvedMobile = hasLegacyPinkMobile
      ? resolvedDesktop
      : banner.mobileImageUrl || banner.imageUrl || '';

    setBannerForm({
      title: banner.title || '',
      imageUrl: resolvedDesktop,
      mobileImageUrl: resolvedMobile,
      categorySlug: banner.categorySlug || '',
      ctaLink:
        banner.ctaLink ||
        (banner.categorySlug ? `/products?category=${banner.categorySlug}` : '/products'),
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
            : isMobile
            ? 'Mobile banner image uploaded to Cloudinary CDN!'
            : 'Desktop banner image uploaded to Cloudinary CDN!'
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
    if (
      resolvedMobile === '/mobile_hero_banner.jpg' &&
      resolvedDesktop &&
      resolvedDesktop !== '/mobile_hero_banner.jpg'
    ) {
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
        body: JSON.stringify({
          ...banner,
          active: !banner.active
        })
      });
      showToast(`Banner "${banner.title}" ${!banner.active ? 'activated' : 'hidden'}.`);
      await fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
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
              const matchedCat = (categories || []).find((c) => c.slug === banner.categorySlug);
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
                            <span className="text-[9px] font-mono text-sky-700 bg-sky-50 px-1 rounded">
                              1400×390
                            </span>
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
                            <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded">
                              1080×460
                            </span>
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
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    syncBothBannerImages
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
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
                    {bannerForm.mobileImageUrl &&
                      bannerForm.mobileImageUrl !== bannerForm.imageUrl && (
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
                      <Upload
                        className={`w-3.5 h-3.5 ${uploadingDesktopBanner ? 'animate-bounce' : ''}`}
                      />
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
                    {bannerForm.imageUrl &&
                      bannerForm.imageUrl !== bannerForm.mobileImageUrl && (
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
                      <Upload
                        className={`w-3.5 h-3.5 ${uploadingMobileBanner ? 'animate-bounce' : ''}`}
                      />
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
                  {(categories || []).map((cat) => (
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
                      setBannerForm((prev) => ({
                        ...prev,
                        displayOrder: Number(e.target.value) || 1
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-xs"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                    <input
                      type="checkbox"
                      checked={bannerForm.active}
                      onChange={(e) =>
                        setBannerForm((prev) => ({ ...prev, active: e.target.checked }))
                      }
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
