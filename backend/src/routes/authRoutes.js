import express from 'express';
import bcrypt from 'bcryptjs';
import { getStore, persistStore, generateId } from '../config/db.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = express.Router();

function sanitizeUser(user, store) {
  const seller = user.sellerId ? store.sellers.find((s) => s._id === user.sellerId) : null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    sellerId: user.sellerId,
    sellerStatus: seller ? seller.status : null,
    sellerStoreName: seller ? seller.storeName : null,
    defaultDistrict: user.defaultDistrict || 'Colombo',
    addresses: user.addresses || [],
    wishlist: user.wishlist || []
  };
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const store = getStore();
  const user = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: 'This account has been deactivated.' });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: sanitizeUser(user, store)
  });
});

// POST /api/auth/register-customer
router.post('/register-customer', (req, res) => {
  const { name, email, phone, password, defaultDistrict = 'Colombo' } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'Name, email, Sri Lankan phone number, and password are required.' });
  }

  const store = getStore();
  const exists = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const newUser = {
    _id: generateId('usr_cust'),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    passwordHash: bcrypt.hashSync(password, 8),
    role: 'customer',
    sellerId: null,
    defaultDistrict,
    addresses: [],
    wishlist: [],
    isActive: true,
    createdAt: new Date().toISOString()
  };

  store.users.push(newUser);
  persistStore();

  const token = signToken(newUser);
  return res.status(201).json({
    token,
    user: sanitizeUser(newUser, store)
  });
});

// POST /api/auth/register-seller
router.post('/register-seller', (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    storeName,
    sellerType = 'Homemade & Cottage',
    description,
    district = 'Colombo',
    city,
    businessAddress,
    nicOrBrNumber,
    bankName = 'Bank of Ceylon (BOC)',
    branchName = '',
    accountHolderName = '',
    accountNumber = ''
  } = req.body;

  if (!name || !email || !phone || !password || !storeName || !district || !city || !nicOrBrNumber) {
    return res.status(400).json({
      message: 'Please complete all required seller registration and Sri Lankan business/NIC fields.'
    });
  }

  const store = getStore();
  const exists = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const sellerId = generateId('sel');
  const userId = generateId('usr_seller');
  const slugBase = storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const isHomemadeVendor = sellerType === 'Homemade & Cottage' || sellerType === 'Artisan & Craft';

  const newSeller = {
    _id: sellerId,
    userId,
    storeName: storeName.trim(),
    slug: `${slugBase}-${Date.now().toString(36).slice(-4)}`,
    sellerType,
    isHomemadeVendor,
    description:
      description ||
      `${storeName.trim()} — Trusted ${sellerType} seller shipping from ${city}, ${district} across all 25 Sri Lankan districts.`,
    logoUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
    contactPhone: phone.trim(),
    contactEmail: email.toLowerCase().trim(),
    district,
    city: city.trim(),
    businessAddress: businessAddress || `${city}, ${district}`,
    nicOrBrNumber: nicOrBrNumber.trim(),
    status: 'pending', // Requires Admin approval as specified
    rejectionReason: '',
    commissionRateOverride: isHomemadeVendor ? 5 : null,
    shippingPolicy: {
      freeShippingThresholdLkr: 5000,
      flatRateIntraLkr: 280,
      dispatchTimeDays: '1-2 business days'
    },
    bankDetails: {
      bankName,
      branchName,
      accountHolderName: accountHolderName || name.trim(),
      accountNumber
    },
    rating: 5.0,
    reviewCount: 0,
    totalSalesCount: 0,
    createdAt: new Date().toISOString()
  };

  const newUser = {
    _id: userId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    passwordHash: bcrypt.hashSync(password, 8),
    role: 'seller',
    sellerId,
    defaultDistrict: district,
    addresses: [],
    wishlist: [],
    isActive: true,
    createdAt: new Date().toISOString()
  };

  store.sellers.push(newSeller);
  store.users.push(newUser);
  persistStore();

  const token = signToken(newUser);
  return res.status(201).json({
    token,
    user: sanitizeUser(newUser, store),
    seller: newSeller,
    message: 'Seller application submitted! Your store is now pending Yaans.lk Admin review.'
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const store = getStore();
  return res.json({ user: sanitizeUser(req.user, store) });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, (req, res) => {
  const { name, phone, defaultDistrict } = req.body;
  const store = getStore();
  const user = store.users.find((u) => u._id === req.user._id);
  if (name) user.name = name.trim();
  if (phone) user.phone = phone.trim();
  if (defaultDistrict) user.defaultDistrict = defaultDistrict;
  persistStore();
  return res.json({ user: sanitizeUser(user, store) });
});

// POST /api/auth/addresses
router.post('/addresses', authenticate, (req, res) => {
  const { label, recipientName, phone, addressLine1, addressLine2, city, district, postalCode, isDefault } = req.body;
  if (!recipientName || !phone || !addressLine1 || !city || !district) {
    return res.status(400).json({ message: 'Recipient name, phone, address, city, and Sri Lankan district are required.' });
  }
  const store = getStore();
  const user = store.users.find((u) => u._id === req.user._id);
  user.addresses = user.addresses || [];

  if (isDefault || user.addresses.length === 0) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  user.addresses.push({
    _id: generateId('addr'),
    label: label || 'Home',
    recipientName,
    phone,
    addressLine1,
    addressLine2: addressLine2 || '',
    city,
    district,
    postalCode: postalCode || '',
    isDefault: Boolean(isDefault || user.addresses.length === 0)
  });

  persistStore();
  return res.json({ addresses: user.addresses });
});

// DELETE /api/auth/addresses/:addressId
router.delete('/addresses/:addressId', authenticate, (req, res) => {
  const store = getStore();
  const user = store.users.find((u) => u._id === req.user._id);
  user.addresses = (user.addresses || []).filter((a) => a._id !== req.params.addressId);
  persistStore();
  return res.json({ addresses: user.addresses });
});

// POST /api/auth/wishlist/toggle
router.post('/wishlist/toggle', authenticate, (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ message: 'productId is required.' });
  }
  const store = getStore();
  const user = store.users.find((u) => u._id === req.user._id);
  user.wishlist = user.wishlist || [];
  const idx = user.wishlist.indexOf(productId);
  if (idx >= 0) {
    user.wishlist.splice(idx, 1);
  } else {
    user.wishlist.push(productId);
  }
  persistStore();
  return res.json({ wishlist: user.wishlist });
});

export default router;
