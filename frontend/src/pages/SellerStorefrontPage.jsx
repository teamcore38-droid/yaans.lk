import React from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Store, MapPin, Star, Truck, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatLkr } from '../utils/api.js';
import ProductCard from '../components/ProductCard.jsx';
import { useCatalogResource } from '../hooks/useCatalogResource.js';

export default function SellerStorefrontPage() {
  const { slugOrId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const { data, loading } = useCatalogResource(`/marketplace/sellers/${slugOrId}?page=${page}`);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        <div className="h-56 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!data?.seller) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="bg-white p-8 rounded-xl border border-slate-200 space-y-3">
          <h1 className="text-lg font-bold text-slate-900">Seller Storefront Not Found</h1>
          <Link
            to="/products"
            className="inline-block px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Browse All Products
          </Link>
        </div>
      </div>
    );
  }

  const { seller, products = [], pagination } = data;
  const changePage = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(value));
    setSearchParams(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      {/* Seller Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="h-28 sm:h-36 bg-slate-900 relative overflow-hidden">
          {seller.bannerUrl && (
            <img
              src={seller.bannerUrl}
              alt={seller.storeName}
              className="w-full h-full object-cover opacity-40"
            />
          )}
        </div>

        <div className="p-4 sm:p-6 -mt-10 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <img
              src={seller.logoUrl}
              alt={seller.storeName}
              className="w-20 h-20 rounded-xl object-cover border-4 border-white shadow bg-white"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900">
                  {seller.storeName}
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {seller.sellerType}
                </span>
              </div>
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Ships from {seller.city}, {seller.district} District
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-slate-900">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {seller.rating} ({seller.reviewCount} reviews)
                </span>
              </div>
            </div>
          </div>

          {seller.shippingPolicy?.freeShippingThresholdLkr > 0 && (
            <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-700" />
              <span>
                Free delivery from this seller on orders over{' '}
                <strong>{formatLkr(seller.shippingPolicy.freeShippingThresholdLkr)}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5 text-xs sm:text-sm text-slate-600 border-t border-slate-100 pt-3">
          {seller.description}
        </div>
      </div>

      {/* Seller Vacation Notice Banner */}
      {seller.isVacationMode && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex items-start sm:items-center gap-3.5 shadow-xs">
          <span className="text-2xl sm:text-3xl shrink-0">🌴</span>
          <div className="flex-1">
            <div className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
              <span>Store is Currently on Vacation</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-slate-950">
                Temporary Pause
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              {seller.vacationNotice ||
                'This seller is taking a temporary break. You can still explore the catalog, and new orders will be processed when the seller returns.'}
            </p>
          </div>
        </div>
      )}

      {/* Seller Catalog */}
      <section>
        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mb-3">
          Products from {seller.storeName} ({pagination?.total ?? products.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
        {pagination?.totalPages > 1 && (
          <nav aria-label="Store product pages" className="mt-5 flex items-center justify-between gap-3 text-xs">
            <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}
              className="px-3 py-2 rounded border border-slate-300 disabled:opacity-40">Previous products</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button type="button" disabled={page >= pagination.totalPages} onClick={() => changePage(page + 1)}
              className="px-3 py-2 rounded border border-slate-300 disabled:opacity-40">Next products</button>
          </nav>
        )}
      </section>
    </div>
  );
}
