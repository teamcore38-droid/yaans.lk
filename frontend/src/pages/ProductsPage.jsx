import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Filter, X, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import ProductCard from '../components/ProductCard.jsx';

const CATEGORIES_LIST = [
  { slug: '', label: 'All Departments' },
  { slug: 'homemade-pantry', label: 'Homemade & Spices' },
  { slug: 'electronics', label: 'Electronics & Tech' },
  { slug: 'home-kitchen', label: 'Home & Clay Cookware' },
  { slug: 'fashion-handloom', label: 'Fashion & Handloom' },
  { slug: 'ayurveda-beauty', label: 'Ayurveda & Beauty' },
  { slug: 'fitness-daily-deals', label: 'Fitness & Everyday Gear' }
];

const SELLER_ORIGIN_DISTRICTS = ['All Districts', 'Colombo', 'Kandy', 'Galle', 'Gampaha', 'Jaffna'];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const subCategory = searchParams.get('subCategory') || '';
  const homemade = searchParams.get('homemade') || '';
  const deals = searchParams.get('deals') || '';
  const district = searchParams.get('district') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const sort = searchParams.get('sort') || 'popular';
  const page = searchParams.get('page') || '1';

  useEffect(() => {
    let active = true;
    setLoading(true);
    const queryStr = searchParams.toString();
    apiRequest(`/marketplace/products?${queryStr}`)
      .then((res) => {
        if (active) {
          setProducts(res.products || []);
          setPagination(res.pagination || { total: 0, page: 1, totalPages: 1 });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams]);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key === 'category') {
      next.delete('subCategory');
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const resetAllFilters = () => {
    setSearchParams({});
  };

  const FilterControls = () => (
    <div className="space-y-5 text-xs">
      {/* Department Filter */}
      <div>
        <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">Department</h3>
        <div className="space-y-1">
          {CATEGORIES_LIST.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => updateFilter('category', c.slug)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition ${
                category === c.slug
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Special Marketplace Filters */}
      <div className="border-t border-slate-200 pt-4">
        <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
          Marketplace Type
        </h3>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-slate-800 font-medium">
          <input
            type="checkbox"
            checked={homemade === 'true'}
            onChange={(e) => updateFilter('homemade', e.target.checked ? 'true' : '')}
            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          <span>Homemade & Artisan Only</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer text-slate-800 font-medium">
          <input
            type="checkbox"
            checked={deals === 'true'}
            onChange={(e) => updateFilter('deals', e.target.checked ? 'true' : '')}
            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          <span>Value Deals & Discounts</span>
        </label>
      </div>

      {/* Price Filter in LKR */}
      <div className="border-t border-slate-200 pt-4">
        <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
          Price in LKR (Rs.)
        </h3>
        <div className="space-y-1">
          {[
            { label: 'Any Price', val: '' },
            { label: 'Under Rs. 1,500', val: '1500' },
            { label: 'Under Rs. 2,500', val: '2500' },
            { label: 'Under Rs. 5,000', val: '5000' },
            { label: 'Under Rs. 10,000', val: '10000' }
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => updateFilter('maxPrice', p.val)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium ${
                maxPrice === p.val
                  ? 'bg-slate-200 text-slate-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seller District Origin */}
      <div className="border-t border-slate-200 pt-4">
        <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
          Ships From Seller District
        </h3>
        <div className="space-y-1">
          {SELLER_ORIGIN_DISTRICTS.map((dist) => {
            const val = dist === 'All Districts' ? '' : dist;
            return (
              <button
                key={dist}
                type="button"
                onClick={() => updateFilter('district', val)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium ${
                  district === val
                    ? 'bg-slate-200 text-slate-950 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {dist}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={resetAllFilters}
        className="w-full py-2 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold flex items-center justify-center gap-1.5"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset All Filters
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
      {/* Top Bar: Breadcrumb / Results Count / Sort & Mobile Filter Trigger */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
            {q
              ? `Search results for "${q}"`
              : homemade === 'true'
              ? 'Sri Lankan Homemade & Cottage Products'
              : deals === 'true'
              ? "Today's Value Deals in LKR"
              : CATEGORIES_LIST.find((c) => c.slug === category)?.label || 'All Marketplace Products'}
          </h1>
          <p className="text-xs text-slate-500">
            Showing {products.length} of {pagination.total} verified listings • Cash on Delivery Available
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
          >
            <option value="popular">Sort: Best Selling</option>
            <option value="price_asc">Price: Low to High (Rs.)</option>
            <option value="price_desc">Price: High to Low (Rs.)</option>
            <option value="rating">Customer Rating</option>
            <option value="newest">Newest Arrivals</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm sticky top-28">
          <FilterControls />
        </aside>

        {/* Product Results Grid */}
        <div className="lg:col-span-9">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
              <div className="text-base font-bold text-slate-900">
                No products match your current filter selection
              </div>
              <p className="text-xs text-slate-600">
                Try clearing a filter or searching across all departments.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Show All Products
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pNum) => (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => updateFilter('page', String(pNum))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        Number(page) === pNum
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {pNum}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative ml-auto w-80 max-w-[85vw] bg-white h-full overflow-y-auto p-4 z-10 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Filter className="w-4 h-4" /> Filter Products
              </span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <FilterControls />
          </div>
        </div>
      )}
    </div>
  );
}
