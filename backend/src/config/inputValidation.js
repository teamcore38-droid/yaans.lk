import { httpError } from './errors.js';

export function stringField(value, name, { required = false, maximum = 256, trim = true } = {}) {
  if (value === undefined) {
    if (required) throw httpError(400, `${name} is required.`);
    return '';
  }
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw httpError(400, `Invalid ${name}.`);
  const result = trim ? value.trim() : value;
  if (required && !result) throw httpError(400, `${name} is required.`);
  return result;
}

const commonPasswords = new Set(['passwordpassword', 'password123456789', '123456789012345', '1234567890123456', 'qwertyuiopasdfgh', 'administrator123', 'letmeinletmein123']);
export function validateNewPassword(value) {
  const password = stringField(value, 'Password', { required: true, maximum: 256, trim: false });
  if ([...password].length < 15 || Buffer.byteLength(password, 'utf8') > 72) throw httpError(400, 'Use a password of at least 15 characters and at most 72 UTF-8 bytes.');
  if (commonPasswords.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) throw httpError(400, 'Choose a less common password or a unique passphrase.');
  return password;
}

export function validateAuthBody(req, _res, next) {
  try {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw httpError(400, 'A JSON object is required.');
    const limits = { name:120, newName:120, email:254, newEmail:254, password:256, currentPassword:256, newPassword:256,
      phone:32, newPhone:32, defaultDistrict:80, district:80, city:120, storeName:120, sellerType:80, description:3000,
      businessAddress:500, nicOrBrNumber:80, bankName:120, branchName:120, accountHolderName:120, accountNumber:80,
      recipientName:120, label:80, addressLine1:256, addressLine2:256, postalCode:20, productId:128, addressId:128,
      challengeToken:2048, code:128 };
    for (const [name, maximum] of Object.entries(limits)) if (req.body[name] !== undefined) stringField(req.body[name], name, { maximum, trim: !/password/i.test(name) });
    for (const name of ['email','newEmail']) if (req.body[name] !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body[name].trim())) throw httpError(400, 'Enter a valid email address.');
    for (const name of ['phone','newPhone']) if (req.body[name] && !/^(?:0|\+?94)7\d{8}$/.test(req.body[name].replace(/[\s()-]/g, ''))) throw httpError(400, 'Enter a valid Sri Lankan mobile number.');
    if (req.body.isDefault !== undefined && typeof req.body.isDefault !== 'boolean') throw httpError(400, 'Invalid default address option.');
    next();
  } catch (error) { next(error); }
}

export function sanitizeHighlights(input, { maxItems = 20, maxItemLength = 300 } = {}) {
  if (!input) return [];
  const rawList = Array.isArray(input)
    ? input
    : String(input)
        .split(/;|\n/)
        .map((s) => s.trim())
        .filter(Boolean);
  return rawList
    .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter((item) => item.length > 0 && item.length <= maxItemLength && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(item))
    .slice(0, maxItems);
}

