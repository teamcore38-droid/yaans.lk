// Call only after a successful operation on the account's intended database,
// and only for the deliberately forbidden operation being tested.
export function isExpectedPermissionDenial(error, { action, namespace }) {
  if (!['find', 'update'].includes(action) || namespace !== 'yaans_lk.users') return false;
  if (error?.code === 13 || error?.codeName === 'Unauthorized') return true;
  // Atlas may report a service-specific code for this exact denial instead of
  // MongoDB's standard Unauthorized code. Authentication and network failures
  // must never be treated as proof of isolation.
  const message = String(error?.message || '').trim().replace(/\s+/g, ' ');
  return message === `user is not allowed to do action [${action}] on [${namespace}]` ||
    message === `user is not allowed to do action [${action}] on [${namespace}].`;
}
