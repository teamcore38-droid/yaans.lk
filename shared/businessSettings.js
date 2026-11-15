export const DEFAULT_BUSINESS_SETTINGS = {
  "identity": {
    "name": "Yaans.lk",
    "description": "Sri Lanka's multi-vendor marketplace connecting local sellers and shoppers.",
    "logo": "/brand/yaans-logo-horizontal-dark.png",
    "supportEmail": "support@yaans.lk",
    "privacyEmail": "privacy@yaans.lk",
    "operatingAddress": "Colombo, Western Province, Sri Lanka",
    "privacyOfficer": "Compliance & Legal Operations",
    "supportPhone": "",
    "whatsapp": ""
  },
  "announcements": {
    "enabled": true,
    "text": "Islandwide Delivery (25 Districts)",
    "startAt": "",
    "endAt": "",
    "href": "/products"
  },
  "navigation": {
    "mobileLinks": [
      {
        "label": "Homemade products",
        "href": "/products?homemade=true"
      },
      {
        "label": "Electronics",
        "href": "/products?category=electronics"
      },
      {
        "label": "Home & kitchen",
        "href": "/products?category=home-kitchen"
      }
    ],
    "footerLinks": [
      {
        "label": "Homemade products",
        "href": "/products?homemade=true"
      },
      {
        "label": "Electronics",
        "href": "/products?category=electronics"
      },
      {
        "label": "Home & kitchen",
        "href": "/products?category=home-kitchen"
      }
    ]
  },
  "trust": {
    "homemadeLabel": "Authentic Sri Lankan Homemade",
    "marketplaceTitle": "Verified Marketplace",
    "marketplaceDescription": "Moderated sellers and private order tracking",
    "localTitle": "Direct from Local Sellers",
    "localDescription": "Home kitchens, artisans and retail stores"
  },
  "delivery": {
    "sameDistrictDays": "",
    "surchargeAfterItems": 3,
    "surchargePerItemLkr": 40,
    "defaultFreeShippingLkr": 5000,
    "defaultIntraDistrictFeeLkr": 280,
    "defaultPreparationDays": 0,
    "maxPreparationDays": 30,
    "maxSellerFreeShippingLkr": 1000000,
    "maxSellerIntraDistrictFeeLkr": 10000,
    "vacationMessage": "This store is taking a break. New orders are paused until the seller returns."
  },
  "returns": {
    "enabled": true,
    "days": 7,
    "refundMinDays": 3,
    "refundMaxDays": 7,
    "cancelStatuses": [
      "pending_confirmation",
      "confirmed",
      "packed"
    ],
    "cancelReasons": [
      "Ordered by mistake",
      "Delivery details need changing",
      "Other"
    ],
    "returnReasons": [
      "Damaged or defective item",
      "Incorrect item",
      "Item differs from description",
      "Other"
    ],
    "categoryOverrides": [],
    "productOverrides": []
  },
  "pricing": {
    "taxMessage": "No additional tax is added at checkout.",
    "maxQuantityPerSelection": 99,
    "maxCartSelections": 50
  },
  "references": {
    "banks": [
      "Bank of Ceylon (BOC)",
      "Sampath Bank",
      "Commercial Bank of Ceylon",
      "Hatton National Bank (HNB)",
      "Peoples Bank",
      "Nations Trust Bank"
    ],
    "sellerTypes": [
      {
        "name": "Homemade & Cottage",
        "homemade": true,
        "active": true,
        "commissionPercent": null
      },
      {
        "name": "Artisan & Craft",
        "homemade": true,
        "active": true,
        "commissionPercent": null
      },
      {
        "name": "Small Business",
        "homemade": false,
        "active": true,
        "commissionPercent": null
      },
      {
        "name": "Verified Retail Vendor",
        "homemade": false,
        "active": true,
        "commissionPercent": null
      }
    ],
    "couriers": [
      {
        "name": "Prompt Xpress",
        "trackingUrl": "",
        "active": true
      },
      {
        "name": "Domex",
        "trackingUrl": "",
        "active": true
      },
      {
        "name": "Koombiyo",
        "trackingUrl": "",
        "active": true
      },
      {
        "name": "Pronto",
        "trackingUrl": "",
        "active": true
      },
      {
        "name": "Sri Lanka Post",
        "trackingUrl": "",
        "active": true
      }
    ]
  },
  "home": {
    "autoplay": true,
    "intervalMs": 4500,
    "categories": {
      "enabled": true,
      "title": "Explore Categories",
      "mobileTitle": "Explore Categories",
      "subtitle": "Tap any department or subcategory tile to filter products",
      "limit": 12,
      "position": 1
    },
    "homemade": {
      "source": "homemade",
      "enabled": true,
      "title": "Sri Lankan Homemade & Cottage Products",
      "mobileTitle": "Homemade & Cottage",
      "subtitle": "Direct from home kitchens and artisans",
      "limit": 8,
      "position": 2
    },
    "deals": {
      "source": "deals",
      "enabled": true,
      "title": "Today\u2019s Value Deals in LKR (Rs.)",
      "mobileTitle": "Today\u2019s Deals",
      "subtitle": "Current discounts from local sellers",
      "limit": 4,
      "position": 3
    },
    "sellers": {
      "enabled": true,
      "title": "Shop by Verified Sri Lankan Sellers",
      "mobileTitle": "Shop Local Sellers",
      "subtitle": "Discover approved local stores",
      "limit": 12,
      "position": 4
    },
    "recommended": {
      "source": "popular",
      "enabled": true,
      "title": "Recommended for You",
      "mobileTitle": "Recommended for You",
      "subtitle": "Popular picks from our marketplace",
      "limit": 10,
      "position": 5
    }
  },
  "catalog": {
    "priceBands": [
      1500,
      2500,
      5000,
      10000
    ]
  },
  "notifications": {
    "newOrderText": "New order received",
    "viewOrderText": "View orders and mark as read"
  },
  "legal": {
    "terms": "",
    "privacy": "",
    "cookies": "",
    "cookieNotice": "We use essential cookies and local storage to keep your session, cart and preferences working.",
    "privacyResponseDays": 14
  }
};
export function businessSettings(config = {}) {
  const saved = config.businessSettings || {};
  const merge = (defaults, value) => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
    fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? merge(fallback, value?.[key] || {}) : value?.[key] ?? fallback]));
  return merge(DEFAULT_BUSINESS_SETTINGS, saved);
}
export function activePublication(config = {}) {
  return { version: config.businessVersion || 0, settings: businessSettings(config), effectiveAt: config.businessEffectiveAt || null };
}
export function returnPolicy(settings, product) {
  const rule = settings.returns.productOverrides.find(rule => rule.id === String(product._id)) || settings.returns.categoryOverrides.find(rule => rule.slug === product.categorySlug);
  return { enabled: settings.returns.enabled && (rule?.eligible ?? true), days: rule?.days ?? settings.returns.days };
}
export function sellerCommission(config, sellerType) {
  const type = (config.businessSettings?.references || businessSettings(config).references).sellerTypes.find(type => type.name === sellerType);
  return type?.commissionPercent ?? (type?.homemade ? config.homemadeCommissionPercent ?? 5 : config.defaultCommissionPercent ?? 8);
}
