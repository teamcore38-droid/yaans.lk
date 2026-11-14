import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { UserModel, SellerModel, CategoryModel, ProductModel, ReviewModel, SubOrderModel, OrderModel, SettlementModel, PlatformConfigModel } from '../models/schemas.js';
import { httpError } from './errors.js';
import { ensureOperationalIndexes } from './operations.js';
import { databaseName } from './environment.js';

export const MODEL_MAP = {
  users: UserModel, sellers: SellerModel, categories: CategoryModel, products: ProductModel,
  reviews: ReviewModel, subOrders: SubOrderModel, orders: OrderModel,
  settlements: SettlementModel, platformConfig: PlatformConfigModel
};
let connectionPromise;
const snapshot = Symbol('database unit of work');
const clone = (value) => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value, { relaxed: false }));

// Reuse connections, never authoritative business records, across requests.
export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    await ensureOperationalIndexes(mongoose.connection.db);
    return { isMongoConnected: true, storePath: 'MongoDB Atlas' };
  }
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const uri = process.env.MONGODB_URI;
      if (!uri) throw httpError(503, 'The database is unavailable. Please try again later.');
      await mongoose.connect(uri, {
        dbName: databaseName(), serverSelectionTimeoutMS: 8000,
        waitQueueTimeoutMS: 3000, maxPoolSize: 10, minPoolSize: 0, autoIndex: false
      });
      await ensureOperationalIndexes(mongoose.connection.db);
      return { isMongoConnected: true, storePath: 'MongoDB Atlas' };
    })().finally(() => { connectionPromise = undefined; });
  }
  return connectionPromise;
}

export function idFilter(id) {
  if (typeof id !== 'string' || !id) throw httpError(400, 'A valid record ID is required.');
  return mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id)
    ? { $or: [{ _id: id }, { _id: new mongoose.Types.ObjectId(id) }] } : { _id: id };
}

export async function withTransaction(work) {
  await connectDatabase();
  const session = await mongoose.connection.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
      readPreference: 'primary', maxCommitTimeMS: 10000
    });
  } finally { await session.endSession(); }
}

// Request-local units of work contain only explicitly selected collections/IDs.
export async function getStore(selection, { session, compactConfig = false } = {}) {
  if (!selection || typeof selection !== 'object') throw new Error('Explicit database selection is required');
  await connectDatabase();
  const store = Object.fromEntries(Object.keys(MODEL_MAP).map((key) => [key, key === 'platformConfig' ? null : []]));
  Object.defineProperty(store, snapshot, { value: { records: new Map(), session, compactConfig } });
  return loadCollections(store, selection);
}

export async function loadCollections(store, selection) {
  const state = store[snapshot];
  if (!state) throw new Error('A database unit of work is required');
  for (const [key, filter] of Object.entries(selection)) {
    if (!MODEL_MAP[key] || !filter) throw new Error(`Invalid database selection: ${key}`);
    if (state.records.has(key)) throw new Error(`Collection already loaded: ${key}`);
    const query = key === 'platformConfig' ? { key: 'main_config' } : filter === true ? {} : filter;
    const docs = await MODEL_MAP[key].collection.find(query, { session: state.session, ...(key === 'platformConfig' && state.compactConfig ? {projection:{businessDraft:0,businessHistory:0,adminAuditLogs:0}} : {}) }).toArray();
    const before = new Map();
    const values = docs.map((doc) => {
      const { _writeVersion, ...value } = doc;
      value._id = String(doc._id);
      before.set(value._id, { value: clone(value), rawId: doc._id, version: _writeVersion });
      return value;
    });
    state.records.set(key, before);
    store[key] = key === 'platformConfig' ? values[0] || null : values;
    if (key === 'platformConfig' && !store[key]) throw httpError(503, 'Marketplace settings are not configured.');
  }
  return store;
}

function validateProduct(product) {
  if (!Number.isSafeInteger(product.stock) || product.stock < 0 || !Number.isFinite(product.priceLkr) || product.priceLkr <= 0) {
    throw httpError(400, 'Product stock must be a non-negative integer and price must be positive.');
  }
  for (const group of product.variants || []) {
    for (const option of group.values || []) {
      if (!Number.isSafeInteger(option.stock) || option.stock < 0 || !Number.isFinite(option.priceLkr) || option.priceLkr <= 0) {
        throw httpError(400, 'Variant stock and prices are invalid.');
      }
    }
  }
}

export async function persistStore(store) {
  const state = store?.[snapshot];
  if (!state) throw new Error('Writes require an explicit database unit of work');
  const changes = [];
  for (const key of Object.keys(MODEL_MAP)) {
    if (!state.records.has(key) && (key === 'platformConfig' ? store[key] : store[key].length)) {
      throw new Error(`Cannot write an unselected collection: ${key}`);
    }
  }
  for (const [key, before] of state.records) {
    const after = key === 'platformConfig' ? (store[key] ? [store[key]] : []) : store[key];
    const seen = new Set();
    for (const doc of after) {
      if (typeof doc._id !== 'string' || seen.has(doc._id)) throw new Error('Invalid or duplicate record ID');
      seen.add(doc._id);
      const previous = before.get(doc._id);
      if (previous && isDeepStrictEqual(previous.value, doc)) continue;
      if (key === 'products') validateProduct(doc);
      if (!previous) { changes.push({ key, type: 'insert', doc: { ...clone(doc), _writeVersion: 1 } }); continue; }
      const set = Object.create(null), unset = Object.create(null);
      for (const field of new Set([...Object.keys(previous.value), ...Object.keys(doc)])) {
        if (field === '_id' || field === '_writeVersion' || isDeepStrictEqual(previous.value[field], doc[field])) continue;
        if (doc[field] === undefined) unset[field] = '';
        else set[field] = clone(doc[field]);
      }
      changes.push({ key, type: 'update', previous, set, unset });
    }
    for (const [id, previous] of before) if (!seen.has(id)) changes.push({ key, type: 'delete', previous });
  }
  const write = async (session) => {
    // MongoDB transactions must execute operations sequentially.
    for (const change of changes) {
      const collection = MODEL_MAP[change.key].collection;
      if (change.type === 'insert') { await collection.insertOne(change.doc, { session }); continue; }
      const filter = { _id: change.previous.rawId,
        _writeVersion: change.previous.version === undefined ? { $exists: false } : change.previous.version };
      const result = change.type === 'delete'
        ? await collection.deleteOne(filter, { session })
        : await collection.updateOne(filter, {
          ...(Object.keys(change.set).length ? { $set: change.set } : {}),
          ...(Object.keys(change.unset).length ? { $unset: change.unset } : {}),
          $inc: { _writeVersion: 1 }
        }, { session });
      if ((change.type === 'delete' ? result.deletedCount : result.matchedCount) !== 1) {
        throw httpError(409, 'This record changed during your request. Refresh and try again.', 'WRITE_CONFLICT');
      }
    }
    if (store.securityAuditEvents?.length) await mongoose.connection.db.collection('securityevents').insertMany(store.securityAuditEvents, { session });
  };
  if (changes.length) {
    if (state.session) await write(state.session);
    else await withTransaction(write);
  }
}

export async function findUserById(id) {
  await connectDatabase();
  const user = await UserModel.collection.findOne(idFilter(id));
  return user ? { ...user, _id: String(user._id) } : null;
}

export async function pingDatabase() {
  await connectDatabase();
  await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
}

export function generateId(prefix = 'id') { return `${prefix}_${randomUUID()}`; }
