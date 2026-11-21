# Rate limiting

The application retains its existing authentication, permissions, CSRF, MFA, upload, checkout-idempotency and transactional inventory safeguards. Throttles supplement those checks; they never authorize an operation.

## Layers and budgets

The Express 400-requests/minute/IP in-memory guard is a cheap per-process backstop, evaluated before JSON parsing. It is not a distributed budget. The outer distributed API guard belongs in Vercel's WAF so ordinary catalogue reads do not require a MongoDB counter write. Static pages and assets are outside the API rule.

The reviewed edge proposal is [config/vercel-api-rate-limit.json](../config/vercel-api-rate-limit.json): 1,200 requests/minute/IP, fixed window, `/api/` only. Its initial over-limit action is **log**, not blocking. A staged rule is not live until published, and publishing this version only enables observation. Do not describe it as enforced protection until its action has been changed and published after review.

Shared application counters use the existing MongoDB atomic update, HMAC identity and TTL pattern. Storage failure returns HTTP 503; it never silently disables sensitive protection.

| Operation | Shared budget |
| --- | --- |
| Customer/seller login | 10/email/15 minutes; combined login IP guard 30/15 minutes |
| Administrator login | 5/email/15 minutes plus the login IP guard; MFA also has IP/account budgets |
| Customer/seller registration | Combined 10/IP/hour |
| Non-empty product text search | 120/IP/minute; varying search terms does not reset the budget |
| Cart quotations | 120/IP/minute |
| Credential changes requiring current-password verification | 5/account/15 minutes and 30/IP/15 minutes |
| Seller bulk import | 5/account/15 minutes |
| Checkout / checkout-result / customer action | Existing 30/IP/5 minutes for each operation |
| Guest tracking | Existing 60/IP/5 minutes |
| Image uploads | Existing 30/account/15 minutes |
| Order documents | 60/account/minute for signed-in users, 60/IP/minute for guests; outer 300/IP/minute |
| Order notifications | 120/account/minute; outer 600/IP/minute before authentication |

Existing Google, staff-management, co-administrator, business-settings and review budgets remain in place. Basic display-name/phone edits and submitting an unchanged login email do not spend the current-password-attempt budget. New quotas protect work before password hashing, inventory reads, bulk processing or PDF generation. Authorization remains mandatory even when a quota is available.

These are fixed windows, aligned to the server's clock, not rolling durations since the first request. They can allow bursts across a reset boundary. Tune budgets from observed legitimate traffic, including mobile carrier NAT and offices sharing an address. Authentication/account protection must not be removed when adjusting broad IP thresholds.

## Rejections and browser behavior

HTTP 429 responses use JSON with `code: RATE_LIMITED`, a positive `retryAfter` duration, a matching `Retry-After` header and `Cache-Control: private, no-store`. This also applies to the process backstop and MFA account throttle.

The API client supports both standard numeric and HTTP-date `Retry-After` values, with a safe fallback for an HTML edge response. It retains at most 128 in-memory cooldown entries, scoped to the action and browser session. Search terms share a search cooldown, while ordinary browsing remains independent. Login cooldowns also distinguish email accounts. Existing public response caching and request coalescing are preserved.

A limited action returns the remaining wait immediately instead of issuing another network request. The UI displays a countdown, and notification polling waits at least as long as the server requests. There is no automatic replay of mutations, including checkout. The original idempotency key remains the caller's responsibility and is unchanged on an explicit retry. Passwords, private order tokens and cooldowns are never persisted to browser storage by this feature.

## Observability and cost

The existing counter update also counts rejected attempts. Retained operational telemetry is sampled at rejection milestones 1, 2, 4, 8, and so on, up to 1,048,576, per shared identity/window. Each milestone increments a five-minute aggregate by the additional sampled amount. This yields a lower bound on rejected responses, not an exact request count, and adds only logarithmically many metric writes during a sustained burst. Normal successful requests make no extra telemetry write. Metrics contain the limiter scope, never raw client IPs, emails, tokens or passwords.

The authenticated operational status includes `counts.rate_limit_rejected` over its existing monitoring window and reports `rate_limit_abuse` at a sampled count of 50 or more. Existing checkout, database and authentication alerts remain unchanged. Metric-storage failure cannot make a blocked request pass. Delivery of operational alerts still depends on the separate monitoring scheduler.

## Firewall publication and rollout

The Vercel firewall workflow requires draft inspection and operator publication. Review the draft in the `yaans-lk` project's Firewall page or with:

```powershell
npm exec --yes --package=vercel@65.14.0 -- vercel firewall diff --project prj_EmUJO2gOvjATfdZgxspUUaKgEv6F --scope teamcore38-droids-projects
```

The only intended change is `API burst observability`. Publish the logging-only draft from **Review Changes → Publish** in the dashboard. Review matching traffic before any enforcement decision, test enforcement in preview, then enable production blocking only when normal user, crawler and monitoring traffic has been checked. No paid upgrade or unrelated firewall rule is authorized by this configuration. Discarding or replacing another operator's draft requires separate review.

## Verification

Run `npm run verify`. Regression coverage checks shared-process enforcement, quota reset, fail-closed behavior, new route coverage, account fairness behind a shared IP, guest access safeguards, bounded private telemetry, frontend cooldowns, polling, checkout retry safety and desktop/mobile countdown journeys. An isolated command-monitoring test verifies that ordinary home/category/product-list/detail reads write no shared rate counter. Existing permission and MFA journeys remain part of the full suite.

The capacity runner targets only disposable loopback API/MongoDB processes and synthetic trusted-proxy identities. It does not reset production limits or authorize hosted load testing. Compare before/after samples on an otherwise idle host; local timings are not guarantees about Atlas/Vercel latency.
