import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Heart, ShoppingCart, MapPin, Check } from 'lucide-react';
import { formatLkr } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';
import { imageUrl, imageSrcSet } from '../utils/images.js';
import { buyNowPath } from '../utils/buyNow.js';

export default function ProductCard({ product, compact = false, priority = false }) {
  const { addToCart, wishlistIds, toggleWishlist } = useMarketplace();
  const navigate = useNavigate();
  const isWishlisted = wishlistIds.includes(product._id);

  const discountPercent =
    product.compareAtPriceLkr && product.compareAtPriceLkr > product.priceLkr
      ? Math.round(((product.compareAtPriceLkr - product.priceLkr) / product.compareAtPriceLkr) * 100)
      : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between hover:border-slate-300 transition shadow-sm">
      <div>
        {/* Product Image Container */}
        <div className="relative aspect-square bg-slate-100 overflow-hidden">
          <Link to={`/product/${product.slug || product._id}`} className="block w-full h-full">
            <img
              src={imageUrl(product.images?.[0], 640)}
              srcSet={imageSrcSet(product.images?.[0])}
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 320px"
              alt={product.title}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            />
          </Link>

          {/* Top Left Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discountPercent > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-amber-300 shadow-sm">
                -{discountPercent}% OFF
              </span>
            )}
          </div>

          {/* Top Right Wishlist Button */}
          <button
            type="button"
            onClick={() => toggleWishlist(product._id)}
            aria-label="Toggle wishlist"
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm"
          >
            <Heart
              className={`w-4 h-4 ${
                isWishlisted ? 'fill-red-500 text-red-500' : 'text-slate-600'
              }`}
            />
          </button>
        </div>

        {/* Product Info */}
        <div className="p-2.5 sm:p-3">
          {/* Seller & Origin District */}
          <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 mb-1">
            <Link
              to={`/store/${product.sellerSlug || product.sellerId}`}
              className="hover:text-sky-700 font-medium truncate"
            >
              {product.sellerName}
            </Link>
            <span className="inline-flex items-center gap-0.5 text-slate-600 font-medium shrink-0">
              <MapPin className="w-3 h-3 text-slate-400" />
              {product.sellerDistrict}
            </span>
          </div>

          {/* Title */}
          <Link
            to={`/product/${product.slug || product._id}`}
            className="text-sm font-semibold text-slate-900 hover:text-sky-700 line-clamp-2 leading-snug sm:min-h-[2.5rem]"
          >
            {product.title}
          </Link>

          {/* Rating and product origin */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 mt-1.5">
            <div role="group" aria-label="Product rating" className="flex items-center gap-1 shrink-0">
              <div className="flex items-center text-amber-500">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 ml-1">{product.rating || '4.8'}</span>
              </div>
              <span className="text-[11px] text-slate-500">({product.reviewCount || 0})</span>
            </div>
            {product.isHomemade && (
              <span className="ml-auto shrink-0 whitespace-nowrap px-1 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-emerald-700 text-white">
                Homemade SL
              </span>
            )}
            {product.soldCount > 0 && (
              <span className="text-[11px] text-slate-400 ml-auto whitespace-nowrap">{product.soldCount} sold</span>
            )}
          </div>

          {/* Price in LKR (Rs.) */}
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base sm:text-lg font-extrabold text-slate-900">
              {formatLkr(product.priceLkr)}
            </span>
            {product.compareAtPriceLkr && product.compareAtPriceLkr > product.priceLkr && (
              <span className="text-xs text-slate-400 line-through">
                {formatLkr(product.compareAtPriceLkr)}
              </span>
            )}
          </div>

          {!compact && (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
              <Check className="w-3 h-3 shrink-0" />
              <span>COD Available • In Stock ({product.stock})</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3 flex items-stretch gap-1.5">
        <button
          type="button"
          disabled={product.stock <= 0}
          onClick={() => navigate(buyNowPath(product))}
          className="min-w-0 flex-1 h-9 rounded-lg bg-gradient-to-r from-[#A11620] to-[#D82432] text-white font-semibold text-xs sm:text-sm text-center hover:brightness-110 disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 transition shadow-sm"
        >
          Buy Now
        </button>
        <button
          type="button"
          disabled={product.stock <= 0}
          onClick={() => addToCart(product)}
          aria-label="Add to Cart"
          className="w-9 h-9 shrink-0 rounded-lg bg-[#FFC447] hover:brightness-95 disabled:bg-slate-200 text-slate-950 flex items-center justify-center transition shadow-sm"
        >
          <ShoppingCart aria-hidden="true" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
