import fs from 'fs';
import path from 'path';
import dns from 'dns';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend/.env if available
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const args = process.argv.slice(2);
const restoreArg = args.find((a) => a.startsWith('--restore='));
const outDirArg = args.find((a) => a.startsWith('--out='));

const OUTPUT_DIR = outDirArg
  ? path.resolve(process.cwd(), outDirArg.split('=')[1])
  : path.resolve(__dirname, '../../backups');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'yaans_lk';

if (MONGODB_URI && MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (_e) {
    // ignore
  }
}

async function connectToMongo() {
  if (!MONGODB_URI) {
    console.warn('[Yaans Backup] No MONGODB_URI provided in environment.');
    return null;
  }
  console.log(`[Yaans Backup] Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    dbName: DB_NAME
  });
  console.log(`[Yaans Backup] Successfully connected to database: ${DB_NAME}`);
  return mongoose.connection.db;
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${MM}-${dd}_${HH}${mm}${ss}`;
}

async function performBackup() {
  const startTime = Date.now();
  const now = new Date();
  const timestamp = formatDate(now);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let db = null;
  try {
    db = await connectToMongo();
  } catch (err) {
    console.warn('[Yaans Backup] MongoDB connection failed:', err.message);
  }

  const backupData = {
    metadata: {
      version: '1.0',
      appName: 'Yaans.lk Sri Lankan Marketplace',
      createdAt: now.toISOString(),
      timestamp,
      source: db ? `MongoDB Atlas (${DB_NAME})` : 'Local Fallback Store',
      totalDocuments: 0,
      collections: {}
    },
    data: {}
  };

  if (db) {
    const collections = await db.listCollections().toArray();
    const systemCollections = ['system.profile', 'system.views', 'system.indexes'];
    const targetCollections = collections
      .map((c) => c.name)
      .filter((name) => !systemCollections.includes(name));

    console.log(`[Yaans Backup] Found ${targetCollections.length} collections: ${targetCollections.join(', ')}`);

    for (const colName of targetCollections) {
      const col = db.collection(colName);
      const docs = await col.find({}).toArray();
      backupData.data[colName] = docs;
      backupData.metadata.collections[colName] = docs.length;
      backupData.metadata.totalDocuments += docs.length;
      console.log(`  - ${colName}: ${docs.length} documents`);
    }
  } else {
    // Fallback: Read backend/data/yaans_db.json if available
    const localDbPath = path.resolve(__dirname, '../data/yaans_db.json');
    if (fs.existsSync(localDbPath)) {
      console.log(`[Yaans Backup] Reading local cache from ${localDbPath}...`);
      const localStore = JSON.parse(fs.readFileSync(localDbPath, 'utf-8'));
      for (const [key, val] of Object.entries(localStore)) {
        if (Array.isArray(val)) {
          backupData.data[key] = val;
          backupData.metadata.collections[key] = val.length;
          backupData.metadata.totalDocuments += val.length;
          console.log(`  - ${key} (local): ${val.length} items`);
        } else if (val && typeof val === 'object') {
          backupData.data[key] = [val];
          backupData.metadata.collections[key] = 1;
          backupData.metadata.totalDocuments += 1;
          console.log(`  - ${key} (local object): 1 config document`);
        }
      }
    } else {
      throw new Error('Neither MongoDB nor local cache file is accessible for backup.');
    }
  }

  const backupFilename = `yaans_backup_${timestamp}.json`;
  const backupFilePath = path.join(OUTPUT_DIR, backupFilename);
  const latestFilePath = path.join(OUTPUT_DIR, 'yaans_backup_latest.json');

  const jsonContent = JSON.stringify(backupData, null, 2);
  fs.writeFileSync(backupFilePath, jsonContent, 'utf-8');
  fs.writeFileSync(latestFilePath, jsonContent, 'utf-8');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const sizeKb = (Buffer.byteLength(jsonContent, 'utf-8') / 1024).toFixed(2);

  console.log(`\n======================================================`);
  console.log(`[Yaans Backup] Backup Completed Successfully!`);
  console.log(`- File: ${backupFilePath}`);
  console.log(`- Latest Alias: ${latestFilePath}`);
  console.log(`- Total Collections: ${Object.keys(backupData.metadata.collections).length}`);
  console.log(`- Total Documents: ${backupData.metadata.totalDocuments}`);
  console.log(`- File Size: ${sizeKb} KB`);
  console.log(`- Time Elapsed: ${durationSec}s`);
  console.log(`======================================================\n`);

  // Write outputs for GitHub Actions step outputs if running in CI
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `BACKUP_FILENAME=${backupFilename}\nBACKUP_PATH=${backupFilePath}\nBACKUP_TIMESTAMP=${timestamp}\nTOTAL_DOCS=${backupData.metadata.totalDocuments}\n`
    );
  }
}

async function performRestore(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Restore file not found at: ${resolvedPath}`);
  }

  console.log(`[Yaans Restore] Reading backup file: ${resolvedPath}...`);
  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  const backup = JSON.parse(raw);

  if (!backup.data || typeof backup.data !== 'object') {
    throw new Error('Invalid backup file format: missing "data" property.');
  }

  const db = await connectToMongo();
  if (!db) {
    throw new Error('Cannot restore: MongoDB connection could not be established.');
  }

  console.log(`[Yaans Restore] Restoring ${Object.keys(backup.data).length} collections...`);
  for (const [colName, docs] of Object.entries(backup.data)) {
    if (!Array.isArray(docs)) continue;
    const col = db.collection(colName);
    console.log(`  Restoring collection "${colName}" (${docs.length} documents)...`);
    await col.deleteMany({});
    if (docs.length > 0) {
      await col.insertMany(docs, { ordered: false });
    }
  }

  console.log(`[Yaans Restore] Database successfully restored from ${resolvedPath}!`);
}

async function main() {
  try {
    if (restoreArg) {
      const file = restoreArg.split('=')[1];
      await performRestore(file);
    } else {
      await performBackup();
    }
  } catch (err) {
    console.error('[Yaans Backup/Restore Error]:', err);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main();
