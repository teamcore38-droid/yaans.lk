import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

const transient = new Set(['ratelimits', 'operationalmetrics', '_restorecontrol']);
const ejson = mongoose.mongo.BSON.EJSON;
const validName = (name) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && !transient.has(name);
const digest = (docs) => createHash('sha256').update(ejson.stringify([...docs].sort((a, b) => ejson.stringify(a._id, { relaxed: false }).localeCompare(ejson.stringify(b._id, { relaxed: false }))), { relaxed: false })).digest('hex');

export async function captureBackup(db) {
  const data = Object.create(null), indexes = Object.create(null);
  const names = (await db.listCollections().toArray()).map((value) => value.name).filter(validName).sort();
  for (const name of names) indexes[name] = await db.collection(name).listIndexes().toArray();
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of names) data[name] = await db.collection(name).find({}, { session }).toArray();
    }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
  } finally { await session.endSession(); }
  return { metadata: { format: 2, createdAt: new Date(), database: db.databaseName }, data, indexes };
}

export function validateBackup(backup) {
  if (!backup || backup.metadata?.format !== 2 || !backup.data || !backup.indexes || Array.isArray(backup.data)) throw new Error('Invalid backup manifest.');
  for (const [name, docs] of Object.entries(backup.data)) {
    if (!validName(name) || !Array.isArray(docs) || !Array.isArray(backup.indexes[name])) throw new Error('Invalid backup collection.');
    for (const index of backup.indexes[name]) {
      if (!index || typeof index.name !== 'string' || !index.key || typeof index.key !== 'object') throw new Error('Invalid backup index.');
    }
  }
}

export function assertRecoveryDatabase(db) {
  if (!/^yaans_restore_[a-zA-Z0-9_]+$/.test(db.databaseName)) throw new Error('Restore requires a separate yaans_restore_<name> database.');
}

export async function verifyBackup(db, backup) {
  validateBackup(backup);
  const result = {};
  for (const [name, expected] of Object.entries(backup.data)) {
    const actual = await db.collection(name).find({}).toArray();
    if (digest(actual) !== digest(expected)) throw new Error(`Restored collection verification failed: ${name}`);
    const actualIndexes = await db.collection(name).listIndexes().toArray();
    for (const index of backup.indexes[name]) {
      const restored = actualIndexes.find((entry) => entry.name === index.name);
      const fields = ['key', 'unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression', 'collation'];
      if (!restored || fields.some((field) => JSON.stringify(restored[field]) !== JSON.stringify(index[field]))) throw new Error(`Restored index verification failed: ${name}/${index.name}`);
    }
    result[name] = actual.length;
  }
  return { verified: true, collectionCounts: result, checks: ['document contents', 'BSON identifiers and dates', 'indexes and uniqueness', 'accounts', 'orders', 'inventory', 'cash ledger'] };
}

export async function restoreBackup(db, backup) {
  assertRecoveryDatabase(db); validateBackup(backup);
  if ((await db.listCollections().toArray()).length) throw new Error('The restore database must be empty.');
  for (const [name, docs] of Object.entries(backup.data)) {
    await db.createCollection(name);
    if (docs.length) await db.collection(name).insertMany(docs);
    for (const index of backup.indexes[name]) {
      if (index.name === '_id_') continue;
      const options = Object.fromEntries(['name', 'unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression', 'collation']
        .filter((key) => index[key] !== undefined).map((key) => [key, index[key]]));
      await db.collection(name).createIndex(index.key, options);
    }
  }
  return verifyBackup(db, backup);
}
