import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest, getCachedApiResponse } from '../utils/api.js';

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
      return saved ? JSON.parse(saved) : [];
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

  const [cartQuote, setCartQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [categories, setCategories] = useState(() =>
    getCachedApiResponse('/marketplace/categories')?.categories ||
    getCachedApiResponse('/marketplace/home')?.categories || []
  );

  const fetchCategories = useCallback(async (force = true) => {
    try {
      const endpoint = !force && window.location.pathname === '/' ? '/marketplace/home' : '/marketplace/categories';
      const res = await apiRequest(endpoint, force ? { cache: 'reload' } : {});
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

  // Sync user session on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('yaans_token');
    if (token) {
      apiRequest('/auth/me')
        .then((res) => {
          setUser(res.user);
          localStorage.setItem('yaans_user', JSON.stringify(res.user));
          if (res.user.defaultDistrict && !localStorage.getItem('yaans_district')) {
            setSelectedDistrict(res.user.defaultDistrict);
          }
        })
        .catch((error) => {
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

  // Fetch multi-seller shipping & subtotal breakdown whenever cartItems or selectedDistrict changes
  useEffect(() => {
    if (cartItems.length === 0) {
      setCartQuote(null);
      setQuoteLoading(false);
      return;
    }
    let active = true;
    setQuoteLoading(true);
    apiRequest('/orders/quote', {
      method: 'POST',
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
        if (active) setCartQuote(quote);
      })
      .catch(() => {
        // Ignore transient quote error
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cartItems, selectedDistrict]);

  const login = async (email, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('yaans_token', res.token);
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    setUser(res.user);
    if (res.user.defaultDistrict) {
      setSelectedDistrict(res.user.defaultDistrict);
    }
    showToast(`Welcome back, ${res.user.name}!`);
    return res.user;
  };

  const registerCustomer = async (payload) => {
    const res = await apiRequest('/auth/register-customer', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    localStorage.setItem('yaans_token', res.token);
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    setUser(res.user);
    if (res.user.defaultDistrict) {
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
    localStorage.setItem('yaans_token', res.token);
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    setUser(res.user);
    showToast('Seller application submitted for Admin review!');
    return res;
  };

  const logout = () => {
    localStorage.removeItem('yaans_token');
    localStorage.removeItem('yaans_user');
    setUser(null);
    showToast('Signed out of Yaans.lk', 'info');
  };

  const refreshUser = async () => {
    const res = await apiRequest('/auth/me');
    setUser(res.user);
    localStorage.setItem('yaans_user', JSON.stringify(res.user));
    return res.user;
  };

  const addToCart = (product, variantLabel = null, quantity = 1) => {
    const chosenVariant =
      variantLabel ||
      product.variants?.[0]?.values?.[0]?.label ||
      'Standard';

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
          quantity: updated[existingIdx].quantity + quantity
        };
        return updated;
      }
      return [
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
      ];
    });
    showToast(`Added "${product.title.slice(0, 36)}..." to cart`);
  };

  const updateCartQuantity = (productId, variantLabel, newQty) => {
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
    setCartQuote(null);
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
        login,
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
