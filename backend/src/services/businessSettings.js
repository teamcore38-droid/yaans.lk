import { DEFAULT_BUSINESS_SETTINGS, businessSettings } from '../../../shared/businessSettings.js';
import { httpError } from '../config/errors.js';
import { isSafeInternalLink } from '../../../shared/safeLinks.js';
const bad = message => { throw httpError(400, message); };
const arrayShapes = {
  'returns.categoryOverrides': { slug: '', eligible: true, days: 7 },
  'returns.productOverrides': { id: '', eligible: true, days: 7 }
};
export function validateBusinessSettings(input) {
  if (!input || JSON.stringify(input).length > 60000) bad('Business settings are too large.');
  function validate(value, shape, path = '') {
    if (Array.isArray(shape)) {
      if (!Array.isArray(value) || value.length > (path.includes('Overrides') ? 100 : 30)) bad(`Invalid ${path}.`);
      const itemShape = arrayShapes[path] || shape[0];
      value.forEach(item => validate(item, itemShape, path + '[]'));
      return;
    }
    if (shape && typeof shape === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(shape, key)) || Object.keys(shape).some(key => !Object.hasOwn(value, key))) bad(`Invalid ${path || 'settings'} fields.`);
      for (const key of Object.keys(shape)) validate(value[key], shape[key], path ? `${path}.${key}` : key);
      return;
    }
    if (shape === null) {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) bad(`Invalid ${path}.`);
      return;
    }
    if (typeof value !== typeof shape) bad(`Invalid ${path}.`);
    if (typeof value === 'string') {
      const max = /^legal\.(terms|privacy|cookies)$/.test(path) ? 10000 : 1000;
      if (value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) bad(`Invalid ${path}.`);
      if (path.endsWith('href') && !isSafeInternalLink(value)) bad('Menu links must be internal marketplace links.');
      if (path.endsWith('logo') || path.endsWith('trackingUrl')) {
        if (value) {
          let safe = isSafeInternalLink(value);
          try { const url = new URL(value.replace('{tracking}', 'example')); safe ||= url.protocol === 'https:' && !url.username && !url.password; } catch {}
          if (!safe) bad('Use an HTTPS or internal URL.');
        }
      }
      if (/Email$/.test(path) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) bad('Invalid contact email.');
      if (/At$/.test(path) && value && !Number.isFinite(Date.parse(value))) bad('Invalid announcement date.');
    }
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > 1000000)) bad(`Invalid ${path}.`);
  }
  validate(input, DEFAULT_BUSINESS_SETTINGS);
  const integer = (value, min, max, label) => { if (!Number.isSafeInteger(value) || value < min || value > max) bad(`Invalid ${label}.`); };
  for (const key of ['days','refundMinDays','refundMaxDays']) integer(input.returns[key], 1, 90, key);
  if (input.returns.refundMinDays > input.returns.refundMaxDays) bad('Refund minimum exceeds maximum.');
  if (input.returns.cancelStatuses.some(status => !['pending_confirmation','confirmed','packed'].includes(status))) bad('Cancellation cannot be enabled after dispatch.');
  for (const rule of [...input.returns.categoryOverrides, ...input.returns.productOverrides]) { integer(rule.days, 1, 90, 'Return days'); if (!(rule.id || rule.slug)) bad('An override target is required.'); }
  integer(input.pricing.maxQuantityPerSelection, 1, 99, 'Quantity limit'); integer(input.pricing.maxCartSelections, 1, 50, 'Cart limit');
  integer(input.delivery.surchargeAfterItems, 0, 99, 'Surcharge threshold');
  integer(input.delivery.defaultPreparationDays, 0, 30, 'Preparation days'); integer(input.delivery.maxPreparationDays, input.delivery.defaultPreparationDays, 30, 'Maximum preparation days');
  if (input.delivery.defaultFreeShippingLkr > input.delivery.maxSellerFreeShippingLkr || input.delivery.defaultIntraDistrictFeeLkr > input.delivery.maxSellerIntraDistrictFeeLkr) bad('Seller defaults exceed limits.');
  for(const key of ['homemade','deals','recommended'])if(!['homemade','deals','featured','popular'].includes(input.home[key].source))bad('Choose a supported product collection.');
  if(input.delivery.sameDistrictDays.length>100||input.delivery.surchargePerItemLkr>10000||input.delivery.maxSellerIntraDistrictFeeLkr>10000)bad('Delivery rules exceed safe limits.');
  if(input.references.sellerTypes.some(type=>type.name.length>80))bad('Seller type names must be at most 80 characters.');
  for(const [key,field,max] of [['productOverrides','id',128],['categoryOverrides','slug',80]]){const rules=input.returns[key];if(rules.some(rule=>rule[field].length>max)||new Set(rules.map(rule=>rule[field])).size!==rules.length)bad('Invalid or duplicate return override.');}
  integer(input.home.intervalMs, 3000, 20000, 'Banner interval');
  for (const key of ['categories','homemade','deals','sellers','recommended']) { integer(input.home[key].limit, 1, 12, 'Section size'); integer(input.home[key].position, 1, 10, 'Section position'); }
  integer(input.legal.privacyResponseDays,1,90,'Privacy response target');
  for (const key of ['banks']) if (input.references[key].some(name=>!name.trim()||name.length>120)||new Set(input.references[key]).size!==input.references[key].length) bad('Reference names must be nonempty and unique.');
  if (!input.references.sellerTypes.some(type=>type.active)) bad('At least one seller type must remain active.');
  if(input.references.couriers.some(courier=>!courier.name.trim()||courier.name.length>120)||new Set(input.references.couriers.map(courier=>courier.name)).size!==input.references.couriers.length) bad('Courier names must be nonempty and unique.');
  if (!input.references.sellerTypes.length || !input.references.banks.length) bad('Reference lists cannot be empty.');
  for (const type of input.references.sellerTypes) if (!type.name.trim()) bad('Seller type name required.');
  if (new Set(input.references.sellerTypes.map(type => type.name)).size !== input.references.sellerTypes.length) bad('Seller type names must be unique.');
  if (input.catalog.priceBands.some(value => !Number.isFinite(value) || value <= 0)) bad('Invalid price bands.');
  if(input.announcements.startAt&&input.announcements.endAt&&Date.parse(input.announcements.startAt)>=Date.parse(input.announcements.endAt))bad('Announcement end must follow start.');
  for(const list of [input.returns.cancelReasons,input.returns.returnReasons])if(list.some(reason=>!reason.trim()||reason.length>120)||new Set(list).size!==list.length)bad('Reasons must be nonempty and unique.');
  if (!input.returns.cancelReasons.length || !input.returns.returnReasons.length) bad('Order reason lists cannot be empty.');
  return structuredClone(input);
}
export { businessSettings };
export function validateSellerShipping(policy, settings) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) bad('Invalid seller shipping policy.');
  for (const [key, max] of Object.entries({ freeShippingThresholdLkr: settings.delivery.maxSellerFreeShippingLkr, flatRateIntraLkr: settings.delivery.maxSellerIntraDistrictFeeLkr, preparationDays: settings.delivery.maxPreparationDays })) {
    if (policy[key] !== undefined && (typeof policy[key] !== 'number' || !Number.isFinite(policy[key]) || policy[key] < 0 || policy[key] > max || (key === 'preparationDays' && !Number.isInteger(policy[key])))) bad(`Invalid ${key}.`);
  }
  if (Object.keys(policy).some(key => !['freeShippingThresholdLkr','flatRateIntraLkr','preparationDays','dispatchTimeDays'].includes(key))) bad('Unsupported shipping policy field.');
  if (policy.dispatchTimeDays !== undefined && (typeof policy.dispatchTimeDays !== 'string' || policy.dispatchTimeDays.length > 100)) bad('Invalid dispatch time.');
}
