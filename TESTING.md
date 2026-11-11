# Testing and deployment verification

Use Node 24 (`.nvmrc`). All new test tools are development dependencies. They run on a developer machine or in CI; they are not imported by the application, do not add browser code, and do not run during customer requests. The built frontend is used for browser testing.

## First-time setup

From the repository root:

```sh
npm ci --include=dev
npm --prefix backend ci
npm --prefix frontend ci --include=dev
npx playwright install chromium
```

GitHub CI uses the Chrome already installed on its pinned Ubuntu 24.04 runner, selected with `YAANS_TEST_BROWSER_CHANNEL=chrome`. This avoids downloading browser packages and fonts through Ubuntu's package mirrors on every run. Local tests use Playwright's installed Chromium by default. On other Linux machines, install Chromium system dependencies with `npx playwright install --with-deps chromium`. The first integration/browser run downloads a pinned MongoDB 7.0.14 test binary into the user's cache; subsequent runs reuse it. The `mongodb-memory-server-core` dependency has no binary download hook during package installation. No MongoDB Atlas account, Cloudinary credentials, Docker installation, plugin, or MCP is needed.

## Commands and scope

| Command | What it checks |
| --- | --- |
| `npm test` | Original Node test runner and test files, plus district/shipping boundary tests |
| `npm run test:ui` | Vitest + React Testing Library component, state and hook tests |
| `npm --prefix frontend run test:ui:watch` | React tests in watch mode |
| `npm run test:integration` | Real Express routes and actual disposable MongoDB collections |
| `npm run build` | Existing hooks check and production frontend build |
| `npm run test:e2e` | Playwright desktop/mobile Chromium journeys; run the build first |
| `npm run test:e2e:report` | Open the last browser test report |
| `npm run verify:fast` | Node and React tests without MongoDB or browsers |
| `npm run verify:deploy` | Fast tests followed by the production build, used by Vercel |
| `npm run verify` | Fast tests, MongoDB integration, production build, then browser journeys |

The Node runner discovers the existing `frontend/tests/*.test.js` and `backend/tests/*.test.js` files. Vitest discovers only `frontend/tests/ui/**/*.test.{js,jsx}`. Integration files use `backend/tests/*.integration.js`, and Playwright discovers only `tests/e2e/*.spec.js`. Each suite has its own assertions/setup and cannot accidentally execute another runner's files. Empty suites or failures return a nonzero exit code. CI disallows focused Vitest/Playwright tests; browser retries are disabled so failures cannot be silently retried into a pass.

## Isolation

`backend/tests/helpers/isolated-app.js` starts a private MongoDB process on a loopback address, supplies synthetic fixtures, and overwrites inherited database and Cloudinary settings before importing the API. Tests assert MongoDB connected successfully rather than accepting a local-store fallback. The API's local document cache lives in a fresh temporary directory; normal `backend/data` and `.env` files are untouched.

Integration tests use a random API port. Browser testing reserves API port **5179** and frontend preview port **4173**, refuses to reuse existing servers, and stops its servers after the run. Keep these two ports free. The preview proxies `/api` to the isolated API using `YAANS_TEST_API_TARGET`, which affects Vite preview configuration only. Normal frontend development continues to use backend port 5000.

Browser requests to nonlocal hosts are blocked, so third-party images/fonts cannot make tests depend on an external service or accidentally access production. Browser contexts start fresh for every test. The browser suite uses one worker because the synthetic marketplace database is shared across its desktop/mobile journeys.

Do not replace the test bootstrap with `npm start` or `npm run dev:backend`; those commands are allowed to use the real application's environment. Shutdown removes the test API cache and MongoDB data; downloaded browser/MongoDB executables remain cached for future runs.

## Current coverage

- **Node:** the original cache freshness, request sharing, account/token isolation, image URL, legal loader and mocked Mongo refresh tests; shipping quotes across all 625 origin/destination district combinations; surcharge boundaries; seller/global free-shipping thresholds; flat shipping; intra-district overrides; COD availability.
- **React:** corrupt saved state, cart variants/merging/removal, guest wishlists, session expiry versus transient server failure, stale cart quotes, stale catalogue responses, local resource updates, checkout success/failure/retry state and COD agreement, saved addresses, role-based sign-in navigation, password visibility, product availability/image loading, and cookie preferences.
- **API with MongoDB:** live database readiness, public catalogue filters and visibility, login roles, authorization and cross-seller access, registration, addresses/wishlists, credential changes, server-side prices and multi-seller totals, checkout validation, parent/package creation, tracking with supplied phone verification, seller fulfillment, settlement reconciliation and repeated payout rejection, product CRUD/import, moderation, shipping/COD settings, audit entries, and eventual persistence in the actual MongoDB collections.
- **Browser:** search/product/store navigation, guest multi-seller checkout and tracking, checkout failure/retry, customer login/session restoration/admin denial, failed sign-in, seller fulfillment/admin payout ledger, and all legal route aliases/direct refresh. Every journey runs at desktop and mobile sizes and fails on uncaught browser errors.

This is initial regression coverage, not a claim that all production failure modes are covered. The earlier audit's remaining high-priority cases include overselling/invalid quantities, duplicate checkout submission, direct access to unapproved product URLs, guest tracking/customer-action ownership, strict fulfillment transitions, Mongo write-failure propagation, and concurrent writes from multiple API processes. Backup/restore, Cloudinary failure/size limits, comprehensive admin forms and accessibility/performance budgets also need dedicated follow-up cases. Tests must assert the intended behavior when those areas are corrected; do not weaken assertions to match an existing bug.

## CI and required external release settings

`.github/workflows/quality.yml` runs on every push, pull request, and manual dispatch. Its stable check name is **Marketplace verification**. It installs locked dependencies, checks the preinstalled Chrome version, runs `npm run verify`, and retains browser reports, JUnit output and failure traces for 14 days. No production secrets are supplied to this workflow.

Vercel now runs `npm run verify:deploy`, so Node/React failures fail the deployment build. Browser/MongoDB checks run in GitHub Actions rather than downloading browsers/database executables into each Vercel build. **A green Vercel build alone does not imply the full suite passed.**

After pushing this change and letting the workflow run once, a project administrator must:

1. In GitHub repository branch protection/rulesets, require **Marketplace verification** on the production branch.
2. In Vercel project settings, open **Deployment Checks**, choose **Add Checks → GitHub**, and select **Marketplace verification** as required for production. Confirm the project is linked to this GitHub repository and automatic production aliasing is enabled.
3. Confirm a deliberately failing check holds production promotion before relying on this gate for a release.

These account-level rules cannot be enabled just by committing workflow files. Until Vercel's required check is configured, an automatic production deployment can finish before the full GitHub suite does. Never use Force Promote to bypass a failed required check during normal releases.

References: [Vitest](https://vitest.dev/guide/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [Playwright CI](https://playwright.dev/docs/ci), [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks), [MongoDB test server](https://typegoose.github.io/mongodb-memory-server/docs/guides/quick-start-guide/).
