import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createRouter } from '../config/router.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getStore, persistStore, generateId, idFilter, withTransaction } from '../config/db.js';
import { validateAuthBody, validateNewPassword, stringField } from '../config/inputValidation.js';
import { recordSecurityEvent } from '../config/securityEvents.js';
import { recordAdminAuditLog } from '../config/auditLogger.js';
import { sharedRateLimit } from '../middleware/sharedRateLimit.js';
import { httpError } from '../config/errors.js';

const router = createRouter();
router.use(authenticate, requireRole('admin'));
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use(validateAuthBody);
const publicStaff = ({ _id, name, email, phone, isActive, staffMustChangePassword, createdAt }) =>
  ({ _id: String(_id), name, email, phone, isActive, staffMustChangePassword, createdAt });
router.get('/', async (req, res) => {
  const before = stringField(req.query.after, 'Cursor', { maximum: 128 });
  const rows = await mongoose.connection.db.collection('users').find({ role: 'staff', ...(before ? { _id: { $gt: before } } : {}) },
    { projection: { _id: 1, name: 1, email: 1, phone: 1, isActive: 1, staffMustChangePassword: 1, createdAt: 1 }, maxTimeMS: 3000 })
    .sort({ _id: 1 }).limit(26).toArray();
  res.json({ staff: rows.slice(0, 25).map(publicStaff), nextCursor: rows.length > 25 ? String(rows[24]._id) : null });
});
router.use(sharedRateLimit('staff-management', 10, 15*60000, req => req.user._id));
router.use(async (req, _res, next) => {
  try {
    if (!req.body.currentPassword || !await bcrypt.compare(req.body.currentPassword, req.user.passwordHash)) throw httpError(401, 'Your current administrator password is required.');
    next();
  } catch (error) {
    if (error.status === 401) await recordSecurityEvent('staff_management_denied', { userId: req.user._id, role: 'admin', ip: req.ip, outcome: 'denied' });
    next(error);
  }
});
async function change(req, action, work) {
  if (req.params.id) stringField(req.params.id, 'Staff ID', { required: true, maximum: 128 });
  return withTransaction(async session => {
    const store = await getStore({ users: req.params.id ? idFilter(req.params.id) : { email: req.body.email.toLowerCase().trim() }, platformConfig: true }, { session });
    const target = await work(store);
    recordAdminAuditLog(store, { action, adminId: req.user._id, adminEmail: req.user.email, ip: req.ip,
      details: action.replaceAll('_', ' '), metadata: { staffId: target._id } });
    await persistStore(store);
    await mongoose.connection.db.collection('staffsessions').deleteMany({ userId: target._id }, { session });
    return publicStaff(target);
  });
}
router.post('/', async (req, res) => {
  if (Object.keys(req.body).some(key => !['name','email','phone','password','currentPassword'].includes(key))) throw httpError(400, 'Unsupported staff account field.');
  for (const name of ['name', 'email', 'phone']) stringField(req.body[name], name, { required: true });
  validateNewPassword(req.body.password);
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const staff = await change(req, 'STAFF_CREATED', store => {
    if (store.users.length) throw httpError(409, 'An account with this email already exists.');
    const user = { _id: generateId('usr_staff'), name: req.body.name.trim(), email: req.body.email.toLowerCase().trim(), phone: req.body.phone.trim(),
      passwordHash, role: 'staff', isActive: true, staffMustChangePassword: true, tokenVersion: 0, createdAt: new Date().toISOString(), addresses: [], wishlist: [] };
    store.users.push(user); return user;
  });
  res.status(201).json({ staff, message: 'Staff account created. Share the temporary password privately; it must be changed at first login.' });
});
function staffTarget(store) {
  const user = store.users[0];
  if (!user || user.role !== 'staff') throw httpError(404, 'Staff account not found.');
  return user;
}
router.patch('/:id', async (req, res) => {
  if (typeof req.body.isActive !== 'boolean' || Object.keys(req.body).some(key => !['isActive','currentPassword'].includes(key))) throw httpError(400, 'Provide a staff account active status only.');
  const staff = await change(req, req.body.isActive ? 'STAFF_ENABLED' : 'STAFF_DISABLED', store => {
    const user = staffTarget(store); user.isActive = req.body.isActive; user.tokenVersion = (user.tokenVersion || 0) + 1; return user;
  });
  res.json({ staff });
});
router.post('/:id/reset-password', async (req, res) => {
  if (Object.keys(req.body).some(key => !['newPassword','currentPassword'].includes(key))) throw httpError(400, 'Unsupported password reset field.');
  validateNewPassword(req.body.newPassword);
  const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  const staff = await change(req, 'STAFF_PASSWORD_RESET', store => {
    const user = staffTarget(store); user.passwordHash = passwordHash; user.staffMustChangePassword = true;
    user.tokenVersion = (user.tokenVersion || 0) + 1; return user;
  });
  res.json({ staff, message: 'Password reset. All previous staff sessions have been revoked.' });
});
export default router;
