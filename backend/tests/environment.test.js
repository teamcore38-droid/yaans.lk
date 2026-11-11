import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseName } from '../src/config/environment.js';

test('writable previews and staging cannot select the production database', () => {
  assert.throws(() => databaseName({ APP_ENV: 'staging', MONGODB_DB_NAME: 'yaans_lk' }));
  assert.throws(() => databaseName({ VERCEL_ENV: 'preview', MONGODB_DB_NAME: 'yaans_lk' }));
  assert.equal(databaseName({ VERCEL_ENV: 'preview', MAINTENANCE_READ_ONLY: 'true' }), 'yaans_lk');
  assert.equal(databaseName({ VERCEL_ENV: 'preview', APP_ENV: 'staging', MONGODB_DB_NAME: 'yaans_staging_lk' }), 'yaans_staging_lk');
});
