import express from 'express';
import bcrypt from 'bcryptjs';
import { getStore, persistStore, generateId } from '../config/db.js';
import { authenticate, signToken, signAdminToken } from '../middleware/auth.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';

const router = express.Router();

// Dedicated Admin Brute-Force Protection (Max 5 failed attempts per 15 minutes per IP/Email)
const ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_MAX_FAILED_ATTEMPTS = 5;
const adminFailedAttempts = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function checkAdminRateLimit(key) {
  const record = adminFailedAttempts.get(key);
  if (!record) return { locked: false, remainingAttempts: ADMIN_MAX_FAILED_ATTEMPTS };
  if (Date.now() - record.firstAttemptAt > ADMIN_LOCKOUT_WINDOW_MS) {
    adminFailedAttempts.delete(key);
    return { locked: false, remainingAttempts: ADMIN_MAX_FAILED_ATTEMPTS };
  }
  if (record.count >= ADMIN_MAX_FAILED_ATTEMPTS) {
    const minutesLeft = Math.ceil((ADMIN_LOCKOUT_WINDOW_MS - (Date.now() - record.firstAttemptAt)) / 60000);
    return { locked: true, minutesLeft: Math.max(1, minutesLeft), remainingAttempts: 0 };
  }
  return { locked: false, remainingAttempts: ADMIN_MAX_FAILED_ATTEMPTS - record.count };
}

function recordFailedAdminAttempt(key) {
  const now = Date.now();
  const record = adminFailedAttempts.get(key);
  if (!record || now - record.firstAttemptAt > ADMIN_LOCKOUT_WINDOW_MS) {
    adminFailedAttempts.set(key, { count: 1, firstAttemptAt: now });
    return ADMIN_MAX_FAILED_ATTEMPTS - 1;
  }
  record.count += 1;
  adminFailedAttempts.set(key, record);
  return Math.max(0, ADMIN_MAX_FAILED_ATTEMPTS - record.count);
}

function clearAdminFailedAttempts(key) {
  adminFailedAttempts.delete(key);
}

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

// POST /api/auth/login (Customer & Seller Storefront Login ONLY)
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const store = getStore();
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = store.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  if (user.role === 'admin') {
    return res.status(403).json({
      message: 'Administrator accounts must sign in through the dedicated Admin Console (/admin/login).'
    });
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

// POST /api/auth/admin/login (Dedicated Gated Marketplace Admin Authentication)
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Administrator email and password are required.' });
  }

  const ip = getClientIp(req);
  const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 180);
  const normalizedEmail = String(email).toLowerCase().trim();
  const rateLimitKey = `${ip}:${normalizedEmail}`;

  const ipStatus = checkAdminRateLimit(ip);
  const accountStatus = checkAdminRateLimit(rateLimitKey);
  if (ipStatus.locked || accountStatus.locked) {
    const minutes = Math.max(ipStatus.minutesLeft || 1, accountStatus.minutesLeft || 1);
    return res.status(429).json({
      message: `Security Lockout: Too many failed administrator sign-in attempts. Please wait ${minutes} minute(s) before trying again.`
    });
  }

  const store = getStore();
  const user = store.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    recordFailedAdminAttempt(ip);
    const remaining = recordFailedAdminAttempt(rateLimitKey);
    recordAdminAuditLog(store, {
      event: 'ADMIN_LOGIN_FAILED',
      email: normalizedEmail,
      ip,
      userAgent,
      reason: 'Invalid credentials'
    });
    persistStore();
    return res.status(401).json({
      message:
        remaining > 0
          ? `Invalid administrator credentials. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout)`
          : 'Security Lockout: Maximum failed attempts reached. Account locked for 15 minutes.'
    });
  }

  if (user.role !== 'admin') {
    recordFailedAdminAttempt(ip);
    recordFailedAdminAttempt(rateLimitKey);
    recordAdminAuditLog(store, {
      event: 'ADMIN_LOGIN_FORBIDDEN_ROLE',
      email: normalizedEmail,
      roleAttempted: user.role,
      ip,
      userAgent,
      reason: 'Non-admin account attempted Admin Console login'
    });
    persistStore();
    return res.status(403).json({
      message: 'Access denied. This portal is strictly restricted to Yaans.lk Marketplace Administrators.'
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'This administrator account has been deactivated.' });
  }

  clearAdminFailedAttempts(ip);
  clearAdminFailedAttempts(rateLimitKey);
  recordAdminAuditLog(store, {
    event: 'ADMIN_LOGIN_SUCCESS',
    email: user.email,
    adminId: user._id,
    ip,
    userAgent
  });
  persistStore();

  const token = signAdminToken(user);
  return res.json({
    token,
    sessionExpiresIn: '6h',
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
  const { name, phone, defaultDistrict, email } = req.body;
  const store = getStore();
  const user = store.users.find((u) => u._id === req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  if (name) user.name = name.trim();
  if (phone) user.phone = phone.trim();
  if (defaultDistrict) user.defaultDistrict = defaultDistrict;
  if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
    const trimmed = email.toLowerCase().trim();
    const existing = store.users.find((u) => u._id !== user._id && u.email.toLowerCase() === trimmed);
    if (existing) {
      return res.status(409).json({ message: 'Email is already in use.' });
    }
    user.email = trimmed;
  }
  persistStore();
  return res.json({ user: sanitizeUser(user, store) });
});

// PUT /api/auth/update-credentials
// Allows updating username/email, password, name, phone with current password verification
router.put('/update-credentials', authenticate, (req, res) => {
  const { currentPassword, newEmail, newPassword, newName, newPhone } = req.body;
  const store = getStore();
  const user = store.users.find((u) => u._id === req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // If updating password or changing email, verify current password
  if (newPassword || (newEmail && newEmail.toLowerCase().trim() !== user.email.toLowerCase())) {
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required to update credentials.' });
    }
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
  }

  if (newEmail && newEmail.toLowerCase().trim() !== user.email.toLowerCase()) {
    const trimmedEmail = newEmail.toLowerCase().trim();
    const existing = store.users.find(
      (u) => u._id !== user._id && u.email.toLowerCase() === trimmedEmail
    );
    if (existing) {
      return res.status(409).json({ message: 'Email / username is already in use by another account.' });
    }
    user.email = trimmedEmail;
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 8);
  }

  if (newName && newName.trim()) user.name = newName.trim();
  if (newPhone !== undefined) user.phone = newPhone.trim();

  persistStore();
  const token = signToken(user);
  return res.json({
    token,
    user: sanitizeUser(user, store),
    message: 'Credentials updated successfully.'
  });
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
