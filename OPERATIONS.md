# Backups, staging, COD reconciliation and monitoring

These procedures extend the security release described in SECURITY-RELEASE.md. Application tests remain development/CI tools; they are not executed during customer requests.

## Private backups and restoration

The operations repository is `teamcore38-droid/yaans-operations`, with private visibility. Templates under `operations/workflows/` belong in that private repository only. Its workflows refuse to export/upload data if repository visibility becomes public. Backups are Actions artifacts in the private repository, never releases, Git commits or artifacts in the public application repository.

The planned schedule is one encrypted snapshot every four hours, seven-day retention, and one restore drill daily. Scheduling is best effort and can be delayed by GitHub. A seven-hour backup freshness alert and a thirty-hour restore freshness alert detect gaps. Recovery can lose changes since the latest completed snapshot; these schedules are not point-in-time recovery. Revisit frequency and independent storage before meaningful order volume makes that loss window unacceptable.

Snapshots read business records consistently in a MongoDB transaction. AES-256-GCM encrypts compressed Extended JSON, with an RSA-OAEP-SHA256 wrapped key. Only the public key is needed by the export step. Rate-limit counters and operational metrics are transient and excluded. Accounts, orders, inventory, checkout retry records, counters, settlements and cash movements are included when present. Collection/index definitions and BSON types are preserved.

The private job pins an exact application revision and checks its full successful quality workflow before using its backup code. Runtime dependencies are installed from the lockfile. A backup artifact is retained before testing restoration, so a failed drill does not discard the encrypted export. The initial automated artifact size cap is 8 MiB; exceeding it fails visibly and requires a storage/retention review.

The restore user can write only `yaans_restore_automated`. The drill refuses a nonempty recovery database, restores the snapshot and compares every document and index with the decrypted manifest. This verifies account hashes, order/package records, quantities, monetary fields, cash ledger entries, identifiers and dates without publishing them. It removes only that fixed recovery database, and only after successful verification. An incomplete restore remains for investigation and blocks another drill; clear it only after confirming the exact recovery target and retaining any diagnostic evidence needed.

Database roles are separate:

| Account | Role | Database |
| --- | --- | --- |
| yaans_backup_reader | read | yaans_lk |
| yaans_restore_runner | readWrite | yaans_restore_automated |
| yaans_staging_app | readWrite | yaans_staging_lk |

Use different credentials. Restrict each to Cluster0. Never give a preview or scheduled backup the production administrator credential.

Recovery key custody: the private key is an encrypted GitHub Actions secret for the restore step, and setup state is protected with the current Windows user's DPAPI in `%LOCALAPPDATA%\Yaans\OperationsSetup`. DPAPI is tied to that Windows identity; copying its file alone is not an independent portable recovery key. Keep a separately protected portable recovery key and its passphrase in owner-controlled recovery storage. Do not commit a private key or put it in chat. The public key fingerprint should be recorded alongside backups when changing keys; keep previous private keys for older retained backups.

At normal short job durations, the chosen schedules are intended to fit the existing included private-runner allowance. That allowance is shared with other private repositories and actual duration/storage determine usage. No paid quota increase is authorized by this setup. Monitor the account's Actions usage and preserve a zero extra-spend limit if that is the owner's budget.

## Staging isolation

The dedicated `yaans-lk-staging` Vercel project uses `APP_ENV=staging`, `MONGODB_DB_NAME=yaans_staging_lk`, and its own database user and JWT key. Its automation credential grants access only to that staging project. Production-project previews also use isolated staging database credentials and stay read-only. The database user cannot read/write production. Runtime guards reject staging pointed at another database and writable previews without the staging configuration. Production settings stay scoped to Production.

`backend/scripts/seed-staging.js` creates only synthetic accounts, sellers, products and configuration, using a private strong staging account password. It refuses production and unrecognized existing data. It does not copy production accounts or customer records. The frontend displays a test-environment banner, and staging media uploads use a separate folder prefix. Preview protection remains enabled.

`scripts/exercise-staging.mjs` refuses production domains and requires a protected `.vercel.app` origin whose health response identifies staging. It exercises customer checkout/retry, seller dispatch/delivery, rejection of payout before receipt, administrator cash receipt, payout/retry, customer return, return receipt, refund, inspected inventory restock and seller recovery. All transaction references are synthetic; no bank transfer is initiated. The script uses an automation protection credential only for the exact staging origin.

Run the private staging workflow after deployment changes. Keep normal Playwright desktop/mobile journeys in the public quality workflow on synthetic, local databases. Preview staging shares the Atlas cluster's resource limits with production; database/credential isolation does not provide independent compute capacity.

## COD, refunds and payouts

Seller fulfillment updates do not confirm cash receipt or refunds. Delivery leaves a package unsettled until an administrator verifies the actual courier/bank statement and records a reference and the exact gross COD amount. Legacy automatic remittance flags alone do not authorize payout.

Administrators record completed transfers; the application does not move money or independently verify a bank statement. A payout explicitly names its packages and exact net amount. It requires delivered, receipt-confirmed packages without return/refund holds. References are required, and a unique cash ledger makes retries idempotent. Reusing a reference for a different amount/package is rejected. Use a distinct verifiable statement line reference for each receipt; this release does not split a single bulk remittance across packages automatically.

A customer return request holds unpaid earnings. The seller confirms receipt of returned goods. Returning goods does not mark a refund paid or automatically restock them. Administrators record a completed full-package refund using its actual reference and amount. Partial refunds are not implemented in this release. Stock is restored once only after administrator inspection for resale; damaged returns should not be restocked.

If the seller was already paid, a refund creates a recovery obligation for the prior seller earnings. Further payouts to that seller are held while a paid-order return or recovery is unresolved. An administrator records verified recovery with its amount/reference before payouts resume. Existing payout records remain as historical facts; refunds do not erase them.

## Monitoring and request protection

`/api/health` checks MongoDB readiness. `/api/operations/status` requires a separate private monitoring bearer token, returns no-store responses and exposes aggregate counters only. One-hour alerts trigger at three checkout server failures, three database errors, or five other server errors. Ordinary invalid carts and rejected credentials are not checkout server-failure alerts.

The private operations workflow checks readiness, protected application metrics, and backup/restore freshness every thirty minutes. It opens one private GitHub issue per active alert and resolves it after a corresponding successful check. A successful export does not resolve a failed restore drill. Repeated checks suppress duplicate issues. GitHub Actions failures also appear in the private Actions tab. Email delivery depends on the owner's GitHub Actions/issue notification settings and verified email address. This is periodic monitoring, not a continuous uptime SLA; a GitHub outage can delay both jobs and notifications.

MongoDB-backed atomic counters share sensitive-route budgets across instances. Keys contain an HMAC rather than plaintext email/IP addresses, and TTL indexes remove expired counters. Limits apply to sign-in, registration, checkout/recovery, tracking, customer order actions and uploads. Protection fails closed when its shared store is unavailable. The fixed-window ID enforces expiry independently of asynchronous TTL cleanup. Ordinary catalog reads retain the lightweight process-level limiter.

Operational metrics are small five-minute buckets retained for seven days. Instrumentation awaits bounded writes for relevant events, without logging cart contents, customer identities, credentials, tracking tokens or request bodies. Database outages are also detected independently by the external readiness check. Monitor and limiter storage remain in the existing MongoDB service; no Redis or error-tracking subscription is required for this initial setup.
