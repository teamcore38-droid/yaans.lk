import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { buildTestStore } from '../../../tests/support/fixtures.js';

export async function startIsolatedApp(port = 0, { monitorCommands = false } = {}) {
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
    ORDER_EMAIL_ENABLED: 'false', RESEND_API_KEY: '', RESEND_EMAIL_DOMAIN: '', ORDER_EMAIL_FROM: '', ORDER_EMAIL_WORKER_SECRET: '',
    NODE_ENV: 'test', VERCEL: '1', VERCEL_ENV: 'test', APP_ENV: 'test', TEMP: directory, TMP: directory,
    MAINTENANCE_READ_ONLY: '',
    JWT_SECRET: 'yaans-automated-tests-only-secret-32chars',
    MFA_ENCRYPTION_KEY: Buffer.alloc(32,7).toString('base64'),
    GOOGLE_LOGIN_ENABLED: 'false', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_LOGIN_ORIGIN: '',
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
    const originalConnect = mongoose.connect;
    try {
      if (monitorCommands) mongoose.connect = (uri, options) => originalConnect.call(mongoose, uri, { ...options, monitorCommands: true });
      assert.equal((await db.connectDatabase()).isMongoConnected, true, 'Tests require real temporary MongoDB; fallback must not pass');
    } finally { mongoose.connect = originalConnect; }
    const fixtures = buildTestStore();
    for (const [collection, model] of Object.entries(db.MODEL_MAP)) {
      await model.collection.deleteMany({});
      const docs = collection === 'platformConfig' ? [{ ...fixtures.platformConfig, key: 'main_config' }] : fixtures[collection];
      if (docs.length) await model.collection.insertMany(docs);
    }
    for (const model of Object.values(db.MODEL_MAP)) await model.createIndexes();
    // Port 0 can rarely select a Fetch-standard forbidden port on Windows.
    // Retry that allocation only; never mask application/network failures.
    for (let attempt = 0; attempt < 5; attempt++) {
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(port, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    // A non-API 404 probe validates Fetch compatibility without spending any
    // production API rate-limit budget or touching business data.
    try { const probe = await fetch(`http://127.0.0.1:${server.address().port}/__test/port-probe`); await probe.arrayBuffer(); break; }
    catch (error) {
      if (port !== 0 || error.cause?.message !== 'bad port' || attempt === 4) throw error;
      await new Promise(resolve => server.close(resolve)); server = undefined;
    }
    }
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
        for (const name of ['operationrequests', 'orderdocuments', 'orderemailjobs', 'orderemailbudgets', 'businesspublications', 'staffsessions', 'ordernotifications', 'counters', 'checkoutrequests', 'cashmovements', 'ratelimits', 'operationalmetrics', 'authchallenges', 'securityevents', 'reviewclaims']) await mongoose.connection.db.collection(name).deleteMany({});
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
