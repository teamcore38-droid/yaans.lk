import { constants, createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export function encryptBackup(plaintext, publicKey) {
  if (plaintext.length > 512 * 1024 * 1024) throw new Error('This backup tool supports at most 512 MiB of uncompressed data.');
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('yaans-backup-v2'));
  const ciphertext = Buffer.concat([cipher.update(gzipSync(plaintext)), cipher.final()]);
  const wrappedKey = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key);
  return JSON.stringify({ format: 'yaans-backup-v2', algorithm: 'RSA-OAEP-SHA256/AES-256-GCM',
    wrappedKey: wrappedKey.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64') });
}

export function decryptBackup(encrypted, privateKey) {
  const value = JSON.parse(encrypted);
  if (value.format !== 'yaans-backup-v2') throw new Error('Unsupported encrypted backup format');
  const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(value.wrappedKey, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from('yaans-backup-v2'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return gunzipSync(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]), { maxOutputLength: 512 * 1024 * 1024 });
}
