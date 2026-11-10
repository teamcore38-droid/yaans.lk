import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import mongoose from 'mongoose';
import * as models from '../src/models/schemas.js';
import { getInitialSeedState } from '../src/seed/initialState.js';

test('coalesces Mongo refreshes and preserves edits made during a refresh', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'yaans-refresh-test-'));
  const previousEnvironment = { TEMP: process.env.TEMP, TMP: process.env.TMP, VERCEL: process.env.VERCEL, MONGODB_URI: process.env.MONGODB_URI };
  Object.assign(process.env, { TEMP: temporaryDirectory, TMP: temporaryDirectory, VERCEL: '1', MONGODB_URI: 'mongodb://isolated.invalid/test' });
  const restore = [];
  const mock = (object, key, value) => {
    const previous = object[key];
    object[key] = value;
    restore.push(() => { object[key] = previous; });
  };
  let reads = 0;
  const seed = getInitialSeedState();
  assert.equal(seed.users[0].passwordHash, getInitialSeedState().users[0].passwordHash);
  assert.notEqual(seed.users[0], getInitialSeedState().users[0]);
  const delayed = (value) => ({ lean: async () => {
    reads++;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return structuredClone(value);
  } });
  try {
    mock(mongoose, 'connect', async () => mongoose);
    for (const [name, collection] of Object.entries({ UserModel: 'users', SellerModel: 'sellers', CategoryModel: 'categories', ProductModel: 'products', ReviewModel: 'reviews', SubOrderModel: 'subOrders', OrderModel: 'orders', SettlementModel: 'settlements' })) {
      mock(models[name], 'find', () => delayed(seed[collection]));
      mock(models[name].collection, 'bulkWrite', async () => ({}));
      mock(models[name].collection, 'deleteMany', async () => ({}));
    }
    mock(models.PlatformConfigModel, 'findOne', () => delayed(seed.platformConfig));
    mock(models.PlatformConfigModel.collection, 'countDocuments', async () => 1);
    mock(models.PlatformConfigModel.collection, 'updateOne', async () => ({}));
    const db = await import('../src/config/db.js');
    const connection = await db.connectDatabase();
    assert.equal(connection.isMongoConnected, true);
    reads = 0;
    await Promise.all(Array.from({ length: 12 }, () => db.loadStoreFromMongo()));
    assert.equal(reads, 9, '12 simultaneous callers should share one batch of 9 collection reads');
    const refreshing = db.loadStoreFromMongo();
    db.getStore().categories[0].name = 'An edit made while queries were running';
    db.persistStore();
    await refreshing;
    assert.equal(db.getStore().categories[0].name, 'An edit made while queries were running');
    await db.syncStoreToMongo();
  } finally {
    restore.reverse().forEach((undo) => undo());
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const directory = path.join(temporaryDirectory, 'yaans_lk_data');
    const file = path.join(directory, 'yaans_db.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(directory)) fs.rmdirSync(directory);
    fs.rmdirSync(temporaryDirectory);
  }
});
