import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Star,
  MapPin,
  Truck,
  Banknote,
  Store,
  ShoppingCart,
  Heart,
  Check,
  ShieldCheck
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useCatalogResource } from '../hooks/useCatalogResource.js';
import { imageUrl, imageSrcSet } from '../utils/images.js';

export default function ProductDetailPage() {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewPage = Math.max(1, parseInt(searchParams.get('reviews'), 10) || 1);
  const {
    user,
    selectedDistrict,
    setSelectedDistrict,
    addToCart,
    wishlistIds,
    toggleWishlist,
    showToast
  } = useMarketplace();

  const endpoint = `/marketplace/products/${idOrSlug}?destinationDistrict=${encodeURIComponent(selectedDistrict)}&reviewPage=${reviewPage}`;
  const { data, setData, loading } = useCatalogResource(endpoint);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const initializedProduct = useRef(null);

  // Review form state
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!data?.product?._id || initializedProduct.current === data.product._id) return;
    initializedProduct.current = data.product._id;
    setActiveImage(0);
    setQuantity(1);
    setSelectedVariant(data?.product?.variants?.[0]?.values?.[0]?.label || 'Standard');
  }, [data?.product?._id]);

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        <div className="h-96 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="bg-white p-8 rounded-xl border border-slate-200 space-y-3">
          <h1 className="text-lg font-bold text-slate-900">Product Not Found</h1>
          <Link
            to="/products"
            className="inline-block px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { product, seller, reviews = [], relatedProducts = [], shippingEstimate, reviewPagination } = data;
  const changeReviewPage = (page) => {
    const next = new URLSearchParams(searchParams);
    next.set('reviews', String(page));
    setSearchParams(next, { preventScrollReset: true });
  };
  const isWishlisted = wishlistIds.includes(product._id);

  // Compute active price based on selected variant
  let activePriceLkr = product.priceLkr;
  if (product.variants?.length > 0) {
    for (const vg of product.variants) {
      const matched = (vg.values || []).find((v) => v.label === selectedVariant);
      if (matched?.priceLkr) activePriceLkr = matched.priceLkr;
    }
  }

  const handleBuyNow = () => {
    addToCart(product, selectedVariant, quantity);
    navigate('/checkout');
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    try {
      setSubmittingReview(true);
      const res = await apiRequest(`/marketplace/products/${product._id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: user ? user.name : reviewName || 'Sri Lankan Shopper',
          district: selectedDistrict,
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment
        })
      });
      setData((prev) => ({
        ...prev,
        product: {
          ...prev.product,
          rating: res.productRating,
          reviewCount: res.reviewCount
        },
        reviews: [res.review, ...(prev.reviews || [])].slice(0, prev.reviewPagination?.limit || 20),
        ...(prev.reviewPagination ? { reviewPagination: { ...prev.reviewPagination,
          total: prev.reviewPagination.total + 1,
          totalPages: Math.max(1, Math.ceil((prev.reviewPagination.total + 1) / prev.reviewPagination.limit)) } } : {})
      }));
      if (reviewPage !== 1) changeReviewPage(1);
      setReviewTitle('');
      setReviewComment('');
      showToast('Thank you! Your review has been published.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
        <Link to="/" className="hover:text-slate-900">Home</Link>
        <span>/</span>
        <Link to={`/products?category=${product.categorySlug}`} className="hover:text-slate-900 capitalize">
          {product.categorySlug?.replace(/-/g, ' ')}
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate">{product.title}</span>
      </nav>

      {/* Main Product Container */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Gallery (4 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <img
              src={imageUrl(product.images?.[activeImage] || product.images?.[0], 1200)}
              srcSet={imageSrcSet(product.images?.[activeImage] || product.images?.[0], [480, 640, 960, 1200])}
              sizes="(min-width: 1024px) 480px, 90vw"
              alt={product.title}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
          {product.images?.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {product.images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                    activeImage === idx ? 'border-slate-900' : 'border-slate-200'
                  }`}
                >
                  <img src={imgUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: Product Specs, Variants & Description (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {product.isHomemade && (
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-700 text-white">
                Authentic Sri Lankan Homemade
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {product.sellerType || 'Verified Seller'}
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
            {product.title}
          </h1>

          <div className="flex items-center gap-3 text-xs border-b border-slate-200 pb-3">
            <div className="flex items-center text-amber-500 font-bold">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500 mr-1" />
              <span className="text-slate-900">{product.rating}</span>
              <span className="text-slate-500 font-normal ml-1">
                ({product.reviewCount} ratings)
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">{product.soldCount} sold</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">SKU: {product.sku}</span>
          </div>

          {/* LKR Price */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {formatLkr(activePriceLkr)}
              </span>
              {product.compareAtPriceLkr && product.compareAtPriceLkr > activePriceLkr && (
                <span className="text-sm text-slate-400 line-through">
                  {formatLkr(product.compareAtPriceLkr)}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Final price in LKR (Rs.) • No VAT/Tax surcharge added at checkout
            </div>
          </div>

          {/* Variants Selector */}
          {product.variants?.map((vGroup) => (
            <div key={vGroup.name} className="space-y-2">
              <div className="text-xs font-bold text-slate-800">
                {vGroup.name}: <span className="text-sky-700">{selectedVariant}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(vGroup.values || []).map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setSelectedVariant(v.label)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      selectedVariant === v.label
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {v.label} — {formatLkr(v.priceLkr)}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Product Highlights */}
          {product.highlights?.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Key Highlights
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {product.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          <div className="pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Product Description
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>

        {/* Right: Buy Box, District Delivery Calculator & Seller Storefront Card (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Check className="w-4 h-4" />
                {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock'}
              </span>
            </div>

            {/* Live Sri Lankan District Shipping Fee Box */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-600" />
                  Deliver to District:
                </span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-300 focus:outline-none"
                >
                  {DEFAULT_SL_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {shippingEstimate && (
                <div className="pt-2 border-t border-slate-100 space-y-1 text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Ships from:</span>
                    <strong className="text-slate-900">{shippingEstimate.originDistrict}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Courier Fee:</span>
                    <strong className="text-slate-900">
                      {shippingEstimate.isFreeShipping
                        ? 'FREE'
                        : formatLkr(shippingEstimate.deliveryFeeLkr)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Est. Delivery:</span>
                    <span className="font-medium text-slate-800">{shippingEstimate.estimatedDays}</span>
                  </div>
                  {seller?.shippingPolicy?.freeShippingThresholdLkr > 0 && (
                    <div className="text-[11px] text-emerald-700 font-medium pt-1">
                      Free delivery from this seller on orders over{' '}
                      {formatLkr(seller.shippingPolicy.freeShippingThresholdLkr)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Quantity:</span>
              <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1 font-bold hover:bg-slate-100"
                >
                  -
                </button>
                <span className="px-3 py-1 font-bold text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock || 20, q + 1))}
                  className="px-3 py-1 font-bold hover:bg-slate-100"
                >
                  +
                </button>
              </div>
            </div>

            {/* Vacation Notice if Seller is away */}
            {seller?.isVacationMode && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                <span className="text-base shrink-0">🌴</span>
                <div className="leading-snug">
                  <strong className="text-amber-950 font-bold">Seller is on Vacation:</strong>{' '}
                  <span className="text-amber-900">
                    {seller.vacationNotice || 'Orders will be fulfilled once the seller returns.'}
                  </span>
                </div>
              </div>
            )}

            {/* Primary CTAs */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => addToCart(product, selectedVariant, quantity)}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={handleBuyNow}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
              >
                <Banknote className="w-4 h-4 text-amber-400" />
                Buy Now (Cash on Delivery)
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product._id)}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    isWishlisted ? 'fill-red-500 text-red-500' : ''
                  }`}
                />
                {isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}
              </button>
            </div>

            {/* COD & Seller Info Box */}
            <div className="pt-3 border-t border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Cash on Delivery (COD) supported</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
                <span>7-Day Return & Replacement Protection</span>
              </div>
            </div>
          </div>

          {/* Seller Card */}
          {seller && (
            <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sold & Fulfilled By
              </div>
              <div className="flex items-center gap-3">
                <img
                  src={seller.logoUrl}
                  alt={seller.storeName}
                  className="w-11 h-11 rounded-lg object-cover border border-slate-200"
                />
                <div>
                  <Link
                    to={`/store/${seller.slug}`}
                    className="text-sm font-bold text-slate-900 hover:text-sky-700"
                  >
                    {seller.storeName}
                  </Link>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {seller.city}, {seller.district}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{seller.description}</p>
              <Link
                to={`/store/${seller.slug}`}
                className="block w-full py-2 text-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs"
              >
                Visit Seller Storefront
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews & Rating Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            Write a Customer Review
          </h2>
          <form onSubmit={handleReviewSubmit} className="space-y-3 text-xs">
            {!user && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  placeholder="e.g., Nuwan Perera"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Star Rating</label>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value={5}>★★★★★ (5/5 - Excellent)</option>
                <option value={4}>★★★★☆ (4/5 - Good)</option>
                <option value={3}>★★★☆☆ (3/5 - Average)</option>
                <option value={2}>★★☆☆☆ (2/5 - Fair)</option>
                <option value={1}>★☆☆☆☆ (1/5 - Poor)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Review Headline</label>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="e.g., Fresh quality and fast delivery"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Your Experience</label>
              <textarea
                rows={3}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience with the product quality and packaging..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
            >
              {submittingReview ? 'Submitting...' : 'Submit Verified Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            Verified Customer Reviews ({reviewPagination?.total ?? reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="text-xs text-slate-500">No reviews yet. Be the first to review this item!</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev._id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">
                      {rev.customerName}{' '}
                      <span className="font-normal text-slate-500">({rev.district})</span>
                    </span>
                    <span className="text-amber-500 font-bold">
                      {'★'.repeat(rev.rating)}
                    </span>
                  </div>
                  {rev.title && <div className="text-xs font-bold text-slate-800">{rev.title}</div>}
                  <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          )}
          {reviewPagination?.totalPages > 1 && (
            <nav aria-label="Review pages" className="flex items-center justify-between gap-3 text-xs">
              <button type="button" disabled={loading || reviewPage <= 1} onClick={() => changeReviewPage(reviewPage - 1)}
                className="px-3 py-2 rounded border border-slate-300 disabled:opacity-40">Previous reviews</button>
              <span aria-live="polite">Page {reviewPage} of {reviewPagination.totalPages}</span>
              <button type="button" disabled={loading || reviewPage >= reviewPagination.totalPages} onClick={() => changeReviewPage(reviewPage + 1)}
                className="px-3 py-2 rounded border border-slate-300 disabled:opacity-40">Next reviews</button>
            </nav>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mb-3">
            More From This Category & Seller
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {relatedProducts.map((p) => (
              <ProductCard key={p._id} product={p} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
