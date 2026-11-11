import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createPublicKey } from 'node:crypto';
import { encryptBackup, decryptBackup } from '../src/config/backupCrypto.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const option = (name) => process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const restore = option('restore');
  let backup;
  let publicKey;
  if (restore) {
    const keyFile = option('private-key') || process.env.BACKUP_PRIVATE_KEY_FILE;
    if (!keyFile) throw new Error('A private key file is required to restore an encrypted backup.');
    backup = mongoose.mongo.BSON.EJSON.parse(decryptBackup(await fs.readFile(restore, 'utf8'), await fs.readFile(keyFile, 'utf8')).toString());
    if (!backup.data || !backup.indexes || backup.metadata?.format !== 2) throw new Error('Invalid backup manifest.');
  } else {
    const keyFile = option('public-key') || process.env.BACKUP_PUBLIC_KEY_FILE;
    if (!keyFile) throw new Error('Refusing an unencrypted export. Configure BACKUP_PUBLIC_KEY_FILE or --public-key=<file>.');
    publicKey = createPublicKey(await fs.readFile(keyFile, 'utf8'));
    if (publicKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyDetails.modulusLength < 3072) throw new Error('Use an RSA public key of at least 3072 bits.');
  }
  const target = restore ? option('target-db') : process.env.MONGODB_DB_NAME || 'yaans_lk';
  if (restore && !/^yaans_restore_[a-zA-Z0-9_]+$/.test(target || '')) throw new Error('Restore requires a separate --target-db=yaans_restore_<name>. Existing databases are never erased.');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. No local-store fallback is permitted.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: target, serverSelectionTimeoutMS: 10000, maxPoolSize: 2, autoIndex: false });
  const db = mongoose.connection.db;
  if (restore) {
    if ((await db.listCollections().toArray()).length) throw new Error('The restore database must be empty.');
    for (const [name, docs] of Object.entries(backup.data)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || !Array.isArray(docs)) throw new Error('Invalid backup collection.');
    }
    for (const [name, docs] of Object.entries(backup.data)) {
      await db.createCollection(name);
      if (docs.length) await db.collection(name).insertMany(docs);
      for (const index of backup.indexes[name] || []) {
        if (index.name === '_id_') continue;
        const options = Object.fromEntries(['name', 'unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression', 'collation']
          .filter((key) => index[key] !== undefined).map((key) => [key, index[key]]));
        await db.collection(name).createIndex(index.key, options);
      }
    }
    console.log('Encrypted backup restored into the separate recovery database. Verify its business totals before any cutover.');
  } else {
    const data = Object.create(null), indexes = Object.create(null);
    const existingNames = (await db.listCollections().toArray()).map((value) => value.name).filter((name) => !name.startsWith('system.'));
    const names = [...new Set([...existingNames, 'users', 'sellers', 'categories', 'products', 'reviews', 'orders', 'suborders', 'settlements', 'platformconfigs', 'counters', 'checkoutrequests'])];
    for (const name of names) indexes[name] = existingNames.includes(name) ? await db.collection(name).listIndexes().toArray() : [];
    const session = await mongoose.connection.startSession();
    try {
      await session.withTransaction(async () => {
        for (const name of names) data[name] = await db.collection(name).find({}, { session }).toArray();
      }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
    } finally { await session.endSession(); }
    const plaintext = mongoose.mongo.BSON.EJSON.stringify({ metadata: { format: 2, createdAt: new Date() }, data, indexes }, { relaxed: false });
    const encrypted = encryptBackup(Buffer.from(plaintext), publicKey);
    const directory = path.resolve(option('out') || 'backups');
    await fs.mkdir(directory, { recursive: true });
    const filename = path.join(directory, `yaans_${new Date().toISOString().replace(/[:.]/g, '-')}.backup.enc`);
    await fs.writeFile(filename, encrypted, { flag: 'wx', mode: 0o600 });
    console.log(`Encrypted backup written to ${filename}. No plaintext export or public upload was created.`);
  }
}

main().catch((error) => { console.error('[Yaans backup]', error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
