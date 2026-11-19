# Co-admin operations

Owners and co-admins sign in at `/admin/login` using individual credentials and authenticators. Existing admin accounts without `adminAccess` remain owners. Public registration, profile changes, and seller/staff routes cannot grant ownership or co-admin permissions.

Both account types must enroll an authenticator before accessing operational APIs. Existing owners who have not enrolled will see account security setup after deployment. This requires the existing `MFA_ENCRYPTION_KEY` (a canonical base64-encoded 32-byte key); preserve it securely across deployments. Do not rotate it without an authenticator recovery plan. The existing administrator provisioning CLI remains the owner recovery mechanism.

The production build gate rejects missing or malformed MFA keys. Before rolling back to a release that predates co-admin authorization, disable all co-admin accounts and revoke their sessions. That legacy release does not understand restricted admin accounts. Prefer a forward fix that retains these authorization checks.

## Owner workflow

Open **Co-admin Access** in the admin console. Creating, changing permissions, disabling/enabling, or resetting security requires the owner's current password and a fresh authenticator or unused recovery code. Share temporary credentials privately. Temporary access expires in 48 hours. Each co-admin must choose a different personal password, enroll an authenticator, and save their own recovery codes. Access changes revoke sessions and outstanding MFA challenges via `tokenVersion`.

The Operations preset grants order support, product content/moderation, seller review, banners/departments, and personal audit history. Price and stock overrides are separate, opt-in grants that require product access to be useful. Variant structure changes remain owner-controlled to protect existing orders and return inventory. Reports are optional and contain fulfillment counts only.

Co-admins cannot access the owner overview, staff/co-admin management, bank/identity records, commissions, cash reconciliation, payouts, global business/shipping policies, order documents, bulk sensitive exports or permanent product/department deletion. Unknown admin endpoints are denied by default. Banner deletion is available under merchandising to remove promotional content.

Refund, return, cancellation and delivery requests enter an owner review queue. Reviewing a request only records a note; the owner must execute any authorized action through the existing financial/fulfillment workflow. No request or review moves money or changes inventory/order status.

## Data, security and performance

The console reuses HttpOnly sessions, CSRF enforcement, bcrypt, encrypted TOTP secrets, rate limits, one-use MFA/recovery codes, database transactions, versioned writes and audit logs. API clients may supply a password plus MFA code at `/auth/admin/login`; browser login retains the existing two-stage challenge.

Permission checks use the existing authenticated user lookup. Module screens fetch on demand, use restricted projections and 25-record cursor pages with time-bounded queries, and do not poll. The console and management screens are lazy loaded; storefront requests are unchanged. Reports aggregate on demand. The new `operationrequests` collection and additive indexes are created through the existing operational initialization. Encrypted backups automatically include this collection and its indexes.

Mutations retain durable redacted intent events plus existing committed operational audits (including new banner/department audits). Personal audit history is restricted to the authenticated actor. Audit retention follows the existing 30-day security-event policy. New co-admins do not receive owner financial order notifications.

## Release validation

Run `npm run verify` with Node 24: dependency/security checks, unit and UI tests, isolated MongoDB integration tests, build, and desktop/mobile browser tests. Never use a production database or real customer accounts for these checks. For a protected deployment use the project's required production verification procedure before promotion. No deployment is performed by these local checks.
