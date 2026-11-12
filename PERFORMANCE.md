# Capacity testing and operating limits

`npm run test:capacity` starts its own loopback-only MongoDB replica set and two isolated API processes, populates synthetic records, exercises the real HTTP routes, checks durable orders/stock/retry behavior, and removes its disposable database afterward. It never accepts a hosted target or uses an inherited database URI. Node, React and performance test tools remain development-only dependencies and are not imported by the customer application.

Use Node 24 and install the existing locked dependencies as described in TESTING.md. No additional plugin, load-testing subscription or runtime package is required. The pinned disposable MongoDB binary may download on the first run. Do not run other benchmarks or builds concurrently when comparing results.

```sh
# Progressive local profile, including a deliberately challenging 500-user wave.
npm run test:capacity

# Pilot profile: 200 active sessions, one request then a 3-second browsing pause.
npm run test:capacity -- --users=200 --seconds=60 --think-ms=3000 --label=pilot-200

# Inspect representative response sizes and the catalog query plan separately.
node scripts/inspect-capacity-queries.mjs
```

Options use `--name=value`: `users` is a comma-separated list, at most 500 active sessions; `seconds` is 5–120 per wave; `think-ms` is 100–30000; `instances` is 1–4. Defaults populate 1,000 additional products, 100 sellers, 10,000 reviews and 10,000 historical orders. Bounded `products`, `sellers`, `reviews` and `orders` options allow other synthetic sizes. JSON reports go under `reports/`, or an explicit `--out=<path>`.

This is a closed-loop workload with staggered arrivals: slow responses reduce achieved throughput. Active sessions include people between actions and are not simultaneous in-flight requests. Reports include achieved RPS, peak in-flight requests, p50/p95/p99/max latency, HTTP status counts, decoded response bytes, MongoDB network bytes and observed connection counts, per-process command/document counts, memory, CPU and event-loop delay. Database network totals include the local replica set's associated protocol activity and are comparative diagnostics, not a hosted billing forecast.

The request mix is 40% product lists/search, 20% product details, 20% home, 15% quotes and 5% guest checkout, with some exact-key retries. Synthetic trusted-proxy identities model separate clients only inside the loopback test bootstrap. Normal application rate limits remain active. A single shared real IP has its own request budget; a one-IP hosted generator must respect it and cannot establish a many-IP capacity ceiling.

Waves stop after five unexpected failures or a request over ten seconds. A fifteen-second client timeout can leave a committed order with an ambiguous response. The runner replays only the original checkout key/body at low load, then verifies all saved orders/packages, stock deductions and variant deductions. Recovery after a timeout does not clear the original wave's error or latency result.

Exit code 0 means all requested local waves met the configured sample targets: no unexpected errors, no rate-limit responses, no stop condition, catalog p95 below one second and checkout p95 below two seconds. Code 2 means a capacity target or stop condition was reached; code 1 means a harness or consistency check failed. These timings are diagnostic targets and are not part of the normal hardware-independent CI gate. CI instead verifies bounded database results, index usage, privacy/visibility, pagination, filters, BSON compatibility and browser behavior.

## Production preparation

Public catalog reads now query bounded product/review pages in MongoDB rather than materializing and cloning the full collections. Home uses a bounded aggregation, and independent reads run concurrently outside transactions. Review and storefront pagination expose totals and navigation; changing review pages preserves the selected variant. Current seller/product approval and authoritative checkout stock remain fresh server-side; this release does not add a completed-response server cache.

Five non-unique product indexes support popular/category, price/rating and seller queries. `autoIndex` remains disabled in the deployed application. Install the indexes explicitly before promotion, using an appropriately scoped connection and matching values:

```sh
# Set APP_ENV=staging, MONGODB_DB_NAME=yaans_staging_lk and the staging URI privately first.
node backend/scripts/ensure-catalog-indexes.js
```

For production, the same script requires `APP_ENV=production`, `MONGODB_DB_NAME=yaans_lk` and the production URI. It adds named indexes and never drops existing indexes or changes records. It is idempotent. Do not put a URI in shell history or chat. The dedicated staging seed also creates the schema indexes. `vercel.json` pins the single function region to `bom1`, beside the existing Atlas AWS Mumbai cluster; verify the deployed region after the complete quality suite passes.

## What local results establish

They establish application behavior and comparative costs on the recorded local hardware/data/Node/MongoDB versions. They do not establish Vercel autoscaling, Atlas Free throttling, hosted cold starts, regional failures, Cloudinary transfer, real browser rendering/network performance or a production concurrent-user guarantee. Local MongoDB is pinned to 7.0.14; the hosted staging functional check also verifies compatibility with the actual Atlas version.

Atlas Free currently documents 100 database operations/second, 500 connections, 0.5 GB including indexes, and 10 GB transferred in and out per rolling seven days. Several database operations can be required by one API request, and transaction retries add work. Staging and production share this cluster's limits. A connection pool limit is per process; additional API instances and replica monitoring connections consume additional cluster connections. [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

The broad authenticated administrator overview still returns complete historical arrays. Measure its response size with the inspection command; at large order histories it needs separate pagination and database aggregates before it can fit the hosting response envelope. It must be redesigned without hiding outstanding COD receipts, unpaid earnings or recoveries. The load report records this remaining limit rather than truncating financial records silently.

## Hosted testing approval

Vercel's published policy requires provider approval for hosted load tests and describes Enterprise testing/coordination. The user has not yet obtained that approval. Only ordinary functional checks are performed against hosted deployments in this phase. Obtain an explicit exception/approval before a hosted stress test, including one targeting staging; changing the URL to a preview or bypassing protection does not remove that requirement. [Vercel load-testing policy](https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments).

The prepared owner request is in the local report `reports/vercel-load-test-request-2026-11-12.md`. It proposes a small, staged pilot with a maximum of five requests/second and explicit request, checkout and stop limits. Approval is needed from Vercel, and a larger or distributed follow-up needs its own coordinated scope. No request has been sent on the owner's behalf.

Capacity and commercial hosting eligibility are separate decisions. Vercel's current terms restrict Hobby to non-commercial personal use and list advertising products or requesting payment as commercial usage; discuss Pro or another suitable hosting arrangement before advertising the marketplace. No paid upgrade is performed by these scripts. [Vercel fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines).
