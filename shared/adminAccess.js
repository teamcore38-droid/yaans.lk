export const ADMIN_PERMISSIONS = Object.freeze({
  orders: 'Orders and support requests', products: 'Product content and moderation',
  productPricing: 'Product price overrides', productStock: 'Product stock overrides',
  sellers: 'Seller application review', merchandising: 'Categories and banners',
  reports: 'Operational reports', audit: 'Own operational audit history'
});
export const OPERATIONS_PRESET = Object.freeze(['orders', 'products', 'sellers', 'merchandising', 'audit']);
export const isOwner = user => user?.role === 'admin' && (user.adminAccess === undefined || user.adminAccess === null || user.adminAccess === 'owner');
export const isCoAdmin = user => user?.role === 'admin' && user.adminAccess === 'coadmin';
export const hasAdminPermission = (user, permission) => isOwner(user) || (isCoAdmin(user) && Array.isArray(user.adminPermissions) && user.adminPermissions.includes(permission));
export const adminSetupRequired = user => user?.role === 'admin' && (!user.adminMfa?.enabled || user.adminMustChangePassword === true);
