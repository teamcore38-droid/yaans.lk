import { createRouter } from '../config/router.js';
import bcrypt from 'bcryptjs';
import { getStore, persistStore, generateId, idFilter } from '../config/db.js';
import { authenticate, signToken, getJwtSecret, usesDefaultAdminPassword, credentialsRevoked } from '../middleware/auth.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';
import { loginIpLimit, loginAccountLimit, adminAccountLimit, sharedRateLimit, consumeLimit } from '../middleware/sharedRateLimit.js';
import { validateAuthBody, validateNewPassword } from '../config/inputValidation.js';
import { setSessionCookies, clearSessionCookies, newCsrfToken } from '../config/sessionCookies.js';
import { recordSecurityEvent } from '../config/securityEvents.js';
import { beginMfaEnrollment, completeMfaEnrollment, createMfaChallenge, verifyMfaLogin } from '../services/adminMfa.js';
import { httpError } from '../config/errors.js';
import { beginRegistration, beginEmailChange, requestCurrentEmailVerification, confirmEmail } from '../services/emailVerification.js';

const router = createRouter();
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.use(validateAuthBody);

function sanitizeUser(user, store) {
  const seller = user.sellerId ? store.sellers.find((s) => s._id === user.sellerId) : null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt && user.verifiedEmail === user.email),
    pendingEmail: user.pendingEmail || null,
    phone: user.phone,
    role: user.role,
    ...(user.role === 'admin' ? { mfaEnabled:Boolean(user.adminMfa?.enabled) } : {}),
    sellerId: user.sellerId,
    sellerStatus: seller ? seller.status : null,
    sellerStoreName: seller ? seller.storeName : null,
    defaultDistrict: user.defaultDistrict || 'Colombo',
    addresses: user.addresses || [],
    wishlist: user.wishlist || []
  };
}

function issueSession(req,res,user,store,extra={},status=200) {
  const csrf=newCsrfToken();const token=signToken(user,csrf);
  setSessionCookies(res,token,csrf,user.role==='admin');
  return res.status(status).json({...(req.headers['x-yaans-client']==='browser'?{}:{token}),user:sanitizeUser(user,store),...extra});
}

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
  if (!user || !await bcrypt.compare(String(password), user.passwordHash)) {
    await recordSecurityEvent('login_failed',{identity:normalizedEmail,ip:req.ip,outcome:'denied'});
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
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

  if (!user || !await bcrypt.compare(String(password), user.passwordHash)) {
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
const emailRecipientLimit = sharedRateLimit('email-recipient', 3, 60 * 60000, req => String(req.body?.newEmail || req.body?.email || req.user?.email || '').trim().toLowerCase());
router.post('/register-customer', sharedRateLimit('registration', 10, 60 * 60000), emailRecipientLimit, async (req, res) => {
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

  return res.status(202).json(await beginRegistration(newUser));
});

// POST /api/auth/register-seller
router.post('/register-seller', sharedRateLimit('registration', 10, 60 * 60000), emailRecipientLimit, async (req, res) => {
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

  const store = await getStore({ users: { email: String(email).toLowerCase().trim() }, sellers: { _id: { $in: [] } } });
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
    passwordHash: await bcrypt.hash(password, 10),
    role: 'seller',
    sellerId,
    defaultDistrict: district,
    addresses: [],
    wishlist: [],
    isActive: true,
    createdAt: new Date().toISOString()
  };

  return res.status(202).json(await beginRegistration(newUser,newSeller));
});

router.post('/verify-email', sharedRateLimit('email-confirm-ip',20,15*60000),
  sharedRateLimit('email-confirm-token',5,15*60000,req=>req.body?.verificationToken||''), async(req,res)=>{
    const result=await confirmEmail(req.body.verificationToken,req.body.password);
    await recordSecurityEvent(result.emailChanged?'email_changed':'email_verified',{ip:req.ip});
    // An email link never creates an authenticated session or bypasses administrator MFA.
    return res.json(result);
  });

router.post('/email-verification',authenticate,sharedRateLimit('email-request-account',3,60*60000,req=>req.user._id),emailRecipientLimit,async(req,res)=>{
  if(!req.body.currentPassword||!await bcrypt.compare(req.body.currentPassword,req.user.passwordHash))throw httpError(401,'Current password is required.');
  return res.json(await requestCurrentEmailVerification(req.user));
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
router.put('/update-credentials', authenticate, sharedRateLimit('credential-updates',10,60*60000,req=>req.user._id), async (req, res) => {
  const { currentPassword, newEmail, newPassword, newName, newPhone } = req.body;
  const store = await getStore({ users: { $or: [idFilter(req.user._id), { email: typeof newEmail === 'string' ? newEmail.toLowerCase().trim() : '' }] }, sellers: { _id: req.user.sellerId || null } });
  const user = store.users.find((u) => u._id === req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // If updating password or changing email, verify current password
  if (newPassword || (newEmail && newEmail.toLowerCase().trim() !== user.email.toLowerCase())) {
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
    if(newPassword)throw httpError(400,'Change your password and email address in separate requests.');
    // Recipient throttling is shared with registration and verification requests.
    const limit=await consumeLimit('email-recipient',trimmedEmail,3,60*60000);
    if(!limit.allowed){res.set('Retry-After',String(limit.retryAfter));throw httpError(429,'Too many email requests. Please wait and try again.');}
    const pending=await beginEmailChange(user,trimmedEmail,{name:newName?.trim(),phone:newPhone?.trim()});
    await recordSecurityEvent('email_change_requested',{userId:user._id,role:user.role,ip:req.ip});
    return res.json({user:sanitizeUser(pending,store),requiresEmailVerification:true,message:'Check your new inbox for a confirmation link. Your current login email stays active until you confirm it.'});
  }

  if (newPassword) {
    validateNewPassword(newPassword);
    user.passwordHash = await bcrypt.hash(newPassword, user.role==='admin'?12:10);
  }
  if(newPassword){user.tokenVersion=(user.tokenVersion||0)+1;user.pendingEmail=undefined;user.pendingEmailChallengeId=undefined;}

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
