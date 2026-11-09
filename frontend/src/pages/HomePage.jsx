import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Tag,
  Store,
  MapPin,
  Star,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { useMarketplace } from '../context/MarketplaceContext.jsx';
import CategoryQuadCard from '../components/CategoryQuadCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import BannerProductCarousel, { BANNER_CAROUSEL_CARDS } from '../components/BannerProductCarousel.jsx';

export default function HomePage() {
  const { user, selectedDistrict } = useMarketplace();
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiRequest('/marketplace/home')
      .then((data) => {
        if (mounted) setHomeData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading && !homeData) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        <div className="h-48 sm:h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const banners = homeData?.banners || [];
  const categories = homeData?.categories || [];
  const homemadeProducts = homeData?.homemadeProducts || [];
  const dealProducts = homeData?.dealProducts || [];
  const recommendedProducts = homeData?.recommendedProducts || [];
  const verifiedSellers = homeData?.verifiedSellers || [];

  const activeBanner = banners[bannerIdx % Math.max(1, banners.length)];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 space-y-4 sm:space-y-5">
      {/* Top Practical Hero Banner */}
      {activeBanner && (
        <div className="relative bg-white rounded-xl border border-[#edd7df] overflow-hidden shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Mobile-Only Hero Banner (Replaces marked text section on mobile screens) */}
            <Link
              to={activeBanner.ctaLink || '/products'}
              aria-label="Sri Lankan Homemade & Everyday Essentials - Shop Now"
              className="block lg:hidden w-full bg-[#fff1f3] overflow-hidden"
            >
              <img
                src="/mobile_hero_banner.jpg"
                alt="Sri Lankan Homemade & Everyday Essentials - Cash on Delivery"
                className="w-full h-auto object-cover block"
              />
            </Link>

            {/* Desktop Left Column: Marketplace highlights & Action CTAs - vertically centered with full-height background */}
            <div className="hidden lg:flex p-5 sm:p-6 lg:p-7 lg:col-span-6 xl:col-span-6 flex-col justify-center space-y-2.5 sm:space-y-3 bg-[#fff1f3]/60">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#fde8ec] border border-[#faccd6] text-[#72495c] text-[11px] font-bold tracking-wide uppercase w-fit">
                <Truck className="w-3.5 h-3.5 text-[#72495c]" />
                {activeBanner.badge}
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-[26px] xl:text-3xl font-extrabold text-[#2b1b25] leading-tight">
                {activeBanner.title}
              </h1>
              <p className="text-xs sm:text-[13px] text-[#664b58] max-w-xl leading-relaxed">
                {activeBanner.subtitle}
              </p>
              <div className="pt-0.5 flex flex-wrap items-center gap-2.5">
                <Link
                  to={activeBanner.ctaLink || '/products'}
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition shadow-sm"
                >
                  {activeBanner.ctaText || 'Shop Now'}
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/products?homemade=true"
                  className="px-4 py-2 rounded-lg bg-white hover:bg-[#fff0f3] text-[#72495c] border border-[#faccd6] font-semibold text-xs sm:text-sm transition shadow-2xs"
                >
                  Browse Homemade SL
                </Link>
              </div>
            </div>

            {/* Right Column: Compact Auto-scrollable Product Cards with consistent height */}
            <div className="lg:col-span-6 xl:col-span-6 bg-[#fff7f9] p-2.5 sm:p-3.5 border-t lg:border-t-0 lg:border-l border-[#f0dce3] overflow-hidden flex flex-col justify-center">
              <BannerProductCarousel
                activeCardIndex={activeCardIndex}
                onCardChange={setActiveCardIndex}
                isPaused={isCarouselPaused}
                setIsPaused={setIsCarouselPaused}
              />
            </div>
          </div>

          {/* Bottom Bar with District Status and Interactive Product Card Controls */}
          <div className="px-4 sm:px-6 py-2.5 bg-[#fdf6f7] border-t border-[#f0dce3] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6b4d5a]">
            <span>
              Delivering to <strong className="text-[#2b1b25]">{selectedDistrict} District</strong> • Cash on Delivery Enabled
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#72495c] hidden sm:inline">
                Viewing: <strong className="text-[#3e2230]">{BANNER_CAROUSEL_CARDS[activeCardIndex]?.category}</strong>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous product card"
                  onClick={() =>
                    setActiveCardIndex(
                      (prev) => (prev - 1 + BANNER_CAROUSEL_CARDS.length) % BANNER_CAROUSEL_CARDS.length
                    )
                  }
                  className="p-1 rounded bg-white border border-[#eed6df] hover:bg-[#fff0f3] text-[#482c39] transition shadow-2xs"
                  title="Previous product card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold text-[#2b1b25] px-1 min-w-[34px] text-center">
                  {activeCardIndex + 1} / {BANNER_CAROUSEL_CARDS.length}
                </span>
                <button
                  type="button"
                  aria-label="Next product card"
                  onClick={() =>
                    setActiveCardIndex((prev) => (prev + 1) % BANNER_CAROUSEL_CARDS.length)
                  }
                  className="p-1 rounded bg-white border border-[#eed6df] hover:bg-[#fff0f3] text-[#482c39] transition shadow-2xs"
                  title="Next product card"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile & Guest Sign-In Strip (Modeled directly on reference screenshot) */}
      {!user && (
        <div className="!mt-2 sm:!mt-2.5 bg-white rounded-xl border border-slate-200 py-2.5 px-3.5 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-snug">
              Sign in for the best Yaans.lk experience
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Track multi-seller orders, save your Sri Lankan delivery address, or shop immediately with Guest Cash on Delivery.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <Link
              to="/login"
              className="px-5 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs text-center shadow-xs"
            >
              Sign in securely
            </Link>
            <Link
              to="/register"
              className="text-xs font-semibold text-sky-700 hover:underline text-center px-2 py-1"
            >
              Create an account
            </Link>
          </div>
        </div>
      )}

      {/* 2x2 Category Quad Cards (Mobile-First Reference Layout) */}
      <section aria-label="Shop by Category" className="!mt-2 sm:!mt-2.5">
        <div className="flex items-center justify-between mb-1 sm:mb-1.5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
              Explore Categories
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tap any department or subcategory tile to filter products
            </p>
          </div>
          <Link
            to="/products"
            className="text-xs font-semibold text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5"
          >
            View All Departments <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <CategoryQuadCard key={cat._id} category={cat} />
          ))}
        </div>
      </section>

      {/* Authentic Sri Lankan Homemade Products Section */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Sri Lankan Homemade & Cottage Products
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                  Direct from Home Kitchens & Artisans
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Fresh achcharu, pure Kotmale kithul treacle, village clay pots, handloom sarongs & herbal hair oils
              </p>
            </div>
          </div>

          <Link
            to="/products?homemade=true"
            className="text-xs font-bold text-sky-700 hover:text-sky-800 inline-flex items-center gap-1 shrink-0"
          >
            See all homemade finds <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {homemadeProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {homemadeProducts.slice(0, 8).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <p className="text-xs font-semibold text-slate-700">No homemade items listed yet.</p>
            <p className="text-[11px] text-slate-500">Are you a home-based creator or small producer in Sri Lanka? Register to start selling today!</p>
            <Link
              to="/seller/register"
              className="inline-block mt-1 px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-xs"
            >
              Sell Your Homemade Products
            </Link>
          </div>
        )}
      </section>

      {/* Daily Deals in LKR (Rs.) */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <Tag className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Today&apos;s Value Deals in LKR (Rs.)
              </h2>
              <p className="text-xs text-slate-600">
                Practical discounts on everyday tech, home essentials & pantry items — no hidden tax added at checkout
              </p>
            </div>
          </div>

          <Link
            to="/products?deals=true"
            className="text-xs font-bold text-sky-700 hover:text-sky-800 inline-flex items-center gap-1 shrink-0"
          >
            All Deals <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {dealProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {dealProducts.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-xs text-slate-500">Deals are updated in real-time as sellers launch promotions across Sri Lanka.</p>
          </div>
        )}
      </section>

      {/* Verified Local Sellers Showcase */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Shop by Verified Sri Lankan Sellers
            </h2>
            <p className="text-xs text-slate-600">
              Combine items from multiple sellers in a single cart — Yaans.lk splits & tracks each shipment automatically
            </p>
          </div>
          <Link
            to="/seller/register"
            className="text-xs font-bold text-sky-700 hover:text-sky-800 inline-flex items-center gap-1"
          >
            Open Your Store <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {verifiedSellers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {verifiedSellers.map((seller) => (
              <Link
                key={seller._id}
                to={`/store/${seller.slug}`}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-white transition flex items-start gap-3"
              >
                <img
                  src={seller.logoUrl}
                  alt={seller.storeName}
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {seller.storeName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{seller.city}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-700">
                      {seller.sellerType}
                    </span>
                    <span className="inline-flex items-center text-[11px] font-bold text-slate-800">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500 mr-0.5" />
                      {seller.rating}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <p className="text-xs font-semibold text-slate-700">No verified sellers registered yet.</p>
            <p className="text-[11px] text-slate-500">Sell homemade or retail products across all 25 Sri Lankan districts with automated courier logistics.</p>
            <Link
              to="/seller/register"
              className="inline-block mt-1 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
            >
              Become the First Seller
            </Link>
          </div>
        )}
      </section>

      {/* Recommended Marketplace Products */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Recommended For You
            </h2>
            <p className="text-xs text-slate-500">
              Most popular items ordered across Sri Lanka this week
            </p>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5"
          >
            Browse All Products <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recommendedProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {recommendedProducts.map((product) => (
              <ProductCard key={product._id} product={product} compact />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-white border border-slate-200 text-center">
            <p className="text-xs text-slate-500">Marketplace catalog is ready. New listings will appear here automatically.</p>
          </div>
        )}
      </section>
    </div>
  );
}
