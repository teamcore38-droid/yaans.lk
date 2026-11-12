import mongoose from 'mongoose';
import { ensureCatalogIndexes } from '../src/config/catalogIndexes.js';

let connection;
try {
  const target = { staging: 'yaans_staging_lk', production: 'yaans_lk' }[process.env.APP_ENV];
  if (!target || process.env.MONGODB_DB_NAME !== target || !process.env.MONGODB_URI) throw new Error('Set an explicit matching application environment, database name and scoped URI.');
  connection = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: target, maxPoolSize: 2, autoIndex: false, serverSelectionTimeoutMS: 10000 }).asPromise();
  const names = await ensureCatalogIndexes(connection.db);
  console.log(JSON.stringify({ database: target, indexes: names, completed: true }));
} catch (error) {
  console.error('[Catalog indexes]', /Mongo/.test(error.name) ? `Database index preparation failed (${error.code || error.name}).` : error.message);
  process.exitCode = 1;
} finally { await connection?.close(); }
