# Email ownership and login-address changes

Security email uses Resend through server-side `fetch`; it adds no runtime email SDK or background work to catalog reads. Automated tests run only in development/CI and cannot send real mail.

## Deployment prerequisites

1. Verify the Resend sending domain `notify.yaans.lk` using the exact public DNS records returned by its Domains API. Preserve the existing website A/CNAME records. DNS submission and Resend verification must both succeed before releasing the changed registration flow.
2. Disable open/click tracking on the sending domain and require TLS.
3. Configure server-only `RESEND_API_KEY` with sending access restricted to that domain, and `RESEND_EMAIL_DOMAIN=notify.yaans.lk`. Use a separate key on staging. Set `EMAIL_ALLOWED_RECIPIENTS` on staging to explicitly approved inboxes; other recipients are refused.
4. Confirm actual delivery to the owner's approved test inbox. A successful API send means accepted by the provider, not inbox delivery. Verify the complete registration and email-change journeys on protected staging before promotion.
5. Require the full quality workflow on the exact source revision before production deployment.

Sending identity: `Yaans.lk Security <security@notify.yaans.lk>`. Replies go to the owner's existing inbox. This configures outbound transactional email; it does not create an inbound mailbox or custom-address forwarding.

## Behavior

- Registration returns HTTP 202 and requests email proof. No account, seller application or session is created until the recipient opens the link and supplies the registration password. Successful confirmation directs the person to sign in; it never creates an authenticated session.
- Existing accounts retain access and remain explicitly unverified until ownership is proved. An authenticated user can request a link for the current address using the current password.
- Changing a login address requires the existing authenticated session and current password. The old address remains active until the new address is confirmed with the account password. Request/completion notices go to the old address. Confirmation also changes the seller contact address and ends all earlier sessions. Administrator MFA remains enabled and required at the next login.
- A new change request supersedes an earlier change link. Password changes invalidate pending requests. Expired links and links from a different credential version cannot be redeemed.

## Token and delivery controls

Verification tokens contain 32 cryptographically random bytes. Only SHA-256 hashes are stored, with purpose, intended email, password/session-version binding and a one-hour expiry. Consumption and account changes share a MongoDB transaction. Registration payloads and token hashes are removed by TTL; the `emailchallenges` collection is excluded from backups. Restoring a backup does not reactivate verification tokens.

Links put tokens in the URL fragment, which is removed after the confirmation page mounts. Email scanners cannot activate an account by opening a GET link. Password confirmation is required to prevent an attacker from registering somebody else's address with an attacker-known password. Raw tokens never enter notification queues or application logs.

Requests use shared MongoDB limits: three messages per recipient per hour, additional account/IP confirmation limits, and at most 90 outbound attempts per UTC day. The latter is intentionally below Resend Free's daily allowance; registration traffic approaching it requires an email-plan upgrade or revised capacity planning. No insecure delivery fallback is used.

Old-address notices are queued in the same transaction as each change. The request attempts delivery immediately; failed notices remain durable with bounded backoff. The authenticated `/api/operations/status` check retries up to three queued notices and alerts when any unsent notice is older than 15 minutes. This retry path depends on the operational checker actually running; confirm its scheduled executions separately. Resend idempotency keys reduce duplicate sends during retries but expire after 24 hours, so a notice may be repeated after a long interruption. Sent queue entries discard addresses/bodies and expire after 30 days. Pending notices are included in encrypted backups.

## Verification

Notification delivery and its queue writes pause during `MAINTENANCE_READ_ONLY=true`, including on protected previews configured for read-only access.

`npm run verify` runs dependency advisories, Node checks, React behavior, disposable MongoDB API tests, production build and desktop/mobile Playwright journeys. CI also runs secret scanning and OWASP source rules. Email-specific cases cover proof before registration, seller atomicity, password confirmation, expired/reused/superseded tokens, competing claims, session revocation, legacy account access, MFA preservation, provider failures, staging recipient restrictions, quotas, durable retries and backup exclusion.

Isolated tests erase inherited Resend credentials and replace delivery with a local mailbox. The mailbox inspector exists only in the test bootstrap and requires its per-run control secret; it is never mounted by the production server.
