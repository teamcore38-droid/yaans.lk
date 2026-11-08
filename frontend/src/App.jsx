import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import HomePage from './pages/HomePage.jsx';

const ProductsPage = lazy(() => import('./pages/ProductsPage.jsx'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage.jsx'));
const CartPage = lazy(() => import('./pages/CartPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'));
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage.jsx'));
const SellerStorefrontPage = lazy(() => import('./pages/SellerStorefrontPage.jsx'));
const SellerDashboardPage = lazy(() => import('./pages/SellerDashboardPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage.jsx'));

const LoginPage = lazy(() =>
  import('./pages/AuthAccountPages.jsx').then((m) => ({ default: m.LoginPage }))
);
const RegisterCustomerPage = lazy(() =>
  import('./pages/AuthAccountPages.jsx').then((m) => ({ default: m.RegisterCustomerPage }))
);
const SellerRegisterPage = lazy(() =>
  import('./pages/AuthAccountPages.jsx').then((m) => ({ default: m.SellerRegisterPage }))
);
const CustomerAccountPage = lazy(() =>
  import('./pages/AuthAccountPages.jsx').then((m) => ({ default: m.CustomerAccountPage }))
);
const WishlistPage = lazy(() =>
  import('./pages/AuthAccountPages.jsx').then((m) => ({ default: m.WishlistPage }))
);

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

function ToastBanner() {
  const { toast } = useMarketplace();
  if (!toast) return null;
  return (
    <div className="fixed bottom-16 md:bottom-5 right-4 z-50 max-w-sm bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-semibold flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full ${
          toast.type === 'error' ? 'bg-red-400' : 'bg-emerald-400'
        }`}
      />
      <span>{toast.message}</span>
    </div>
  );
}

export default function App() {
  return (
    <MarketplaceProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col bg-[#F3F4F6] text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Suspense
              fallback={
                <div className="max-w-7xl mx-auto px-4 py-8">
                  <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/product/:idOrSlug" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/track-order" element={<TrackOrderPage />} />
                <Route path="/store/:slugOrId" element={<SellerStorefrontPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterCustomerPage />} />
                <Route path="/seller/register" element={<SellerRegisterPage />} />
                <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/account" element={<CustomerAccountPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <ToastBanner />
        </div>
      </BrowserRouter>
    </MarketplaceProvider>
  );
}
