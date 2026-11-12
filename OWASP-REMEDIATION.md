# OWASP remediation release

Prepared 12 November 2026 against the OWASP Top 10:2025 assessment. This document describes the reviewed changes and release requirements; a prepared branch is not proof of a production deployment. Detailed exploit evidence and account/hosting records remain private.

## Application changes

- Upload parsing uses Multer 2.5.0 with one file, no text fields, one part, no nested fields and a 4 MiB file limit. Only administrators or approved sellers can upload. Supported image signatures are checked before Cloudinary processing. Missing storage configuration fails closed; inline/database and local-file fallbacks are removed. Cloudinary still performs the actual image processing.
- Registration and password changes require at least 15 characters, at most 72 UTF-8 bytes, and reject a small local list of common choices and repeated-character passwords. This is not an exhaustive compromised-password database. Login remains compatible with existing passwords until changed.
- Identity changes use the credentials endpoint and require the current password. Credential changes revoke previous sessions; the profile route cannot change the login email. Address ownership confirmation and notifications to the previous email remain a separate email-service integration; the application currently does not provide that service.
- Browser sessions use host-only Secure HttpOnly cookies on deployments, with SameSite=Lax and a session-bound CSRF header on mutations. Browser API responses do not return JWTs, and legacy localStorage JWTs are discarded. Customer/seller sessions last 24 hours and administrator sessions one hour. Sign-out revokes every session for that account. Explicit bearer-token API clients remain supported.
- Administrators can enroll a TOTP authenticator from Admin Account settings after confirming their password. The setup secret is encrypted with an independent server key. Login challenges expire after five minutes; TOTP replay, challenge replay and recovery-code reuse are rejected. Attempt counters are shared across instances and IP addresses. Enrollment revokes prior sessions and displays eight recovery codes once. **Each administrator must enroll; deployment does not enroll an account automatically.**
- Reviews require a signed-in customer with a delivered package containing that product. The server derives purchase verification and customer identity, enforces one review per account/product transactionally, and applies a shared daily limit. Legacy badges without purchase evidence are suppressed. Review text continues to render as text.
- Banner calls to action accept only internal paths at all write aliases and at the rendering boundary. Frontend CSP blocks inline scripts and disallows framing. API CORS accepts exact configured origins; account field types and request/upload sizes are bounded.
- Security events are stored separately from the bounded administrator configuration history with 30-day retention. Administrative audit entries commit alongside the associated application write. Private monitoring receives aggregate failure counts only. These records are not an independent tamper-proof external logging service; the application database account retains write access.
- Backup decryption requires the original 16-byte GCM tag, 12-byte IV and 32-byte key. Existing valid encrypted backups remain compatible. Authenticator challenges are excluded from backups.
- React Router is upgraded to 7.18.5. Both npm and OSV advisory checks, redacted history secret scanning and blocking OWASP source rules are part of the required CI check. Application and private operational Actions references are pinned to full commits.

## Deployment and owner requirements

1. Keep Production and staging database users isolated. The production application needs `readWrite` on `yaans_lk` only. Verify the new account before changing the deployed URI, then drain old function requests before removing the old account's broad role. Do not disable the currently working account before the new deployment is healthy.
2. Configure a distinct `MFA_ENCRYPTION_KEY` in each environment: exactly 32 random bytes encoded as base64. Keep production values out of browser-prefixed variables, source, logs and chat. Preserve an encrypted recovery copy; changing the key without recovering enrolled secrets prevents authenticator login. A verified owner can explicitly reset MFA through the trusted provisioning command if recovery is necessary.
3. Pass the required full CI on the exact revision, verify isolated staging, then verify and promote that production revision. The session version changes in this release, so existing users must sign in again. Use [SECURITY-RELEASE.md](SECURITY-RELEASE.md) for the durable-write cutover rules when applicable.
4. Enroll every real administrator and save recovery codes separately. Test a subsequent authenticator sign-in before discarding an existing working session. Never share setup secrets, authenticator codes or recovery codes in support/chat.
5. Confirm actual `schedule` events for monitoring, encrypted snapshots and a restore drill. Successful manual dispatches do not establish automatic scheduling. A private provider-support draft exists for the unresolved scheduling issue. Keep that issue open until scheduled runs succeed.

Internet-wide Atlas access is not eliminated by changing the application role. Narrow network access when the hosting/automation egress arrangement supports it; do not remove required access blindly. A paid plan alone does not implement an allowlist.

## Verification and limits

`npm run verify` runs dependency advisories, Node units, React behavior tests, real disposable MongoDB API regressions, a production frontend build and desktop/mobile browser journeys. CI adds Gitleaks and Semgrep; all scanners use scoped exclusions and may miss vulnerabilities. Local attack probes and ZAP passive checks use loopback targets only. No production load, destructive scan or customer-data mutation is part of these checks.

Cloudinary provider behavior, external notification delivery, hosted saturation, all historical exposures and every possible business-rule bypass are outside a clean local test result. Report outstanding ownership, network and scheduler work separately from the fixes. Do not describe this release as eliminating all OWASP vulnerabilities.
