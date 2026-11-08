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

export default function Navbar() {
  const {
    user,
    logout,
    login,
    selectedDistrict,
    setSelectedDistrict,
    totalCartItems,
    wishlistIds
  } = useMarketplace();

  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCat, setSearchCat] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [districtModalOpen, setDistrictModalOpen] = useState(false);
  const [quickDemoLoading, setQuickDemoLoading] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (searchCat) params.set('category', searchCat);
    navigate(`/products?${params.toString()}`);
    setMobileMenuOpen(false);
  };

  const handleQuickDemoSwitch = async (email, password, redirectPath) => {
    try {
      setQuickDemoLoading(true);
      await login(email, password);
      navigate(redirectPath);
    } catch (_err) {
      // ignore
    } finally {
      setQuickDemoLoading(false);
    }
  };

  return (
    <>
      {/* Top Utility Bar: Practical Sri Lankan Marketplace Info & Quick Role Access */}
      <div className="bg-[#482c39] text-[#eddfe6] text-xs border-b border-[#3a212d]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="inline-flex items-center gap-1 font-medium text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Islandwide Delivery (25 Districts)
            </span>
            <span className="text-[#6d4659] hidden sm:inline">|</span>
            <span className="hidden sm:inline text-[#e6d0db]">
              Cash on Delivery (COD) Available • Prices in LKR (Rs.)
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
            {/* Quick Role Switcher for Instant Demo Testing */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#38202c]/90 px-2 py-0.5 rounded border border-[#583346]">
              <span className="text-[11px] text-[#caa8b8]">Quick Demo:</span>
              <button
                type="button"
                disabled={quickDemoLoading}
                onClick={() => handleQuickDemoSwitch('kasun@gmail.com', 'Customer@123', '/')}
                className="text-[11px] px-1.5 py-0.5 rounded hover:bg-[#4d2c3e] text-[#eddfe6] font-medium"
              >
                Customer
              </button>
              <button
                type="button"
                disabled={quickDemoLoading}
                onClick={() => handleQuickDemoSwitch('kumari@kandykitchen.lk', 'Seller@123', '/seller/dashboard')}
                className="text-[11px] px-1.5 py-0.5 rounded hover:bg-[#4d2c3e] text-amber-300 font-medium"
              >
                Seller (Kandy)
              </button>
              <button
                type="button"
                disabled={quickDemoLoading}
                onClick={() => handleQuickDemoSwitch('admin@yaans.lk', 'Admin@123', '/admin')}
                className="text-[11px] px-1.5 py-0.5 rounded hover:bg-[#4d2c3e] text-sky-300 font-medium"
              >
                Admin
              </button>
            </div>

            <Link to="/track-order" className="text-[#eddfe6] hover:text-white transition-colors font-medium">
              Track Order
            </Link>
            <span className="text-[#6d4659]">|</span>
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
                <option value="homemade-pantry">Homemade & Spices</option>
                <option value="electronics">Electronics</option>
                <option value="home-kitchen">Home & Kitchen</option>
                <option value="fashion-handloom">Fashion & Handloom</option>
                <option value="ayurveda-beauty">Ayurveda & Beauty</option>
                <option value="fitness-daily-deals">Fitness & Deals</option>
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
                    to="/account"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800"
                  >
                    <User className="w-5 h-5 text-slate-700" />
                    <div className="hidden xl:block text-left leading-tight">
                      <div className="text-[10px] text-slate-500">Hello, {user.name.split(' ')[0]}</div>
                      <div className="text-xs font-bold text-slate-900">Account & Orders</div>
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
                  to="/login"
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
        <div className="bg-[#72495c] border-t border-[#603b4d] border-b border-[#603b4d]">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-3 py-1.5 overflow-x-auto no-scrollbar text-xs font-medium text-[#fff0f5] whitespace-nowrap">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setDistrictModalOpen(true)}
                className="inline-flex lg:hidden items-center gap-1 text-white font-semibold bg-[#5c3748] px-2 py-1 rounded border border-[#85586d]"
              >
                <MapPin className="w-3.5 h-3.5 text-white" />
                Deliver to {selectedDistrict} ▾
              </button>

              <Link to="/products" className="hover:text-white font-semibold flex items-center gap-1 bg-[#5c3748] hover:bg-[#502e3e] text-white px-2.5 py-1 rounded-md transition-colors">
                All Products
              </Link>
              <Link
                to="/products?homemade=true"
                className="hover:text-white font-semibold text-[#fff0f5] hover:bg-[#85586d]/40 px-2 py-0.5 rounded transition-colors"
              >
                Homemade Sri Lanka
              </Link>
              <Link
                to="/products?deals=true"
                className="hover:bg-amber-400 font-bold text-slate-950 bg-amber-300 px-3 py-1 rounded-full shadow-xs transition-colors"
              >
                Today&apos;s Deals
              </Link>
              <Link to="/products?category=homemade-pantry" className="text-[#fce7f0] hover:text-white transition-colors">
                Spices & Pantry
              </Link>
              <Link to="/products?category=electronics" className="text-[#fce7f0] hover:text-white transition-colors">
                Electronics
              </Link>
              <Link to="/products?category=home-kitchen" className="text-[#fce7f0] hover:text-white transition-colors">
                Home & Kitchen
              </Link>
              <Link to="/products?category=fashion-handloom" className="text-[#fce7f0] hover:text-white transition-colors">
                Fashion & Handloom
              </Link>
              <Link to="/products?category=ayurveda-beauty" className="text-[#fce7f0] hover:text-white transition-colors">
                Ayurveda & Beauty
              </Link>
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
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Instant Demo Role Switcher
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleQuickDemoSwitch('kasun@gmail.com', 'Customer@123', '/');
                  }}
                  className="px-2 py-1.5 text-xs font-semibold rounded bg-white border border-slate-300 text-slate-800"
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleQuickDemoSwitch('kumari@kandykitchen.lk', 'Seller@123', '/seller/dashboard');
                  }}
                  className="px-2 py-1.5 text-xs font-semibold rounded bg-amber-50 border border-amber-300 text-amber-900"
                >
                  Seller
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleQuickDemoSwitch('admin@yaans.lk', 'Admin@123', '/admin');
                  }}
                  className="px-2 py-1.5 text-xs font-semibold rounded bg-sky-50 border border-sky-300 text-sky-900"
                >
                  Admin
                </button>
              </div>
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
