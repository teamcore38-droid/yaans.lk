import { businessSettings, sellerCommission } from '../../../shared/businessSettings.js';
import mongoose from 'mongoose';
import { createStaffSession, touchStaffSession } from '../services/staffSessions.js';
import { createRouter } from '../config/router.js';
import bcrypt from 'bcryptjs';
import { getStore, persistStore, generateId, idFilter, withTransaction } from '../config/db.js';
import { authenticate, signToken, getJwtSecret, usesDefaultAdminPassword, credentialsRevoked } from '../middleware/auth.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';
import { loginIpLimit, loginAccountLimit, adminAccountLimit, sharedRateLimit } from '../middleware/sharedRateLimit.js';
import { validateAuthBody, validateNewPassword } from '../config/inputValidation.js';
import { setSessionCookies, clearSessionCookies, newCsrfToken } from '../config/sessionCookies.js';
import { recordSecurityEvent } from '../config/securityEvents.js';
import { beginMfaEnrollment, completeMfaEnrollment, createMfaChallenge, verifyMfaLogin } from '../services/adminMfa.js';
import { httpError } from '../config/errors.js';
import { mountGoogleLogin } from '../services/googleLogin.js';

const router = createRouter();
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.use(validateAuthBody);

function sanitizeUser(user, store) {
  const seller = user.sellerId ? store.sellers.find((s) => s._id === user.sellerId) : null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    ...(user.role === 'customer' ? { hasPassword: Boolean(user.passwordHash), googleLinked: Boolean(user.googleSubject) } : {}),
    phone: user.phone,
    role: user.role,
    ...(user.role === 'staff' ? { staffMustChangePassword: Boolean(user.staffMustChangePassword), canEditProducts: user.canEditProducts === true } : {}),
    ...(user.role === 'admin' ? { mfaEnabled:Boolean(user.adminMfa?.enabled) } : {}),
    sellerId: user.sellerId,
    sellerStatus: seller ? seller.status : null,
    sellerStoreName: seller ? seller.storeName : null,
    defaultDistrict: user.defaultDistrict || (user.role === 'customer' && user.googleSubject ? null : 'Colombo'),
    addresses: user.addresses || [],
    wishlist: user.wishlist || []
  };
}

async function issueSession(req,res,user,store,extra={},status=200) {
  const csrf=newCsrfToken();const staffSessionId=user.role==='staff'?await createStaffSession(user):undefined;const token=signToken(user,csrf,staffSessionId);
  setSessionCookies(res,token,csrf,user.role==='admin',user.role==='staff');
  return res.status(status).json({...(req.headers['x-yaans-client']==='browser'?{}:{token}),user:sanitizeUser(user,store),...extra});
}

mountGoogleLogin(router, issueSession);

// POST /api/auth/login (Customer & Seller Storefront Login ONLY)
router.post('/login', loginIpLimit, loginAccountLimit, async (req, res) => {
  getJwtSecret();
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const store = await getStore({ users: { email: String(email).toLowerCase().trim() } });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = store.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user || !await bcrypt.compare(String(password), user.passwordHash || '')) {
    await recordSecurityEvent('login_failed',{identity:normalizedEmail,ip:req.ip,outcome:'denied'});
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  if (user.role === 'staff') throw httpError(403, 'Staff accounts must use Staff Login (/staff/login).');
  if (user.role === 'admin') {
    return res.status(403).json({
      message: 'Administrator accounts must sign in through the dedicated Admin Console (/admin/login).'
    });
  }
  if (credentialsRevoked(user)) return res.status(403).json({ message: 'This account requires a secure password reset by the site owner.' });
  if (!user.isActive) {
    return res.status(403).json({ message: 'This account has been deactivated.' });
  }

  await recordSecurityEvent('login_success',{userId:user._id,role:user.role,ip:req.ip});
  return issueSession(req,res,user,store);
});

router.post('/staff/login', loginIpLimit, sharedRateLimit('staff-login', 10, 15*60000, req => String(req.body.email || '').toLowerCase().trim()), async (req, res) => {
  getJwtSecret();
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, 'Email and password are required.');
  const store = await getStore({ users: { email: email.toLowerCase().trim() } });
  const user = store.users[0];
  if (!user || user.role !== 'staff' || user.isActive === false || credentialsRevoked(user) || !await bcrypt.compare(password, user.passwordHash)) {
    await recordSecurityEvent('staff_login_failed', { identity: email, ip: req.ip, outcome: 'denied' });
    throw httpError(401, 'Invalid staff credentials or inactive account.');
  }
  await recordSecurityEvent('staff_login_success', { userId: user._id, role: 'staff', ip: req.ip });
  return issueSession(req, res, user, store, { sessionExpiresIn: '8h', inactivityMinutes: 30 });
});
router.post('/staff/activity', authenticate, sharedRateLimit('staff-activity', 20, 60000, req => req.user._id), async (req, res) => {
  if (req.user.role !== 'staff') throw httpError(403, 'Staff access required.');
  await touchStaffSession(req);
  return res.json({ message: 'Activity recorded.' });
});
router.post('/staff/password', authenticate, sharedRateLimit('staff-password', 5, 15*60000, req => req.user._id), async (req, res) => {
  if (req.user.role !== 'staff') throw httpError(403, 'Staff access required.');
  if (!req.body.currentPassword || !await bcrypt.compare(req.body.currentPassword, req.user.passwordHash)) throw httpError(401, 'Current password is incorrect.');
  validateNewPassword(req.body.newPassword);
  if (await bcrypt.compare(req.body.newPassword, req.user.passwordHash)) throw httpError(400, 'Choose a different password.');
  const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  const user = await withTransaction(async session => {
    const store = await getStore({ users: idFilter(req.user._id) }, { session });
    const target = store.users[0];
    if (target.passwordHash !== req.user.passwordHash || target.isActive === false) throw httpError(409, 'Account changed. Please sign in again.');
    target.passwordHash = passwordHash; target.staffMustChangePassword = false;
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    await persistStore(store);
    await mongoose.connection.db.collection('staffsessions').deleteMany({ userId: target._id }, { session });
    return target;
  });
  await recordSecurityEvent('staff_password_changed', { userId: user._id, role: 'staff', ip: req.ip });
  return issueSession(req, res, user, { sellers: [] });
});

// POST /api/auth/admin/login (Dedicated Gated Marketplace Admin Authentication)
router.post('/admin/login', loginIpLimit, adminAccountLimit, async (req, res) => {
  getJwtSecret();
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Administrator email and password are required.' });
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 180);
  const normalizedEmail = String(email).toLowerCase().trim();
  const store = await getStore({ users: { email: normalizedEmail }, platformConfig: true });
  const user = store.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user || !await bcrypt.compare(String(password), user.passwordHash || '')) {
    await recordSecurityEvent('admin_login_failed',{identity:normalizedEmail,ip:req.ip,outcome:'denied'});
    recordAdminAuditLog(store, {
      event: 'ADMIN_LOGIN_FAILED',
      email: normalizedEmail,
      ip,
      userAgent,
      reason: 'Invalid credentials'
    });
    await persistStore(store);
    return res.status(401).json({
      message: 'Invalid administrator credentials.'
    });
  }

  if (user.role !== 'admin') {
    recordAdminAuditLog(store, {
      event: 'ADMIN_LOGIN_FORBIDDEN_ROLE',
      email: normalizedEmail,
      roleAttempted: user.role,
      ip,
      userAgent,
      reason: 'Non-admin account attempted Admin Console login'
    });
    await persistStore(store);
    return res.status(403).json({
      message: 'Access denied. This portal is strictly restricted to Yaans.lk Marketplace Administrators.'
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'This administrator account has been deactivated.' });
  }

  if (await usesDefaultAdminPassword(user)) {
    return res.status(403).json({ message: 'This administrator account requires a secure password reset by the site owner.' });
  }

  if (user.adminMfa?.enabled) return res.json({requiresMfa:true,challengeToken:createMfaChallenge(user)});

  recordAdminAuditLog(store, {
    event: 'ADMIN_LOGIN_SUCCESS',
    email: user.email,
    adminId: user._id,
    ip,
    userAgent
  });
  await persistStore(store);

  await recordSecurityEvent('admin_login_success',{userId:user._id,role:user.role,ip:req.ip});
  return issueSession(req,res,user,store,{sessionExpiresIn:'1h',mfaEnrollmentRecommended:true});
});

router.post('/admin/mfa/login',loginIpLimit,sharedRateLimit('mfa-verification',10,15*60000),async(req,res)=>{
  try {
    const user=await verifyMfaLogin(req.body.challengeToken,req.body.code);
    const store=await getStore({sellers:{_id:{$in:[]}}});
    await recordSecurityEvent('admin_mfa_login_success',{userId:user._id,role:user.role,ip:req.ip});
    return issueSession(req,res,user,store,{sessionExpiresIn:'1h'});
  } catch(error) {await recordSecurityEvent('admin_mfa_login_failed',{ip:req.ip,outcome:'denied'});throw error;}
});

router.post('/admin/mfa/enroll',authenticate,sharedRateLimit('mfa-enrollment',5,15*60000,req=>req.user._id),async(req,res)=>{
  if(req.user.role!=='admin')throw httpError(403,'Administrator access required.');
  if(!req.body.currentPassword||!await bcrypt.compare(req.body.currentPassword,req.user.passwordHash))throw httpError(401,'Current password is required.');
  return res.json(await beginMfaEnrollment(req.user));
});

router.post('/admin/mfa/confirm',authenticate,sharedRateLimit('mfa-confirmation',10,15*60000,req=>req.user._id),async(req,res)=>{
  if(req.user.role!=='admin')throw httpError(403,'Administrator access required.');
  const result=await completeMfaEnrollment(req.user,req.body.code);
  const store=await getStore({sellers:{_id:{$in:[]}}});
  await recordSecurityEvent('admin_mfa_enabled',{userId:req.user._id,role:req.user.role,ip:req.ip});
  return issueSession(req,res,result.user,store,{recoveryCodes:result.recoveryCodes});
});

// POST /api/auth/register-customer
router.post('/register-customer', sharedRateLimit('registration', 10, 60 * 60000), async (req, res) => {
  getJwtSecret();
  const { name, email, phone, password, defaultDistrict = 'Colombo' } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'Name, email, Sri Lankan phone number, and password are required.' });
  }
  validateNewPassword(password);

  const store = await getStore({ users: { email: String(email).toLowerCase().trim() } });
  const exists = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const newUser = {
    _id: generateId('usr_cust'),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    passwordHash: await bcrypt.hash(password, 10),
    role: 'customer',
    sellerId: null,
    defaultDistrict,
    addresses: [],
    wishlist: [],
    isActive: true,
    createdAt: new Date().toISOString()
  };

  store.users.push(newUser);
  await persistStore(store);

  return issueSession(req,res,newUser,store,{},201);
});

// POST /api/auth/register-seller
router.post('/register-seller', sharedRateLimit('registration', 10, 60 * 60000), async (req, res) => {
  getJwtSecret();
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
  validateNewPassword(password);

  const store = await getStore({ users: { email: String(email).toLowerCase().trim() }, sellers: { _id: { $in: [] } }, platformConfig: true });
  const settings = businessSettings(store.platformConfig);
  const selectedType = settings.references.sellerTypes.find(type => type.name === sellerType && type.active);
  if (!selectedType || !settings.references.banks.includes(bankName)) throw httpError(400, 'Choose an available seller type and bank.');
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

  const isHomemadeVendor = selectedType.homemade;

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
    commissionRateOverride: null,
    shippingPolicy: {
      freeShippingThresholdLkr: settings.delivery.defaultFreeShippingLkr,
      flatRateIntraLkr: settings.delivery.defaultIntraDistrictFeeLkr,
      preparationDays: settings.delivery.defaultPreparationDays,
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
    passwordHash: await bcrypt.hash(password, 10),
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
  await persistStore(store);

  return issueSession(req,res,newUser,store,{
    seller: newSeller,
    message: 'Seller application submitted! Your store is now pending Yaans.lk Admin review.'
  },201);
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const store = await getStore({ sellers: { _id: req.user.sellerId || null } });
  return res.json({ user: sanitizeUser(req.user, store) });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  const { name, phone, defaultDistrict, email } = req.body;
  if(email&&email.trim().toLowerCase()!==req.user.email.toLowerCase())throw httpError(400,'Use the credentials form and your current password to change your email.');
  const store = await getStore({ users: { $or: [idFilter(req.user._id), { email: typeof email === 'string' ? email.toLowerCase().trim() : '' }] }, sellers: { _id: req.user.sellerId || null } });
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
  await persistStore(store);
  return res.json({ user: sanitizeUser(user, store) });
});

// PUT /api/auth/update-credentials
// Allows updating username/email, password, name, phone with current password verification
router.put('/update-credentials', authenticate, async (req, res) => {
  const { currentPassword, newEmail, newPassword, newName, newPhone } = req.body;
  const store = await getStore({ users: { $or: [idFilter(req.user._id), { email: typeof newEmail === 'string' ? newEmail.toLowerCase().trim() : '' }] }, sellers: { _id: req.user.sellerId || null } });
  const user = store.users.find((u) => u._id === req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // If updating password or changing email, verify current password
  if (newPassword || (newEmail && newEmail.toLowerCase().trim() !== user.email.toLowerCase())) {
    if (!user.passwordHash) throw httpError(400, 'Verify your linked Google account from Account Security to create a password first.');
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required to update credentials.' });
    }
    if (!await bcrypt.compare(String(currentPassword), user.passwordHash)) {
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
    validateNewPassword(newPassword);
    user.passwordHash = await bcrypt.hash(newPassword, user.role==='admin'?12:10);
  }
  if(newPassword||(newEmail&&newEmail.trim().toLowerCase()!==req.user.email.toLowerCase()))user.tokenVersion=(user.tokenVersion||0)+1;

  if (newName && newName.trim()) user.name = newName.trim();
  if (newPhone !== undefined) user.phone = newPhone.trim();

  await persistStore(store);
  await recordSecurityEvent('credentials_changed',{userId:user._id,role:user.role,ip:req.ip});
  return issueSession(req,res,user,store,{message:'Credentials updated successfully.'});
});

router.post('/logout',authenticate,async(req,res)=>{
  const store=await getStore({users:idFilter(req.user._id)});
  const user=store.users[0];user.tokenVersion=(user.tokenVersion||0)+1;
  await persistStore(store);
  clearSessionCookies(res);
  await recordSecurityEvent('logout_all_sessions',{userId:user._id,role:user.role,ip:req.ip});
  return res.json({message:'Signed out on all devices.'});
});

// POST /api/auth/addresses
router.post('/addresses', authenticate, async (req, res) => {
  const { label, recipientName, phone, addressLine1, addressLine2, city, district, postalCode, isDefault } = req.body;
  if (!recipientName || !phone || !addressLine1 || !city || !district) {
    return res.status(400).json({ message: 'Recipient name, phone, address, city, and Sri Lankan district are required.' });
  }
  const store = await getStore({ users: idFilter(req.user._id) });
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

  await persistStore(store);
  return res.json({ addresses: user.addresses });
});

// DELETE /api/auth/addresses/:addressId
router.delete('/addresses/:addressId', authenticate, async (req, res) => {
  const store = await getStore({ users: idFilter(req.user._id) });
  const user = store.users.find((u) => u._id === req.user._id);
  user.addresses = (user.addresses || []).filter((a) => a._id !== req.params.addressId);
  await persistStore(store);
  return res.json({ addresses: user.addresses });
});

// POST /api/auth/wishlist/toggle
router.post('/wishlist/toggle', authenticate, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ message: 'productId is required.' });
  }
  const store = await getStore({ users: idFilter(req.user._id) });
  const user = store.users.find((u) => u._id === req.user._id);
  user.wishlist = user.wishlist || [];
  const idx = user.wishlist.indexOf(productId);
  if (idx >= 0) {
    user.wishlist.splice(idx, 1);
  } else {
    user.wishlist.push(productId);
  }
  await persistStore(store);
  return res.json({ wishlist: user.wishlist });
});

export default router;
