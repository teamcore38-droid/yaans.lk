import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { buildTestStore } from '../../../tests/support/fixtures.js';

export async function startIsolatedApp(port = 0) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(temporaryRoot, 'yaans-test-'));
  const removeTemporaryDirectory = async () => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), temporaryRoot);
    assert.ok(path.basename(resolved).startsWith('yaans-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  };
  let mongo;
  let server;
  const overrides = {
    NODE_ENV: 'test', VERCEL: '1', TEMP: directory, TMP: directory,
    MAINTENANCE_READ_ONLY: '',
    JWT_SECRET: 'yaans-automated-tests-only-secret-32chars',
    MONGODB_DB_NAME: 'yaans_automated_test', USE_EXTERNAL_MONGO: 'true',
    CLOUDINARY_URL: '', CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: ''
  };
  const previous = Object.fromEntries([...Object.keys(overrides), 'MONGODB_URI'].map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, overrides);
    // Always create our own loopback-only MongoDB. Inherited MONGODB_URI is never used.
    mongo = await MongoMemoryReplSet.create({
      binary: { version: '7.0.14' },
      replSet: { count: 1, dbName: overrides.MONGODB_DB_NAME, ip: '127.0.0.1', storageEngine: 'wiredTiger' }
    });
    process.env.MONGODB_URI = mongo.getUri();
    const { default: app } = await import('../../src/server.js');
    const db = await import('../../src/config/db.js');
    assert.equal((await db.connectDatabase()).isMongoConnected, true, 'Tests require real temporary MongoDB; fallback must not pass');
    const fixtures = buildTestStore();
    for (const [collection, model] of Object.entries(db.MODEL_MAP)) {
      await model.collection.deleteMany({});
      const docs = collection === 'platformConfig' ? [{ ...fixtures.platformConfig, key: 'main_config' }] : fixtures[collection];
      if (docs.length) await model.collection.insertMany(docs);
    }
    for (const model of Object.values(db.MODEL_MAP)) await model.createIndexes();
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(port, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    return {
      url: `http://127.0.0.1:${server.address().port}`,
      app,
      db,
      mongo: mongoose.connection.db,
      mongoUri: mongo.getUri(),
      async reset() {
        assert.match(process.env.MONGODB_URI, /^mongodb:\/\/127\.0\.0\.1:/);
        assert.equal(mongoose.connection.name, overrides.MONGODB_DB_NAME);
        const fixtures = buildTestStore();
        for (const [key, model] of Object.entries(db.MODEL_MAP)) {
          await model.collection.deleteMany({});
          const values = key === 'platformConfig' ? [{ ...fixtures.platformConfig, key: 'main_config' }] : fixtures[key];
          if (values.length) await model.collection.insertMany(values);
        }
        for (const name of ['counters', 'checkoutrequests']) await mongoose.connection.db.collection(name).deleteMany({});
      },
      async close() {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await mongoose.disconnect();
        await mongo.stop();
        await removeTemporaryDirectory();
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    };
  } catch (error) {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo?.stop();
    await removeTemporaryDirectory();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    throw error;
  }
}
