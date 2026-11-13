// Local browser-test provider only. Never imported by application code.
import { generateKeyPairSync, createHash } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

export function installBrowserGoogleProvider(app) {
  if (process.env.NODE_ENV !== 'test' || app.mongo.databaseName !== 'yaans_automated_test') throw new Error('Google browser fixture requires the isolated test database.');
  const clientId = 'browser-test.apps.googleusercontent.com';
  Object.assign(process.env, { GOOGLE_LOGIN_ENABLED: 'true', GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: 'browser-fixture-only', GOOGLE_LOGIN_ORIGIN: 'http://127.0.0.1:4173' });
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({ certs: { 'browser-test-key': publicKey.export({ type: 'spki', format: 'pem' }) } });
  OAuth2Client.prototype.getToken = async function ({ code, codeVerifier }) {
    const match = /^browser-google:([a-f0-9-]{36}):([\w-]{43})$/.exec(code);
    if (!match) throw new Error('Unexpected local Google provider code');
    const [, id, state] = match;
    const attempt = await app.mongo.collection('authchallenges').findOne({ _id: `google-state:${createHash('sha256').update(state).digest('hex')}` });
    // The real callback consumes state before exchange; keep the original nonce
    // in the synthetic code instead, as supplied by the intercepted authorization URL.
    if (attempt) throw new Error('OAuth state must be consumed before code exchange');
    const proof = browserCodes.get(code); browserCodes.delete(code);
    if (!proof || createHash('sha256').update(codeVerifier).digest('base64url') !== proof.challenge) throw new Error('Invalid synthetic PKCE verifier');
    const now = Math.floor(Date.now() / 1000);
    return { tokens: { id_token: jwt.sign({ iss: 'https://accounts.google.com', aud: clientId, iat: now, exp: now + 3600, sub: `browser-${id}`,
      email: `${id}@google-browser.test.invalid`, email_verified: true, name: 'Browser Google Customer', nonce: proof.nonce }, privateKey, { algorithm: 'RS256', keyid: 'browser-test-key' }) } };
  };
  const browserCodes = new Map();
  // This control endpoint exists solely on the isolated browser-test server,
  // behind the same random control secret as test shutdown.
  return browserCodes;
}
