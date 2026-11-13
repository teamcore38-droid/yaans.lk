import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  MapPin,
  Menu,
  X,
  Package,
  Store,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Tag,
  Home,
  LayoutGrid,
  LogOut
} from 'lucide-react';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';
import { customerAuthPath, customerReturnFromLocation } from '../../../shared/customerRedirect.js';
import { prepareCustomerAuth } from '../utils/checkoutDraft.js';

export default function Navbar() {
  const {
    user,
    logout,
    login,
    selectedDistrict,
    setSelectedDistrict,
    totalCartItems,
    wishlistIds,
    categories = []
  } = useMarketplace();

  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = customerReturnFromLocation(location);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCat, setSearchCat] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [districtModalOpen, setDistrictModalOpen] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (searchCat) params.set('category', searchCat);
    navigate(`/products?${params.toString()}`);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Utility Bar: Practical Sri Lankan Marketplace Info & Quick Role Access */}
      <div className="bg-[#6b0f16] text-[#fce4e7] text-xs border-b border-[#520a10]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="inline-flex items-center gap-1 font-medium text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Islandwide Delivery (25 Districts)
            </span>
            <span className="text-[#8f1e26] hidden sm:inline">|</span>
            <span className="hidden sm:inline text-[#fcd2d7]">
              Cash on Delivery (COD) Available • Prices in LKR (Rs.)
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
            <Link to="/track-order" className="text-[#fce4e7] hover:text-white transition-colors font-medium">
              Track Order
            </Link>
            <span className="text-[#8f1e26]">|</span>
            <Link to="/seller/register" className="hover:text-amber-200 text-amber-300 font-medium">
              Sell on Yaans.lk
            </Link>
          </div>
        </div>
      </div>

      {/* Main White Header with Adapted Transparent Yaans.lk Logo */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Mobile Drawer Button + Adapted Yaans.lk Logo on White Interface */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open categories menu"
                className="p-2 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>

              <Link to="/" className="flex items-center gap-1.5 group focus:outline-none">
                <img
                  src="/brand/yaans-logo-horizontal-dark.png"
                  alt="Yaans.lk Marketplace"
                  className="h-9 sm:h-10 w-auto object-contain"
                />
              </Link>

              {/* Desktop District Delivery Selector */}
              <button
                type="button"
                onClick={() => setDistrictModalOpen(true)}
                className="hidden lg:flex items-center gap-1.5 ml-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 text-left transition"
              >
                <MapPin className="w-4 h-4 text-slate-700 shrink-0" />
                <div className="leading-tight">
                  <div className="text-[10px] text-slate-500 font-medium">Deliver to Sri Lanka</div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-0.5">
                    {selectedDistrict} District
                  </div>
                </div>
              </button>
            </div>

            {/* Center: Desktop Amazon-Style Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex flex-1 max-w-2xl items-center bg-slate-50 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 focus-within:bg-white transition"
            >
              <select
                aria-label="Filter search by category"
                value={searchCat}
                onChange={(e) => setSearchCat(e.target.value)}
                className="bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2.5 border-r border-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Yaans.lk for homemade achcharu, clay pots, headphones, spices..."
                className="w-full px-3.5 py-2 text-sm text-slate-900 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Search products"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2.5 flex items-center justify-center transition"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            {/* Right: Portal Links, Account, Wishlist, Cart */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {user?.role === 'seller' && (
                <Link
                  to="/seller/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  Seller Portal
                </Link>
              )}

              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  Admin Dashboard
                </Link>
              )}

              {user ? (
                <div className="flex items-center gap-1">
                  <Link
                    to={
                      user.role === 'staff' ? '/staff' : user.role === 'admin'
                        ? '/admin'
                        : user.role === 'seller'
                        ? '/seller/dashboard'
                        : '/account'
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800"
                  >
                    <User className="w-5 h-5 text-slate-700" />
                    <div className="hidden xl:block text-left leading-tight">
                      <div className="text-[10px] text-slate-500">
                        {user.role === 'staff' ? 'Order Staff' : user.role === 'admin'
                          ? 'Super Admin'
                          : user.role === 'seller'
                          ? 'Verified Seller'
                          : `Hello, ${user.name.split(' ')[0]}`}
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {user.role === 'staff' ? 'Staff Dashboard' : user.role === 'admin'
                          ? 'Admin Console'
                          : user.role === 'seller'
                          ? (user.sellerStoreName || 'Seller Portal')
                          : 'Account & Orders'}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    title="Sign Out"
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 hidden sm:inline-flex"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  to={customerAuthPath('login', returnTo)}
                  onClick={prepareCustomerAuth}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800"
                >
                  <User className="w-5 h-5 text-slate-700" />
                  <div className="text-left leading-tight">
                    <div className="text-[10px] text-slate-500 hidden sm:block">Sign in</div>
                    <div className="text-xs font-bold text-slate-900">Account</div>
                  </div>
                </Link>
              )}

              <Link
                to="/wishlist"
                aria-label="Wishlist"
                className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-800"
              >
                <Heart className="w-5 h-5 text-slate-700" />
                {wishlistIds.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                    {wishlistIds.length}
                  </span>
                )}
              </Link>

              <Link
                to="/cart"
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold transition"
              >
                <div className="relative">
                  <ShoppingCart className="w-5 h-5 text-slate-900" />
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-extrabold flex items-center justify-center">
                    {totalCartItems}
                  </span>
                </div>
                <span className="hidden sm:inline text-xs font-bold ml-1">Cart</span>
              </Link>
            </div>
          </div>

          {/* Mobile Full-Width Search Input (Modeled on Reference Image) */}
          <form onSubmit={handleSearchSubmit} className="mt-2 flex md:hidden items-center">
            <div className="flex w-full items-center bg-slate-50 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 focus-within:bg-white">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Yaans.lk (spices, electronics, clay pots...)"
                className="w-full px-3 py-2 text-sm text-slate-900 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2.5 font-semibold"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Sub-Header Quick Navigation Links + Mobile Location Bar */}
        <div className="bg-[#8b141d] border-t border-[#730f17] border-b border-[#730f17]">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-3 py-1.5 overflow-x-auto no-scrollbar text-xs font-medium text-[#fff0f2] whitespace-nowrap">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setDistrictModalOpen(true)}
                className="inline-flex lg:hidden items-center gap-1 text-white font-semibold bg-[#730f17] px-2 py-1 rounded border border-[#9b1d26]"
              >
                <MapPin className="w-3.5 h-3.5 text-white" />
                Deliver to {selectedDistrict} ▾
              </button>

              <Link to="/products" className="hover:text-white font-semibold flex items-center gap-1 bg-[#730f17] hover:bg-[#5e0a10] text-white px-2.5 py-1 rounded-md transition-colors">
                All Products
              </Link>
              <Link
                to="/products?homemade=true"
                className="hover:text-white font-semibold text-[#fff0f2] hover:bg-[#730f17]/60 px-2 py-0.5 rounded transition-colors"
              >
                Homemade Sri Lanka
              </Link>
              <Link
                to="/products?deals=true"
                className="hover:bg-amber-400 font-bold text-slate-950 bg-amber-300 px-3 py-1 rounded-full shadow-xs transition-colors"
              >
                Today&apos;s Deals
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  to={`/products?category=${c.slug}`}
                  className="text-[#fce5e8] hover:text-white transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-white h-full overflow-y-auto flex flex-col z-10 shadow-xl">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-300">Welcome to Yaans.lk</div>
                <div className="font-bold text-sm">
                  {user ? `${user.name} (${user.role.toUpperCase()})` : 'Sign In / Browse'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{user.name}</div>
                      <div className="text-[11px] text-slate-500">{user.email}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        user.role === 'admin'
                          ? 'bg-sky-100 text-sky-800'
                          : user.role === 'seller'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <Link
                      to={
                        user.role === 'staff' ? '/staff' : user.role === 'admin'
                          ? '/admin'
                          : user.role === 'seller'
                          ? '/seller/dashboard'
                          : '/account'
                      }
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 text-white text-xs font-bold text-center"
                    >
                      {user.role === 'staff' ? 'Staff Dashboard' : user.role === 'admin'
                        ? 'Admin Console'
                        : user.role === 'seller'
                        ? 'Seller Dashboard'
                        : 'My Account & Orders'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      className="py-1.5 px-3 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to={customerAuthPath('login', returnTo)}
                    onClick={() => { prepareCustomerAuth(); setMobileMenuOpen(false); }}
                    className="flex-1 py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-extrabold text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to={customerAuthPath('register', returnTo)}
                    onClick={() => { prepareCustomerAuth(); setMobileMenuOpen(false); }}
                    className="flex-1 py-2 px-3 rounded-lg border border-slate-300 text-slate-800 text-xs font-bold text-center hover:bg-slate-100"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            <div className="p-4 space-y-1 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Shop By Department
              </div>
              {[
                { label: 'Sri Lankan Homemade & Spices', to: '/products?category=homemade-pantry' },
                { label: 'Electronics & Tech Accessories', to: '/products?category=electronics' },
                { label: 'Home, Kitchen & Clay Cookware', to: '/products?category=home-kitchen' },
                { label: 'Fashion, Batik & Handloom', to: '/products?category=fashion-handloom' },
                { label: 'Ayurveda, Hair & Skincare', to: '/products?category=ayurveda-beauty' },
                { label: 'Fitness & Everyday Value Deals', to: '/products?category=fitness-daily-deals' }
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              ))}

              <div className="border-t border-slate-200 my-3 pt-3 text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Marketplace Tools
              </div>
              <Link
                to="/track-order"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <Package className="w-4 h-4 text-slate-600" />
                Track Your Order
              </Link>
              <Link
                to="/seller/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <Store className="w-4 h-4 text-slate-600" />
                Become a Yaans.lk Seller
              </Link>
              {user?.role === 'seller' && (
                <Link
                  to="/seller/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-900 bg-amber-50 border border-amber-200"
                >
                  <Store className="w-4 h-4 text-amber-700" />
                  Open Seller Portal
                </Link>
              )}
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-900 bg-sky-50 border border-sky-200"
                >
                  <ShieldCheck className="w-4 h-4 text-sky-700" />
                  Open Admin Dashboard
                </Link>
              )}

              <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <Link
                  to="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-slate-900 underline"
                >
                  Terms
                </Link>
                <Link
                  to="/privacy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-slate-900 underline"
                >
                  Privacy (PDPA)
                </Link>
                <Link
                  to="/cookies"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-slate-900 underline"
                >
                  Cookies
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sri Lankan 25-District Delivery Selector Modal */}
      {districtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-800" />
                <h3 className="font-bold text-base text-slate-900">
                  Choose Your Delivery District
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDistrictModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-2.5 mb-3">
              Delivery fees and estimated courier times are calculated automatically based on each seller&apos;s origin district and your selected Sri Lankan district.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
              {DEFAULT_SL_DISTRICTS.map((dist) => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => {
                    setSelectedDistrict(dist);
                    setDistrictModalOpen(false);
                  }}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium text-left border transition ${
                    selectedDistrict === dist
                      ? 'bg-slate-900 text-white border-slate-900 font-bold'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dist}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar for One-Handed Shopping */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex md:hidden items-center justify-around py-1.5 text-[11px] font-medium text-slate-600 shadow-lg">
        <Link
          to="/"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 ${
            location.pathname === '/' ? 'text-slate-950 font-bold' : ''
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>
        <Link
          to="/products"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 ${
            location.pathname === '/products' && !location.search.includes('homemade')
              ? 'text-slate-950 font-bold'
              : ''
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span>Browse</span>
        </Link>
        <Link
          to="/products?homemade=true"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 ${
            location.search.includes('homemade=true') ? 'text-emerald-700 font-bold' : ''
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>Homemade</span>
        </Link>
        <Link
          to="/track-order"
          className={`flex flex-col items-center gap-0.5 px-2 py-1 ${
            location.pathname === '/track-order' ? 'text-slate-950 font-bold' : ''
          }`}
        >
          <Package className="w-5 h-5" />
          <span>Track</span>
        </Link>
        <Link
          to="/cart"
          className={`relative flex flex-col items-center gap-0.5 px-2 py-1 ${
            location.pathname === '/cart' ? 'text-slate-950 font-bold' : ''
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          {totalCartItems > 0 && (
            <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
              {totalCartItems}
            </span>
          )}
          <span>Cart</span>
        </Link>
      </nav>
    </>
  );
}
