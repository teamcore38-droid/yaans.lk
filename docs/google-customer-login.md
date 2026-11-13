# Customer Google login

Business owner: `yaanslk5@gmail.com`. Production origin: `https://yaans.lk`.
The live `www.yaans.lk` address redirects to this origin.

## Google Cloud setup (owner)

1. Sign in to <https://console.cloud.google.com/> using the business account. Enable Google two-step verification and recovery options for that account.
2. Create a dedicated project, e.g. **Yaans Customer Login**. Use a separate project/client for staging and local testing.
3. In **Google Auth Platform**, configure **Branding**: name `Yaans.lk`, user support email `yaanslk5@gmail.com`, homepage `https://yaans.lk`, privacy policy `https://yaans.lk/privacy`, terms `https://yaans.lk/terms`, authorized domain `yaans.lk`, and an actively monitored developer contact. Verify domain ownership and complete Google's applicable branding verification before public rollout.
4. Choose **External** audience. Start in **Testing** with your testing Google accounts. Do not request Gmail, Drive, Contacts or other Google API permissions. Identity scopes only: `openid`, `email`, `profile`.
5. Under **Clients**, create an OAuth client of type **Web application**. Add this exact **Authorized redirect URI**:

   `https://yaans.lk/api/auth/google/callback`

   This uses a backend authorization-code redirect; JavaScript origins and a browser Google SDK are not required. Do not use wildcard callbacks or dynamically trust request Host headers.
6. Copy the client ID. Store the client secret directly in your deployment's encrypted server environment settings. Never put it in chat, Git, frontend code, a `VITE_` variable, screenshots, or issue comments.

## Server configuration

Set these on the correct deployment environment (both root and backend manifests include the official Google library):

```dotenv
GOOGLE_LOGIN_ENABLED=false
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-private-client-secret
GOOGLE_LOGIN_ORIGIN=https://yaans.lk
```

Use `GOOGLE_LOGIN_ENABLED=true` only in the environment being tested or released. Redeploy after changing environment values. Configuration is read server-side; no frontend rebuild variables or Google scripts are required. Missing/invalid configuration hides the Google button, while password login continues to work. Toggle the flag to false and redeploy to disable it. Existing Google-only users need Google login or a previously configured password to return; consider that before disabling a launched integration.

For local development, register `http://localhost:5173/api/auth/google/callback` in the separate development OAuth client and set `GOOGLE_LOGIN_ORIGIN=http://localhost:5173`. Use Vite's same-origin API proxy. Do not run through the backend's port for browser sign-in. Staging must keep its existing isolated database and credentials.

## Behavior and security

- Customers only. Seller, staff, administrator, inactive and revoked-credential accounts cannot use this route. Seller application and approval behavior is unchanged.
- Authorization code exchange uses the official Google authentication library, PKCE S256, random state, nonce, and a host-only HttpOnly SameSite=Lax cookie (Secure in deployed environments). State is consumed atomically, bound to the browser and limited to ten minutes. Token signature, issuer, audience and expiry are checked by Google's library; the application also checks nonce, verified email and subject. Access/refresh tokens are discarded.
- The provider subject is uniquely indexed. Requests use indexed, bounded account lookups. Google's verification certificates are cached by its library, and outbound requests have timeouts. Only login, customer registration and Google-only account security fetch Google availability; no storefront-wide SDK loads or new polling.
- Returning linked customers reuse the normal Yaans session and CSRF protections. Linking an existing customer requires the existing password; email matching alone never grants access. Linking invalidates older sessions. Google identity linkage remains stable if the Yaans contact email changes after password reauthentication; changing the contact email does not select another Google account.
- New customers provide their name, valid Sri Lankan mobile number and district, and accept terms. Google does not verify this mobile number. No placeholder password or phone is fabricated.
- Google-only users can verify their linked Google account again from Account Security to create an optional password. This invalidates older sessions. Email/password changes then use the normal current-password checks. This release does not offer Google unlinking, so it cannot accidentally remove the last login method. Recovery of a Google-only account uses Google's account recovery; support must not link identities based on a claimed email alone.
- Pending linking and password creation are protected by a browser-bound completion cookie, explicit origin checks, a separate CSRF token, rate limits, account-version checks, a database transaction and one-time consumption. Existing account data, cart and wishlist are preserved.
- Google start, callback and completion use separate IP budgets from password login. Exhausting Google attempts does not consume the password fallback budget. Per-browser and per-identity completion limits also apply.
- OAuth state and pending records use the existing expiring `authchallenges` collection, excluded from backups. Google identifiers are omitted from public user responses. Tokens, codes and secrets are never logged by the application. Restrict deployment/request-log access because OAuth callback URLs contain short-lived authorization codes; do not send query strings to analytics.
- Maintenance mode blocks Google authentication writes, including the GET callback. CSP is unchanged because Google is visited as a top-level redirect rather than embedded.

## Verification and release

Run the repository's normal security, unit, UI, integration, build and browser checks. The Google integration tests use an isolated MongoDB replica set and mock only the external Google exchange/verification boundary; no real Google credentials are needed. Real-provider verification is still required with the configured client.

Before production enablement, test on the isolated staging deployment: new customer onboarding; linked customer sign-in; password-confirmed legacy linking; cancellation and retry; wrong Google account during password creation; password creation and email/password login; logout; inactive customer rejection; seller/admin/staff rejection; cart persistence and checkout. Check both desktop and mobile. Complete Google's production/branding requirements, switch the appropriate OAuth project to production, and monitor failures after enablement.

References: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).

## Implementation validation — 13 November 2026

- Unit checks: 46 passed.
- React UI checks: 60 passed.
- MongoDB integration suite: 90 passed; affected Google tests were rerun after final rate-limit changes and passed.
- Desktop/mobile browser checks: 26 passed, including real browser-to-API-to-database Google flows using a local provider fixture and the actual Google JWT verifier.
- Production build and React hook checks passed.
- npm and OSV dependency audits passed for 428 distinct locked dependency versions.
- Actual Google Cloud credentials, Google-hosted consent, branding verification and live-provider staging testing remain owner setup/release steps. This validation does not claim production Google authentication has already been enabled or tested.
