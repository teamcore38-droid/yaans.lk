import { apiRequest } from './api.js';

export const pageLoaders = {
  home: () => import('../pages/HomePage.jsx'),
  products: () => import('../pages/ProductsPage.jsx'),
  product: () => import('../pages/ProductDetailPage.jsx'),
  cart: () => import('../pages/CartPage.jsx'),
  checkout: () => import('../pages/CheckoutPage.jsx'),
  tracking: () => import('../pages/TrackOrderPage.jsx'),
  store: () => import('../pages/SellerStorefrontPage.jsx'),
  seller: () => import('../pages/SellerDashboardPage.jsx'),
  admin: () => import('../pages/AdminDashboardPage.jsx'),
  account: () => import('../pages/AuthAccountPages.jsx'),
  privacy: () => import('../pages/PrivacyPolicyPage.jsx'),
  terms: () => import('../pages/TermsConditionsPage.jsx'),
  cookies: () => import('../pages/CookiePolicyPage.jsx')
};

export function productsEndpoint(search) {
  const params = new URLSearchParams(search);
  params.set('page', '1');
  params.set('limit', '12');
  params.sort();
  return `/marketplace/products?${params}`;
}

export function prefetchPage(href) {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return;
  const { pathname, search } = url;
  let page;
  let endpoint;
  if (pathname === '/') {
    page = 'home';
    endpoint = '/marketplace/home';
  } else if (pathname === '/products') {
    page = 'products';
    endpoint = productsEndpoint(search);
  } else if (/^\/product\/[^/]+$/.test(pathname)) {
    page = 'product';
    const district = localStorage.getItem('yaans_district') || 'Colombo';
    endpoint = `/marketplace/products/${pathname.split('/')[2]}?destinationDistrict=${encodeURIComponent(district)}`;
  } else if (/^\/store\/[^/]+$/.test(pathname)) {
    page = 'store';
    endpoint = `/marketplace/sellers/${pathname.split('/')[2]}`;
  } else {
    page = {
      '/cart': 'cart', '/checkout': 'checkout', '/track-order': 'tracking',
      '/seller/dashboard': 'seller', '/admin': 'admin', '/login': 'account',
      '/register': 'account', '/seller/register': 'account', '/account': 'account', '/wishlist': 'account',
      '/privacy': 'privacy', '/privacy-policy': 'privacy',
      '/terms': 'terms', '/terms-and-conditions': 'terms',
      '/cookies': 'cookies', '/cookies-policy': 'cookies'
    }[pathname];
  }
  if (page) pageLoaders[page]().catch(() => {});
  if (endpoint) apiRequest(endpoint).catch(() => {});
}
