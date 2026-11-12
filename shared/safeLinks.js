// Banner calls to action are internal marketplace routes, never executable URLs.
export function isSafeInternalLink(value) {
  return typeof value === 'string' && value.length <= 2048 && value.startsWith('/') &&
    !value.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(value) &&
    !/%(?:0[0-9a-f]|1[0-9a-f]|20|5c|7f)/i.test(value) && !/^\/%2f/i.test(value);
}
export function safeInternalLink(value, fallback = '/products') {
  return isSafeInternalLink(value) ? value : fallback;
}
