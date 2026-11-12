import mongoose from 'mongoose';
import { catalogIndexes } from '../config/catalogIndexes.js';

const { Schema } = mongoose;

// 1. User Schema (Customers, Sellers, Admins)
const AddressSchema = new Schema({
  label: { type: String, default: 'Home' },
  recipientName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String, default: '' },
  city: { type: String, required: true },
  district: { type: String, required: true },
  postalCode: { type: String, default: '' },
  isDefault: { type: Boolean, default: false }
});

const UserSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    credentialsUpdatedAt: { type: Date, default: null },
    role: { type: String, enum: ['customer', 'seller', 'admin'], default: 'customer' },
    sellerId: { type: String, default: null },
    defaultDistrict: { type: String, default: 'Colombo' },
    addresses: [AddressSchema],
    wishlist: [{ type: String }], // Product IDs
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// 2. Seller Schema (Supports Home-based sellers, Small Businesses, and Retail Vendors)
const SellerSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    userId: { type: String, required: true, index: true },
    storeName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    sellerType: {
      type: String,
      enum: ['Homemade & Cottage', 'Small Business', 'Verified Retail Vendor', 'Artisan & Craft'],
      default: 'Small Business'
    },
    isHomemadeVendor: { type: Boolean, default: false },
    description: { type: String, required: true },
    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    contactPhone: { type: String, required: true },
    contactEmail: { type: String, required: true },
    district: { type: String, required: true }, // e.g., Colombo, Kandy, Galle, Jaffna, Matara
    city: { type: String, required: true },
    businessAddress: { type: String, required: true },
    nicOrBrNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true
    },
    rejectionReason: { type: String, default: '' },
    commissionRateOverride: { type: Number, default: null }, // Null means use platform default (e.g. 8%)
    shippingPolicy: {
      freeShippingThresholdLkr: { type: Number, default: 0 },
      flatRateIntraLkr: { type: Number, default: 0 },
      dispatchTimeDays: { type: String, default: '1-2 days' }
    },
    bankDetails: {
      bankName: { type: String, default: 'Bank of Ceylon (BOC)' },
      branchName: { type: String, default: '' },
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' }
    },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 0 },
    totalSalesCount: { type: Number, default: 0 },
    isVacationMode: { type: Boolean, default: false },
    vacationNotice: { type: String, default: '' }
  },
  { timestamps: true }
);

// 3. Category Schema (With 2x2 Quad Card Support for Mobile & Desktop Browsing)
const SubCategoryTileSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  imageUrl: { type: String, required: true },
  bgTint: { type: String, default: '#F3F4F6' }
});

const CategorySchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    quadHeadline: { type: String, required: true }, // e.g., "Sri Lankan Homemade & Spices"
    description: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    displayOrder: { type: Number, default: 1 },
    showInQuadGrid: { type: Boolean, default: true },
    subCategories: [SubCategoryTileSchema]
  },
  { timestamps: true }
);

// 4. Product Schema
const VariantOptionSchema = new Schema({
  name: { type: String, required: true }, // e.g., "Weight" or "Size" or "Color"
  values: [
    {
      label: { type: String, required: true }, // e.g., "250g", "500g", "1kg"
      priceLkr: { type: Number, required: true },
      stock: { type: Number, default: 25 }
    }
  ]
});

const ProductSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    sellerId: { type: String, required: true, index: true },
    sellerName: { type: String, required: true },
    sellerSlug: { type: String, required: true },
    sellerDistrict: { type: String, required: true, index: true },
    sellerType: { type: String, default: 'Small Business' },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true },
    categorySlug: { type: String, required: true, index: true },
    subCategorySlug: { type: String, default: '' },
    description: { type: String, required: true },
    highlights: [{ type: String }],
    priceLkr: { type: Number, required: true, index: true },
    compareAtPriceLkr: { type: Number, default: null },
    stock: { type: Number, required: true, default: 10 },
    images: [{ type: String }],
    variants: [VariantOptionSchema],
    isHomemade: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isDeal: { type: Boolean, default: false, index: true },
    codEligible: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
      index: true
    },
    rating: { type: Number, default: 4.7 },
    reviewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    tags: [{ type: String }],
    adminNote: { type: String, default: '' },
    lastEditedBy: { type: String, default: null },
    lastEditedAt: { type: String, default: null }
  },
  { timestamps: true }
);

// 5. Review Schema
const ReviewSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    productId: { type: String, required: true, index: true },
    userId: { type: String, default: null },
    customerName: { type: String, required: true },
    district: { type: String, default: 'Colombo' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: '' },
    comment: { type: String, required: true },
    verifiedPurchase: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// 6. SubOrder Schema (Per-Seller Split Order for Independent Seller Fulfillment & Settlement)
const OrderItemSchema = new Schema({
  productId: { type: String, required: true },
  title: { type: String, required: true },
  image: { type: String, default: '' },
  sku: { type: String, default: '' },
  variantLabel: { type: String, default: 'Standard' },
  unitPriceLkr: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  lineTotalLkr: { type: Number, required: true },
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  sellerDistrict: { type: String, required: true }
});

const SubOrderSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    inventoryReservedAt: { type: Date, default: null },
    inventoryReleasedAt: { type: Date, default: null },
    subOrderNumber: { type: String, required: true, unique: true }, // e.g., YLK-2026-1001-S1
    parentOrderId: { type: String, required: true, index: true },
    parentOrderNumber: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    sellerName: { type: String, required: true },
    sellerDistrict: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    shippingAddress: {
      recipientName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      district: String,
      postalCode: String,
      deliveryNotes: String
    },
    items: [OrderItemSchema],
    itemsSubtotalLkr: { type: Number, required: true },
    deliveryFeeLkr: { type: Number, required: true },
    grossTotalLkr: { type: Number, required: true }, // itemsSubtotalLkr + deliveryFeeLkr
    commissionRatePercent: { type: Number, required: true },
    commissionAmountLkr: { type: Number, required: true },
    netSellerEarningsLkr: { type: Number, required: true }, // itemsSubtotalLkr - commissionAmountLkr (+ delivery if seller self-ships)
    paymentMethod: { type: String, enum: ['COD', 'ONLINE_CARD_FUTURE'], default: 'COD' },
    codCollectionStatus: {
      type: String,
      enum: ['pending_collection', 'collected_by_courier', 'remitted_to_platform', 'not_applicable', 'refunded'],
      default: 'pending_collection'
    },
    codCollectedAt: { type: Date, default: null },
    paymentReceipt: { type: Schema.Types.Mixed, default: null },
    refund: { type: Schema.Types.Mixed, default: null },
    sellerRecovery: { type: Schema.Types.Mixed, default: null },
    payoutHoldReason: { type: String, default: '' },
    returnInspection: { type: Schema.Types.Mixed, default: null },
    fulfillmentStatus: {
      type: String,
      enum: [
        'pending_confirmation',
        'confirmed',
        'packed',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'return_requested',
        'returned'
      ],
      default: 'confirmed'
    },
    trackingCode: { type: String, default: '' },
    courierPartner: { type: String, default: 'Prompt Xpress / Domex SL' },
    settlementStatus: {
      type: String,
      enum: ['unsettled', 'eligible_for_payout', 'held_for_return', 'settled', 'voided'],
      default: 'unsettled'
    },
    settlementId: { type: String, default: null },
    statusHistory: [
      {
        status: String,
        note: String,
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// 7. Master Order Schema (Customer-facing Order that groups 1..N Seller SubOrders)
const OrderSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    orderNumber: { type: String, required: true, unique: true, index: true }, // e.g., YLK-2026-1001
    userId: { type: String, default: null, index: true }, // null for Guest Checkout
    isGuestOrder: { type: Boolean, default: false },
    guestAccessTokenHash: { type: String, select: false },
    guestAccessExpiresAt: { type: Date, default: null },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true, index: true },
    shippingAddress: {
      recipientName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String, default: '' },
      city: { type: String, required: true },
      district: { type: String, required: true },
      postalCode: { type: String, default: '' },
      deliveryNotes: { type: String, default: '' }
    },
    items: [OrderItemSchema],
    subOrderIds: [{ type: String }],
    sellerCount: { type: Number, default: 1 },
    itemsSubtotalLkr: { type: Number, required: true },
    totalDeliveryFeeLkr: { type: Number, required: true },
    grandTotalLkr: { type: Number, required: true }, // No tax calculation as required
    paymentMethod: { type: String, enum: ['COD', 'ONLINE_CARD_FUTURE'], default: 'COD' },
    codConfirmedByCustomer: { type: Boolean, default: true },
    overallStatus: {
      type: String,
      enum: ['processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'processing'
    }
  },
  { timestamps: true }
);

// 8. Seller Settlement Schema
const SettlementSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    settlementReference: { type: String, required: true, unique: true },
    sellerId: { type: String, required: true, index: true },
    sellerName: { type: String, required: true },
    subOrderIds: [{ type: String }],
    grossOrderItemsLkr: { type: Number, required: true },
    platformCommissionLkr: { type: Number, required: true },
    netPayoutLkr: { type: Number, required: true },
    bankReference: { type: String, default: '' },
    status: { type: String, enum: ['paid', 'processing'], default: 'paid' },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

// 9. Platform Config Schema (Commissions, 25 Sri Lankan Districts, Banners, COD rules)
const PlatformConfigSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true },
    _writeVersion: { type: Number, default: 0, select: false },
    key: { type: String, default: 'main_config', unique: true },
    defaultCommissionPercent: { type: Number, default: 8.0 },
    homemadeCommissionPercent: { type: Number, default: 5.0 }, // Lower commission to empower Sri Lankan home-based sellers
    codEnabledGlobally: { type: Boolean, default: true },
    codMaxOrderLimitLkr: { type: Number, default: 75000 },
    globalFreeShippingMinLkr: { type: Number, default: 0 },
    supportPhone: { type: String, default: '+94 11 234 5678' },
    supportWhatsapp: { type: String, default: '+94 77 123 4567' },
    shippingMode: { type: String, default: 'custom' },
    flatShippingRateLkr: { type: Number, default: 350 },
    districts: [
      {
        code: String,
        name: String,
        province: String,
        intraDistrictFee: Number,
        standardFee: Number,
        outstationFee: Number,
        codAvailable: Boolean,
        estimatedDays: String
      }
    ],
    banners: [
      {
        id: { type: String },
        title: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        mobileImageUrl: { type: String, default: '' },
        categorySlug: { type: String, default: '' },
        ctaLink: { type: String, default: '/products' },
        active: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 1 }
      }
    ]
  },
  { timestamps: true, strict: false }
);

for (const { key, name } of catalogIndexes) ProductSchema.index(key, { name });

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export const SellerModel = mongoose.models.Seller || mongoose.model('Seller', SellerSchema);
export const CategoryModel = mongoose.models.Category || mongoose.model('Category', CategorySchema);
export const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const ReviewModel = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
export const SubOrderModel = mongoose.models.SubOrder || mongoose.model('SubOrder', SubOrderSchema);
export const OrderModel = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export const SettlementModel = mongoose.models.Settlement || mongoose.model('Settlement', SettlementSchema);
export const PlatformConfigModel =
  mongoose.models.PlatformConfig || mongoose.model('PlatformConfig', PlatformConfigSchema);
