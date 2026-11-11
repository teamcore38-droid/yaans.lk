import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, withTransaction, MODEL_MAP } from '../config/db.js';
import { getInitialSeedState } from './initialState.js';

dotenv.config();
// Explicit bootstrap only. Existing settings/catalogue and all accounts are preserved.
try {
  await connectDatabase();
  const defaults = getInitialSeedState();
  await withTransaction(async (session) => {
    for (const category of defaults.categories) {
      await MODEL_MAP.categories.collection.updateOne({ _id: category._id }, { $setOnInsert: category }, { upsert: true, session });
    }
    await MODEL_MAP.platformConfig.collection.updateOne({ key: 'main_config' },
      { $setOnInsert: { ...defaults.platformConfig, key: 'main_config' } }, { upsert: true, session });
  });
  console.log('Missing categories/settings initialized. No user, order or existing setting was replaced. Provision an administrator separately.');
} catch (error) { console.error('Initialization failed:', error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
