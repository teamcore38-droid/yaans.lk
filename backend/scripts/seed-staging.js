import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { buildTestStore } from '../../tests/support/fixtures.js';
import { MODEL_MAP } from '../src/config/db.js';

let connection;
try {
  if (process.env.APP_ENV !== 'staging' || process.env.MONGODB_DB_NAME !== 'yaans_staging_lk') throw new Error('This script requires the isolated staging environment.');
  const password = process.env.STAGING_ACCOUNT_PASSWORD;
  if (!password || password.length < 16) throw new Error('A private staging account password of at least 16 characters is required.');
  connection = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: 'yaans_staging_lk', maxPoolSize: 2, serverSelectionTimeoutMS: 10000, autoIndex: false }).asPromise();
  const db = connection.db;
  const existing = await db.listCollections().toArray();
  const marker = await db.collection('_stagingcontrol').findOne({ _id: 'synthetic-fixtures-v1' });
  if (existing.length && !marker) throw new Error('Staging contains unrecognized data. No records were replaced.');
  const fixture = buildTestStore();
  const hash = await bcrypt.hash(password, 12);
  for (const user of fixture.users) user.passwordHash = hash;
  const session = connection.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [key, values] of Object.entries(fixture)) {
        const name = key === 'platformConfig' ? 'platformconfigs' : key === 'subOrders' ? 'suborders' : key;
        const docs = key === 'platformConfig' ? [{ ...values, key: 'main_config' }] : values;
        for (const doc of docs) await db.collection(name).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true, session });
      }
      await db.collection('_stagingcontrol').updateOne({ _id: 'synthetic-fixtures-v1' }, { $setOnInsert: { createdAt: new Date(), syntheticOnly: true } }, { upsert: true, session });
    });
  } finally { await session.endSession(); }
  for (const model of Object.values(MODEL_MAP)) await connection.model(model.modelName, model.schema).createIndexes();
  console.log('Synthetic staging accounts, sellers and products initialized. Existing staging orders were preserved.');
} catch (error) { console.error('[Staging setup]', error.message); process.exitCode = 1; }
finally { await connection?.close(); }
