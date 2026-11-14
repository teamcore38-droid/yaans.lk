import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest, getCachedApiResponse, browserSessionKey, invalidateCatalogCache } from '../utils/api.js';
import { bindCheckoutDraft, clearCheckoutDraft } from '../utils/checkoutDraft.js';
import { normalizeSavedCart } from '../utils/cart.js';

const MarketplaceContext = createContext(null);

export const DEFAULT_SL_DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
  'Monaragala', 'Ratnapura', 'Kegalle'
];

export function MarketplaceProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      if(!browserSessionKey())return null;
      const saved = localStorage.getItem('yaans_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedDistrict, setSelectedDistrictState] = useState(() => {
    return localStorage.getItem('yaans_district') || 'Colombo';
  });

  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('yaans_cart');
      return normalizeSavedCart(saved ? JSON.parse(saved) : []);
    } catch {
      return [];
    }
  });

  const [guestWishlist, setGuestWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('yaans_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [quoteState, setQuoteState] = useState(null);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const quoteMatches = quoteState?.items === cartItems && quoteState?.district === selectedDistrict && quoteState?.version === quoteVersion;
  const cartQuote = cartItems.length > 0 && quoteMatches ? quoteState.quote : null;
  const quoteError = cartItems.length > 0 && quoteMatches ? quoteState.error : null;
  const quoteLoading = cartItems.length > 0 && (!quoteMatches || quoteState.loading);
  const retryCartQuote = useCallback(() => setQuoteVersion((version) => version + 1), []);
  const [toast, setToast] = useState(null);
  const [businessConfig, setBusinessConfig] = useState({});
  const [categories, setCategories] = useState(() =>
    getCachedApiResponse('/marketplace/categories')?.categories ||
    getCachedApiResponse('/marketplace/home')?.categories || []
  );

  const fetchCategories = useCallback(async (force = true) => {
    try {
      const endpoint = !force && window.location.pathname === '/' ? '/marketplace/home' : '/marketplace/categories';
      const res = await apiRequest(endpoint, force ? { cache: 'reload' } : {});
      if (res.businessSettings) setBusinessConfig({ businessSettings: res.businessSettings, businessVersion: res.businessVersion || 0, businessEffectiveAt: res.businessEffectiveAt, codEnabledGlobally: res.codEnabledGlobally, commissionRates: res.commissionRates });
      if (res.categories) {
        setCategories(res.categories);
      }
    } catch (_err) {
      // fallback
    }
  }, []);

  useEffect(() => {
    fetchCategories(false);
  }, [fetchCategories]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev && Date.now() - prev.id >= 2900 ? null : prev));
    }, 3000);
  }, []);

  const setSelectedDistrict = useCallback((district) => {
    setSelectedDistrictState(district);
    localStorage.setItem('yaans_district', district);
  }, []);

  // Restore the HttpOnly session; discard bearer tokens left by older releases.
  useEffect(() => {
    localStorage.removeItem('yaans_token');
    const initialSession=browserSessionKey();
    if (initialSession) {
      apiRequest('/auth/me')
        .then((res) => {
          if(browserSessionKey()!==initialSession)return;
          bindCheckoutDraft(res.user);
          setUser(res.user);
          localStorage.setItem('yaans_user', JSON.stringify(res.user));
          if (res.user.defaultDistrict && !localStorage.getItem('yaans_district')) {
            setSelectedDistrict(res.user.defaultDistrict);
          }
        })
        .catch((error) => {
          if(browserSessionKey()!==initialSession)return;
          if (error.status !== 401 && error.status !== 403) return;
          localStorage.removeItem('yaans_token');
          localStorage.removeItem('yaans_user');
          setUser(null);
        });
    }
  }, [setSelectedDistrict]);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('yaans_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    const syncCart = (event) => {
      if (event.storageArea !== localStorage || (event.key !== 'yaans_cart' && event.key !== null)) return;
      let next;
      try { next = normalizeSavedCart(JSON.parse(event.newValue)); } catch { next = []; }
      setCartItems((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    window.addEventListener('storage', syncCart);
    return () => window.removeEventListener('storage', syncCart);
  }, []);

  // Fetch multi-seller shipping & subtotal breakdown whenever cartItems or selectedDistrict changes
  useEffect(() => {
    if (cartItems.length === 0) {
      setQuoteState(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const snapshot = { items: cartItems, district: selectedDistrict, version: quoteVersion };
    setQuoteState({ ...snapshot, quote: null, error: null, loading: true });
    apiRequest('/orders/quote', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        items: cartItems.map((c) => ({
          productId: c.productId,
          variantLabel: c.variantLabel,
          quantity: c.quantity
        })),
        destinationDistrict: selectedDistrict
      })
    })
      .then((quote) => {
        if (active) setQuoteState({ ...snapshot, quote, error: null, loading: false });
      })
      .catch((error) => {
        if (active) setQuoteState({ ...snapshot, quote: null, error: error.message || 'Unable to check your cart. Please retry.', loading: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [cartItems, selectedDistrict, quoteVersion]);

  const login = async (email, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    bindCheckoutDraft(res.user);
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    setUser(res.user);
    if (res.user.defaultDistrict && !localStorage.getItem('yaans_district')) {
      setSelectedDistrict(res.user.defaultDistrict);
    }
    showToast(`Welcome back, ${res.user.name}!`);
    return res.user;
  };

  const adminLogin = async (email, password, challengeToken, code) => {
    const res = await apiRequest(challengeToken?'/auth/admin/mfa/login':'/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(challengeToken?{challengeToken,code}:{ email, password })
    });
    if(res.requiresMfa)return res;
    clearCheckoutDraft();
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    setUser(res.user);
    showToast(`Signed in to Admin Console as ${res.user.name}`);
    return res;
  };

  const clearSession = useCallback(() => {
    clearCheckoutDraft();
    localStorage.removeItem('yaans_user'); localStorage.removeItem('yaans_token');
    invalidateCatalogCache(); setUser(null);
  }, []);
  const staffLogin = async (email, password) => {
    const res = await apiRequest('/auth/staff/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    clearCheckoutDraft();
    localStorage.setItem('yaans_user', JSON.stringify(res.user)); setUser(res.user);
    return res.user;
  };

  const registerCustomer = async (payload) => {
    const res = await apiRequest('/auth/register-customer', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    bindCheckoutDraft(res.user);
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    setUser(res.user);
    if (res.user.defaultDistrict && !localStorage.getItem('yaans_district')) {
      setSelectedDistrict(res.user.defaultDistrict);
    }
    showToast('Customer account created successfully!');
    return res.user;
  };

  const registerSeller = async (payload) => {
    const res = await apiRequest('/auth/register-seller', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    clearCheckoutDraft();
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    setUser(res.user);
    showToast('Seller application submitted for Admin review!');
    return res;
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout',{method:'POST',body:'{}'});
      clearCheckoutDraft();
      localStorage.removeItem('yaans_token');localStorage.removeItem('yaans_user');
      invalidateCatalogCache();setUser(null);
      showToast('Signed out on all devices', 'info');return true;
    }catch(error){showToast(error.message||'Could not sign out. Please retry.','error');return false;}
  };

  const refreshUser = async () => {
    const res = await apiRequest('/auth/me');
    bindCheckoutDraft(res.user);
    setUser(res.user);
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    return res.user;
  };

  const addToCart = (product, variantLabel = null, quantity = 1) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      showToast('Choose a quantity between 1 and 99.', 'error');
      return;
    }
    const chosenVariant =
      variantLabel ||
      product.variants?.[0]?.values?.[0]?.label ||
      'Standard';

    const existing = cartItems.find((item) => item.productId === product._id && item.variantLabel === chosenVariant);
    if (!existing && cartItems.length >= 50) {
      showToast('Your cart can contain up to 50 product selections. Remove an item before adding another.', 'error');
      return;
    }
    if (existing && existing.quantity + quantity > 99) {
      showToast('The quantity for a product selection cannot exceed 99.', 'error');
      return;
    }

    let unitPriceLkr = product.priceLkr;
    if (product.variants?.length > 0) {
      for (const vg of product.variants) {
        const found = (vg.values || []).find((v) => v.label === chosenVariant);
        if (found?.priceLkr) unitPriceLkr = found.priceLkr;
      }
    }

    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === product._id && item.variantLabel === chosenVariant
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: Math.min(99, updated[existingIdx].quantity + quantity)
        };
        return updated;
      }
      return normalizeSavedCart([
        ...prev,
        {
          productId: product._id,
          title: product.title,
          slug: product.slug,
          image: product.images?.[0] || '',
          unitPriceLkr,
          variantLabel: chosenVariant,
          quantity,
          sellerId: product.sellerId,
          sellerName: product.sellerName,
          sellerDistrict: product.sellerDistrict,
          isHomemade: product.isHomemade
        }
      ]);
    });
    showToast(`Added "${product.title.slice(0, 36)}..." to cart`);
  };

  const updateCartQuantity = (productId, variantLabel, newQty) => {
    if (!Number.isSafeInteger(newQty) || newQty > 99) return;
    if (newQty <= 0) {
      removeFromCart(productId, variantLabel);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId && item.variantLabel === variantLabel
          ? { ...item, quantity: newQty }
          : item
      )
    );
  };

  const removeFromCart = (productId, variantLabel) => {
    setCartItems((prev) =>
      prev.filter(
        (item) => !(item.productId === productId && item.variantLabel === variantLabel)
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const wishlistIds = user ? user.wishlist || [] : guestWishlist;

  const toggleWishlist = async (productId) => {
    if (user) {
      try {
        const res = await apiRequest('/auth/wishlist/toggle', {
          method: 'POST',
          body: JSON.stringify({ productId })
        });
        const updated = { ...user, wishlist: res.wishlist };
        setUser(updated);
        localStorage.setItem('yaans_user', JSON.stringify(updated));
        showToast(
          res.wishlist.includes(productId) ? 'Saved to your Wishlist' : 'Removed from Wishlist'
        );
      } catch (err) {
        showToast(err.message, 'error');
      }
    } else {
      setGuestWishlist((prev) => {
        const exists = prev.includes(productId);
        const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
        localStorage.setItem('yaans_wishlist', JSON.stringify(next));
        showToast(exists ? 'Removed from Wishlist' : 'Saved to Wishlist');
        return next;
      });
    }
  };

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <MarketplaceContext.Provider
      value={{
        user,
        businessConfig,
        login,
        adminLogin,
        staffLogin,
        clearSession,
        registerCustomer,
        registerSeller,
        logout,
        refreshUser,
        selectedDistrict,
        setSelectedDistrict,
        cartItems,
        totalCartItems,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartQuote,
        quoteLoading,
        quoteError,
        retryCartQuote,
        wishlistIds,
        toggleWishlist,
        toast,
        showToast,
        categories,
        refreshCategories: fetchCategories
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error('useMarketplace must be used inside MarketplaceProvider');
  return ctx;
}

// Public presentation widgets can render with defaults outside an authenticated workspace.
export function useBusinessConfiguration() { return useContext(MarketplaceContext)?.businessConfig || {}; }
