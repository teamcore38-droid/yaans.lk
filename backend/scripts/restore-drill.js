import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { decryptBackup } from '../src/config/backupCrypto.js';
import { restoreBackup, assertRecoveryDatabase } from '../src/config/backupRepository.js';

// A dedicated user can write only this recovery database. Never use the app URI.
const target = 'yaans_restore_automated';
let connection;
try {
  if (!process.env.RESTORE_MONGODB_URI || !process.env.BACKUP_FILE || !process.env.BACKUP_PRIVATE_KEY_FILE) throw new Error('Restore URI, encrypted backup file and private key file are required.');
  const backup = mongoose.mongo.BSON.EJSON.parse(decryptBackup(await fs.readFile(process.env.BACKUP_FILE, 'utf8'), await fs.readFile(process.env.BACKUP_PRIVATE_KEY_FILE, 'utf8')).toString());
  connection = await mongoose.createConnection(process.env.RESTORE_MONGODB_URI, { dbName: target, maxPoolSize: 2, serverSelectionTimeoutMS: 10000 }).asPromise();
  const result = await restoreBackup(connection.db, backup);
  console.log(JSON.stringify({ ...result, sourceDatabase: backup.metadata.database, targetDatabase: target }));
  // Drop only the dedicated, successfully verified drill database. Partial or
  // mismatched restores are retained for investigation and block the next drill.
  assertRecoveryDatabase(connection.db);
  if (connection.db.databaseName !== target) throw new Error('Unexpected recovery database.');
  const restoredNames = Object.keys(backup.data);
  const presentNames = (await connection.db.listCollections().toArray()).map((entry) => entry.name);
  if (presentNames.some((name) => !restoredNames.includes(name))) throw new Error('Unexpected recovery collections appeared; cleanup was stopped.');
  // readWrite permits dropping its own collections without granting dbAdmin or
  // a database-wide administrative role to the recovery account.
  for (const name of restoredNames) await connection.db.collection(name).drop();
  console.log('Verified recovery drill database removed. Production and staging were not modified.');
} catch (error) { console.error('[Restore drill]', /Mongo/.test(error.name) ? `Recovery database operation failed (${error.code || error.name}).` : error.message); process.exitCode = 1; }
finally { await connection?.close(); }
