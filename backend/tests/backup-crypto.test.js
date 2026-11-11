import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { encryptBackup, decryptBackup } from '../src/config/backupCrypto.js';

test('backup content is authenticated, encrypted and recoverable only with the matching private key', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
  const other = generateKeyPairSync('rsa', { modulusLength: 3072 });
  const plaintext = Buffer.from(JSON.stringify({ users: [{ email: 'private@test.invalid', passwordHash: 'synthetic-secret' }] }));
  const first = encryptBackup(plaintext, publicKey);
  const second = encryptBackup(plaintext, publicKey);
  assert.notEqual(first, second, 'Each export must use independent encryption randomness');
  assert.ok(!first.includes('private@test.invalid') && !first.includes('synthetic-secret'));
  assert.deepEqual(decryptBackup(first, privateKey), plaintext);
  assert.throws(() => decryptBackup(first, other.privateKey));
  const tampered = JSON.parse(first);
  const ciphertext = Buffer.from(tampered.ciphertext, 'base64');
  ciphertext[0] ^= 1;
  tampered.ciphertext = ciphertext.toString('base64');
  assert.throws(() => decryptBackup(JSON.stringify(tampered), privateKey));
});
