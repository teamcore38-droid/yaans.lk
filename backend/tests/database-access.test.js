import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExpectedPermissionDenial } from '../src/config/databaseAccess.js';

const readProbe = { action: 'find', namespace: 'yaans_lk.users' };
test('database isolation recognizes standard and Atlas-specific expected denials', () => {
  assert.equal(isExpectedPermissionDenial({ code: 13 }, readProbe), true);
  assert.equal(isExpectedPermissionDenial({ codeName: 'Unauthorized' }, readProbe), true);
  assert.equal(isExpectedPermissionDenial({ code: 8000, message: 'user is not allowed to do action [find] on [yaans_lk.users]' }, readProbe), true);
  assert.equal(isExpectedPermissionDenial({ message: 'user is not allowed to do action [update] on [yaans_lk.users]' }, { action: 'update', namespace: 'yaans_lk.users' }), true);
});
test('authentication, network and unexpected operation/namespace errors do not prove isolation', () => {
  for (const error of [undefined, { code: 18, message: 'Authentication failed' }, { code: 8000, message: 'bad auth : authentication failed' },
    { message: 'Network timeout' }, { message: 'user is not allowed to do action [find] on [other.users]' },
    { message: 'user is not allowed to do action [update] on [yaans_lk.users]' }]) {
    assert.equal(isExpectedPermissionDenial(error, readProbe), false);
  }
  assert.equal(isExpectedPermissionDenial({ code: 13 }, { action: 'delete', namespace: 'yaans_lk.users' }), false);
  assert.equal(isExpectedPermissionDenial({ code: 13 }, { action: 'find', namespace: 'other.users' }), false);
});
