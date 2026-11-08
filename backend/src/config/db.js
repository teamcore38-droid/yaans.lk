import fs from 'fs';
import os from 'os';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import {
  UserModel,
  SellerModel,
  CategoryModel,
  ProductModel,
  ReviewModel,
  SubOrderModel,
  OrderModel,
  SettlementModel,
  PlatformConfigModel
} from '../models/schemas.js';
import { getInitialSeedState } from '../seed/initialState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /tmp on serverless platforms (Vercel) where the deployment folder is read-only
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'yaans_lk_data')
  : path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'yaans_db.json');

let isMongoConnected = false;
let connectionPromise = null;
let memoryStore = null;
let isDirty = false;
let lastMongoSyncTime = 0;

const MODEL_MAP = {
  users: UserModel,
  sellers: SellerModel,
  categories: CategoryModel,
  products: ProductModel,
  reviews: ReviewModel,
  subOrders: SubOrderModel,
  orders: OrderModel,
  settlements: SettlementModel,
  platformConfig: PlatformConfigModel
};

function safeWriteLocalCache(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (_err) {
    // Ignore filesystem write errors in restricted serverless containers
  }
}

function ensureLocalStoreLoaded(forceReset = false) {
  if (!forceReset && memoryStore) {
    return memoryStore;
  }
  if (!forceReset && fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryStore = JSON.parse(raw);
      return memoryStore;
    } catch (_err) {
      // Rebuild from seed state
    }
  }
  memoryStore = getInitialSeedState();
  safeWriteLocalCache(memoryStore);
  return memoryStore;
}

/**
 * Loads all collections from MongoDB Atlas into memoryStore
 */
export async function loadStoreFromMongo() {
  if (!isMongoConnected) return ensureLocalStoreLoaded(false);
  try {
    const [
      users,
      sellers,
      categories,
      products,
      reviews,
      subOrders,
      orders,
      settlements,
      platformConfigDoc
    ] = await Promise.all([
      UserModel.find({}).lean(),
      SellerModel.find({}).lean(),
      CategoryModel.find({}).lean(),
      ProductModel.find({}).lean(),
      ReviewModel.find({}).lean(),
      SubOrderModel.find({}).lean(),
      OrderModel.find({}).lean(),
      SettlementModel.find({}).lean(),
      PlatformConfigModel.findOne({ key: 'main_config' }).lean()
    ]);

    const seedFallback = getInitialSeedState();
    memoryStore = {
      users: users.map((d) => ({ ...d, _id: String(d._id) })),
      sellers: sellers.map((d) => ({ ...d, _id: String(d._id) })),
      categories: categories.map((d) => ({ ...d, _id: String(d._id) })),
      products: products.map((d) => ({ ...d, _id: String(d._id) })),
      reviews: reviews.map((d) => ({ ...d, _id: String(d._id) })),
      subOrders: subOrders.map((d) => ({ ...d, _id: String(d._id) })),
      orders: orders.map((d) => ({ ...d, _id: String(d._id) })),
      settlements: settlements.map((d) => ({ ...d, _id: String(d._id) })),
      platformConfig: platformConfigDoc
        ? { ...platformConfigDoc, _id: String(platformConfigDoc._id) }
        : seedFallback.platformConfig
    };
    lastMongoSyncTime = Date.now();
    safeWriteLocalCache(memoryStore);
    return memoryStore;
  } catch (err) {
    console.warn('[Yaans.lk DB] Error loading from MongoDB, using cached store:', err.message);
    return ensureLocalStoreLoaded(false);
  }
}

/**
 * Flushes any in-memory mutations back to MongoDB Atlas collections
 */
export async function syncStoreToMongo() {
  if (!isMongoConnected || !memoryStore || !isDirty) return;
  isDirty = false;
  try {
    const replaceCollection = async (Model, docs) => {
      await Model.deleteMany({});
      if (Array.isArray(docs) && docs.length > 0) {
        const cleanDocs = docs.map(({ _id, __v, ...rest }) => ({
          ...rest,
          ...(mongoose.Types.ObjectId.isValid(_id) ? { _id } : {})
        }));
        await Model.insertMany(cleanDocs, { ordered: false });
      }
    };

    // Wait: to preserve string IDs like 'prd_1', 'sel_kandy_1', 'usr_cust_1' in MongoDB native collection,
    // we can use Model.collection (the native MongoDB driver collection!) which allows string _id values directly!
    const syncNativeCollection = async (Model, docs) => {
      const col = Model.collection;
      await col.deleteMany({});
      if (Array.isArray(docs) && docs.length > 0) {
        await col.insertMany(docs.map((d) => ({ ...d })));
      }
    };

    await Promise.all([
      syncNativeCollection(UserModel, memoryStore.users),
      syncNativeCollection(SellerModel, memoryStore.sellers),
      syncNativeCollection(CategoryModel, memoryStore.categories),
      syncNativeCollection(ProductModel, memoryStore.products),
      syncNativeCollection(ReviewModel, memoryStore.reviews),
      syncNativeCollection(SubOrderModel, memoryStore.subOrders),
      syncNativeCollection(OrderModel, memoryStore.orders),
      syncNativeCollection(SettlementModel, memoryStore.settlements)
    ]);

    if (memoryStore.platformConfig) {
      await PlatformConfigModel.collection.deleteMany({});
      await PlatformConfigModel.collection.insertOne({ ...memoryStore.platformConfig });
    }
    lastMongoSyncTime = Date.now();
  } catch (err) {
    console.error('[Yaans.lk DB] Failed syncing to MongoDB Atlas:', err.message);
  }
}

export function persistStore() {
  if (!memoryStore) return;
  isDirty = true;
  safeWriteLocalCache(memoryStore);
  if (isMongoConnected) {
    // Trigger async sync (also awaited by server middleware on mutating requests)
    syncStoreToMongo().catch(() => {});
  }
}

export async function connectDatabase() {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    const shouldTryMongo =
      uri &&
      (uri.startsWith('mongodb+srv://') ||
        process.env.USE_EXTERNAL_MONGO === 'true' ||
        !uri.includes('127.0.0.1'));

    if (shouldTryMongo) {
      try {
        if (!IS_SERVERLESS && uri.startsWith('mongodb+srv://')) {
          try {
            dns.setServers(['8.8.8.8', '1.1.1.1']);
          } catch (_e) {
            // ignore
          }
        }
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 8000,
          dbName: process.env.MONGODB_DB_NAME || 'yaans_lk'
        });
        isMongoConnected = true;
        console.log('[Yaans.lk DB] Connected to MongoDB Atlas via Mongoose!');

        const count = await ProductModel.collection.countDocuments();
        if (count === 0) {
          console.log('[Yaans.lk DB] Seeding initial Sri Lankan marketplace data into MongoDB Atlas...');
          await seedMongoDatabase();
        } else {
          await loadStoreFromMongo();
        }
      } catch (err) {
        console.warn(
          '[Yaans.lk DB] MongoDB connection fallback to local document store:',
          err.message
        );
        isMongoConnected = false;
      }
    }

    ensureLocalStoreLoaded(false);
    return {
      isMongoConnected,
      storePath: isMongoConnected ? 'MongoDB Atlas (yaans_lk)' : DB_FILE
    };
  })();

  return connectionPromise;
}

export async function refreshStoreIfNeeded() {
  if (isMongoConnected && !isDirty && Date.now() - lastMongoSyncTime > 5000) {
    await loadStoreFromMongo();
  }
}

export async function seedMongoDatabase() {
  const seed = getInitialSeedState();
  memoryStore = seed;
  safeWriteLocalCache(seed);
  if (isMongoConnected) {
    isDirty = true;
    await syncStoreToMongo();
  }
}

export function getStore() {
  return ensureLocalStoreLoaded(false);
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export { MODEL_MAP };
