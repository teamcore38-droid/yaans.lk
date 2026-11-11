import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase, generateId, MODEL_MAP } from '../src/config/db.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const args = process.argv.slice(2);
const option = (name) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

async function passwordInput() {
  if (args.includes('--password-stdin')) {
    let password = '';
    for await (const chunk of process.stdin) {
      password += chunk;
      if (password.length > 1024) throw new Error('Password input is too long.');
    }
    return password.replace(/[\r\n]+$/, '');
  }
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal, or --password-stdin with a secure input source. Never put a password in command arguments.');
  const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  try {
    process.stdout.write('New administrator password (hidden): ');
    const password = await terminal.question('');
    process.stdout.write('\nConfirm password (hidden): ');
    const confirmation = await terminal.question('');
    process.stdout.write('\n');
    if (password !== confirmation) throw new Error('Passwords did not match.');
    return password;
  } finally { terminal.close(); }
}

try {
  const email = (option('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide the administrator email with --email=<address>.');
  const password = await passwordInput();
  if (password.length < 14 || password.length > 256) throw new Error('Use a unique administrator password of 14–256 characters.');
  await connectDatabase();
  const existing = await MODEL_MAP.users.collection.findOne({ email });
  if (!existing && args.includes('--reset-existing')) throw new Error('The administrator was not found. Check the email before attempting recovery.');
  if (existing && (existing.role !== 'admin' || !args.includes('--reset-existing'))) throw new Error('Existing administrators require --reset-existing. A customer/seller account cannot be promoted by this command.');
  const passwordHash = await bcrypt.hash(password, 12);
  if (existing) {
    const result = await MODEL_MAP.users.collection.updateOne({ _id: existing._id, passwordHash: existing.passwordHash },
      { $set: { passwordHash, isActive: true, credentialsUpdatedAt: new Date() }, $inc: { tokenVersion: 1, _writeVersion: 1 } });
    if (result.matchedCount !== 1) throw new Error('The account changed during recovery. Retry after checking its current state.');
  } else {
    await MODEL_MAP.users.collection.insertOne({ _id: generateId('usr_admin'), email, passwordHash,
      name: option('name') || 'Marketplace Administrator', phone: option('phone') || '', role: 'admin',
      isActive: true, sellerId: null, addresses: [], wishlist: [], tokenVersion: 1, _writeVersion: 1,
      credentialsUpdatedAt: new Date(), createdAt: new Date() });
  }
  console.log('Administrator provisioned securely. Previous sessions for a reset account are revoked.');
} catch (error) { console.error('[Administrator setup]', error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
