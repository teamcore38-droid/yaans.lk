# Security and order reliability release

Updated 12 November 2026. This release replaces process-wide snapshot synchronization with explicit database selections and awaited, targeted transactional writes. Existing string and BSON identifiers are preserved. Stale edits fail rather than overwriting newer data. MongoDB Atlas or a replica set is required; database outages do not fall back to seed accounts or local JSON.

## Accounts and private orders

There is no default administrator, password or JWT signing key. The former default administrator password and the credential hash fingerprint found in the removed public export are rejected. Existing sessions must sign in again after this release. Password changes/recovery revoke older sessions.

Provision or recover an administrator from a trusted terminal with the intended database configured in the private backend environment:

```sh
node backend/scripts/provision-admin.js --email=OWNER_EMAIL --reset-existing
```

The command prompts twice with hidden password input. Use a unique password of at least 14 characters. Omit `--reset-existing` when creating a new administrator. The command cannot promote an existing customer/seller and does not print the password. `--password-stdin` is for a secure non-interactive input source; never pass a password as a command argument or paste it into chat.

Registered orders require the owning account. Guests receive a random-looking private access code at checkout, valid for 90 days. The code is sent in an API header, not an API query string. Save it from the confirmation screen; browser session storage is only a convenience. The database stores a one-way hash. Sequential order numbers and recipient phone numbers do not authorize access or cancellation. Legacy guest orders without a code require verified support recovery.

Checkout requires a random UUID retry key. The client retains it across network errors and reloads until checkout is confirmed. The database binds that key to the request and account/guest scope; stock, variant stock, order/packages and retry record commit together. A changed retry can recover the original order. Cancellation releases inventory once; fulfillment cannot reopen a cancelled package or skip required dispatch transitions.

## Backup incident containment

The old automated backup workflow was disabled, then removed from source. The downloadable release ZIP and backup artifact from 10 November were removed after Windows-user-encrypted evidence was preserved outside the repository. Those copies contained one user password hash, configuration and categories, with no orders, seller identity or bank records. Prior third-party downloads cannot be ruled out.

Evidence and its checksum/aggregate receipt are stored under `%LOCALAPPDATA%\Yaans\SecurityBackups\2026-11-11`, protected with the current Windows user's DPAPI and a restricted folder ACL. No archive contents or credential hashes were added to this repository. The revocation list contains a second, one-way fingerprint of the exposed hash.

The backup command now refuses plaintext export or local-cache fallback. Configure an RSA public key of at least 3072 bits, keeping its private key offline and outside Git:

```sh
node backend/scripts/backup_db.js --public-key=PATH_TO_PUBLIC_KEY --out=backups
```

Exports use authenticated encryption and contain Extended JSON plus index definitions, including checkout retry records and order counters. Business data is read in one database snapshot. This bounded tool supports up to 512 MiB uncompressed; larger deployments need an appropriate managed/streaming backup system. It does not publish releases or artifacts. The former nightly automation remains disabled; configure private key custody, protected storage, retention and a recovery schedule before enabling any replacement automation.

Restore only into a separate, empty recovery database:

```sh
node backend/scripts/backup_db.js --restore=PATH_TO_ENCRYPTED_BACKUP --private-key=PATH_TO_PRIVATE_KEY --target-db=yaans_restore_DRILL_NAME
```

The tool refuses a normal application database name or an existing nonempty target and never erases collections. Verify totals, BSON types, indexes, inventory and retry records before a deliberate recovery cutover.

## Release controls and cutover

`main` requires the GitHub Actions **Marketplace verification** check, including for administrators. Force pushes and deletion are disabled. The production build also waits for the latest successful full workflow on the exact Git revision and approved repository. Missing/failed/cancelled/skipped checks, missing metadata, API failures and timeouts block publication. Tests run in CI/builds, never during customer requests. API/browser tests use synthetic loopback replica sets and block nonlocal browser requests.

Git deployments use this build gate on every production build. An additional Vercel Deployment Check is recommended for manual/prebuilt releases; those privileged release methods can bypass package build scripts and must never publish an unverified artifact.

Do not overlap the old snapshot writer and the new writer against the same production database:

1. Pass the full suite on the candidate revision and secure production signing-key/account configuration.
2. Set `MAINTENANCE_READ_ONLY=true` for the first production deployment. Browsing, health and price quotes remain available; mutations return 503 with a retry message. Keep previews read-only while they inherit the production database.
3. Deploy the verified revision and confirm `/api/health` reports `mongoConnected: true` and `writesEnabled: false`.
4. Allow at least the previous function's maximum lifetime to drain old requests. The old default deployment uses a 300-second budget. Do not operate old deployment URLs during this cutover.
5. Set the production flag to `false`, redeploy the same verified revision, and confirm `writesEnabled: true`. A safe rollback target is the new read-only deployment; do not restore the old snapshot-writing code.

The read-only setting is reversible and does not change hosting plans. Dedicated staging credentials are required before enabling mutations on preview deployments that currently inherit production database settings.

Further audit work includes populated-catalog pagination/query performance, shared abuse limits, COD remittance/refund reconciliation, media failure/size handling, monitoring and measured concurrency testing. This release does not establish a capacity guarantee for 200–500 simultaneous users.
