import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createPublicKey } from 'node:crypto';
import { encryptBackup, decryptBackup } from '../src/config/backupCrypto.js';
import { captureBackup, restoreBackup, validateBackup } from '../src/config/backupRepository.js';

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
    validateBackup(backup);
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
    const result = await restoreBackup(db, backup);
    console.log(JSON.stringify(result));
    console.log('Encrypted backup restored and verified into the separate recovery database.');
  } else {
    backup = await captureBackup(db);
    const plaintext = mongoose.mongo.BSON.EJSON.stringify(backup, { relaxed: false });
    const encrypted = encryptBackup(Buffer.from(plaintext), publicKey);
    const directory = path.resolve(option('out') || 'backups');
    await fs.mkdir(directory, { recursive: true });
    const filename = path.join(directory, `yaans_${new Date().toISOString().replace(/[:.]/g, '-')}.backup.enc`);
    await fs.writeFile(filename, encrypted, { flag: 'wx', mode: 0o600 });
    console.log(`Encrypted backup written to ${filename}. No plaintext export or public upload was created.`);
  }
}

main().catch((error) => { console.error('[Yaans backup]', /Mongo/.test(error.name) ? `Database backup operation failed (${error.code || error.name}).` : error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
