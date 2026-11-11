import bcrypt from 'bcryptjs';
import { getInitialSeedState } from '../../backend/src/seed/initialState.js';

// Synthetic accounts only. Never copy a developer or production database into tests.
export const TEST_PASSWORD = 'Testing@123';
export const accounts = {
  admin: 'admin@test.yaans.invalid',
  customer: 'customer@test.yaans.invalid',
  seller: 'seller@test.yaans.invalid',
  otherSeller: 'other-seller@test.yaans.invalid'
};

export const shippingAddress = {
  recipientName: 'Test Customer', phone: '0771234567',
  addressLine1: '42 Test Street', city: 'Colombo', district: 'Colombo'
};

export function buildTestStore() {
  const seed = getInitialSeedState();
  const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 4);
  const createdAt = '2026-01-01T00:00:00.000Z';
  const user = (id, name, email, role, sellerId = null) => ({
    _id: id, name, email, role, sellerId, passwordHash, phone: '0771234567',
    defaultDistrict: 'Colombo', addresses: [], wishlist: [], isActive: true, createdAt
  });
  const seller = (id, userId, name, slug, district, homemade) => ({
    _id: id, userId, storeName: name, slug, district, city: district,
    sellerType: homemade ? 'Homemade & Cottage' : 'Verified Retail',
    isHomemadeVendor: homemade, status: 'approved', description: 'Synthetic test storefront',
    logoUrl: '/brand/yaans-mark-dark.png', bannerUrl: '/brand/yaans-logo-horizontal-dark.png',
    contactPhone: '0771234567', contactEmail: accounts.seller,
    businessAddress: '42 Test Street', nicOrBrNumber: 'TEST-ONLY',
    commissionRateOverride: null, rating: 5, reviewCount: 0, totalSalesCount: 0,
    shippingPolicy: { freeShippingThresholdLkr: 5000, flatRateIntraLkr: 280 },
    bankDetails: { bankName: 'Test Bank', accountNumber: '0000000000' },
    isVacationMode: false, createdAt
  });
  const sellers = [
    seller('sel_test_pantry', 'usr_test_seller', 'Test Kandy Pantry', 'test-kandy-pantry', 'Kandy', true),
    seller('sel_test_home', 'usr_test_other', 'Test Colombo Home', 'test-colombo-home', 'Colombo', false)
  ];
  const product = (id, title, slug, sellerIndex, priceLkr, categorySlug) => ({
    _id: id, title, slug, sellerId: sellers[sellerIndex]._id,
    sellerName: sellers[sellerIndex].storeName, sellerSlug: sellers[sellerIndex].slug,
    sellerDistrict: sellers[sellerIndex].district, sellerType: sellers[sellerIndex].sellerType,
    sku: id, categorySlug, subCategorySlug: '', description: `${title} for automated tests.`,
    highlights: ['Synthetic test product'], images: ['/brand/yaans-mark-dark.png'],
    priceLkr, stock: 100, variants: [], isHomemade: sellerIndex === 0,
    approvalStatus: 'approved', codEligible: true, isFeatured: true, isDeal: false,
    rating: 5, reviewCount: 0, soldCount: 0, tags: ['test'], createdAt
  });
  const spice = product('prd_test_spice', 'Test Ceylon Spice', 'test-ceylon-spice', 0, 1000, 'homemade-pantry');
  spice.variants = [{ name: 'Pack', values: [
    { label: '100 g', priceLkr: 1000, stock: 50 },
    { label: '250 g', priceLkr: 2000, stock: 50 }
  ] }];
  return {
    users: [
      user('usr_test_admin', 'Test Administrator', accounts.admin, 'admin'),
      user('usr_test_customer', 'Test Customer', accounts.customer, 'customer'),
      user('usr_test_seller', 'Test Seller', accounts.seller, 'seller', sellers[0]._id),
      user('usr_test_other', 'Other Test Seller', accounts.otherSeller, 'seller', sellers[1]._id)
    ],
    sellers,
    categories: seed.categories.slice(0, 2),
    products: [spice,
      product('prd_test_lamp', 'Test Desk Lamp', 'test-desk-lamp', 1, 2500, 'electronics'),
      { ...product('prd_test_pending', 'Pending Test Product', 'pending-test-product', 0, 600, 'homemade-pantry'), approvalStatus: 'pending' }
    ],
    reviews: [], orders: [], subOrders: [], settlements: [],
    platformConfig: {
      ...seed.platformConfig,
      adminAuditLogs: [],
      banners: [{ id: 'bnr_test', title: 'Test Marketplace', active: true, displayOrder: 1,
        imageUrl: '/brand/yaans-logo-horizontal-dark.png', mobileImageUrl: '/brand/yaans-logo-horizontal-dark.png', ctaLink: '/products' }]
    }
  };
}
