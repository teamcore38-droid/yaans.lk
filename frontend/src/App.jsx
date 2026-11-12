import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import CookieNotice from './components/CookieNotice.jsx';
import NavigationPrefetch from './components/NavigationPrefetch.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { pageLoaders } from './utils/navigation.js';

const HomePage = lazy(pageLoaders.home);
const ProductsPage = lazy(pageLoaders.products);
const ProductDetailPage = lazy(pageLoaders.product);
const CartPage = lazy(pageLoaders.cart);
const CheckoutPage = lazy(pageLoaders.checkout);
const TrackOrderPage = lazy(pageLoaders.tracking);
const SellerStorefrontPage = lazy(pageLoaders.store);
const SellerDashboardPage = lazy(pageLoaders.seller);
const AdminDashboardPage = lazy(pageLoaders.admin);
const StaffDashboardPage = lazy(pageLoaders.staff);
const StaffLoginPage = lazy(pageLoaders.staffLogin);
const AdminLoginPage = lazy(pageLoaders.adminLogin);
const PrivacyPolicyPage = lazy(pageLoaders.privacy);
const TermsConditionsPage = lazy(pageLoaders.terms);
const CookiePolicyPage = lazy(pageLoaders.cookies);

const LoginPage = lazy(() =>
  pageLoaders.account().then((m) => ({ default: m.LoginPage }))
);
const RegisterCustomerPage = lazy(() =>
  pageLoaders.account().then((m) => ({ default: m.RegisterCustomerPage }))
);
const SellerRegisterPage = lazy(() =>
  pageLoaders.account().then((m) => ({ default: m.SellerRegisterPage }))
);
const CustomerAccountPage = lazy(() =>
  pageLoaders.account().then((m) => ({ default: m.CustomerAccountPage }))
);
const WishlistPage = lazy(() =>
  pageLoaders.account().then((m) => ({ default: m.WishlistPage }))
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
        <NavigationPrefetch />
        <div className="min-h-screen flex flex-col bg-[#F3F4F6] text-slate-900">
          {import.meta.env.VITE_APP_ENV === 'staging' && <div role="status" className="bg-amber-200 text-slate-950 text-center px-4 py-2 font-bold">Test environment — synthetic orders and payments only</div>}
          <Navbar />
          <main className="flex-1">
            <ErrorBoundary>
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
                  <Route
                    path="/seller/dashboard"
                    element={
                      <ErrorBoundary title="Unable to load Seller Portal">
                        <SellerDashboardPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route path="/staff/login" element={<StaffLoginPage />} />
                  <Route path="/staff" element={<StaffDashboardPage />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route
                    path="/admin"
                    element={
                      <ErrorBoundary title="Unable to load Admin Console">
                        <AdminDashboardPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route path="/account" element={<CustomerAccountPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsConditionsPage />} />
                  <Route path="/terms-and-conditions" element={<TermsConditionsPage />} />
                  <Route path="/cookies" element={<CookiePolicyPage />} />
                  <Route path="/cookies-policy" element={<CookiePolicyPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
          <Footer />
          <CookieNotice />
          <ToastBanner />
        </div>
      </BrowserRouter>
    </MarketplaceProvider>
  );
}
