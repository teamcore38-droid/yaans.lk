# Red wave header preview

## Scope

The shared header uses a layered crimson/maroon gradient, transparent curved wave folds and fine lines, white header icons and the existing white Yaans.lk logo variant. Announcement and category-navigation bars use coordinated gradients. Search inputs stay light and search buttons remain amber. Configured custom logos are preserved.

Only the header presentation changes. Hero banners, category cards, mobile bottom navigation, APIs, authentication, checkout and business settings are unchanged. The below-380px control spacing and logo width are tightened to avoid an existing horizontal overflow; row and header heights stay the same. Desktop search gains `min-width: 0` so it can fit tablet widths.

## Files

- `frontend/src/components/Navbar.jsx`: theme classes and presentation-only logo variant.
- `frontend/src/styles/header-theme.css`: reusable, scoped gradients, glass controls, keyboard focus and small-phone adjustments.
- `frontend/src/assets/header-red-waves.svg`: approximately 3 KB of transparent SVG paths and gradients. Vite bundles it into the CSS, avoiding another image request and stale unversioned asset caching.
- `frontend/tests/ui/navbar-theme.test.jsx`: branding, custom logo, cart/wishlist counters, search, drawer and district behavior.
- `tests/e2e/header-theme.spec.js`: layout and controls at 320, 360, 393, 768, 820, 1024 and 1440 px, desktop/mobile screenshots, search/location/account/wishlist/cart navigation, and unchanged white mobile bottom navigation.

## Performance and safeguards

There are no animations, blur filters, timers, new dependencies or theme API requests. The SVG overlay is noninteractive, with `pointer-events: none`, and has no script, event handlers or external references. Existing CSP, session, CSRF and rate-limit protections remain in place. The compressed stylesheet increases by approximately 1.5 KB; JavaScript behavior is unchanged.

Local before/after measurement confirms the existing header height: 147 px below 768 px and 101.5 px at the measured desktop/tablet widths. The normal logo dimensions remain unchanged; below 380 px its width is capped without changing the row height.

## Preview and release boundary

Work is on `codex/red-wave-header`; do not merge it to `main` until the owner approves the design. The existing protected branch-preview environment is configured with `APP_ENV=staging`, the isolated `yaans_staging_lk` database and `MAINTENANCE_READ_ONLY=true`. This is the staging review target for this branch; the separate public production deployment is not changed.

The usual stable staging project (`yaans-lk-staging`, `prj_RKhchLytcK57gRzD6yCHJHz6Ojsk`) uses the full release gate. The initial audit blocked that gated promotion; the subsequently authorized temporary exception is documented below. Production still requires successful full verification for the exact commit. The existing branch-preview build policy is unchanged. The Vercel preview URL is returned after publishing. Vercel authentication may be required.

## Verification and dependency finding

The project has no standalone lint script. Build includes the existing hook-order verification. The complete `npm run verify` pipeline requires security checks, Node/React/integration/browser tests and a production bundle build.

Local validation passed: 63 Node tests, 127 React tests, 112 isolated MongoDB integration tests and 46 desktop/mobile browser tests (348 tests total), plus the production bundle build and `git diff --check`. Browser measurements found no horizontal page overflow at all seven widths listed above. The combined `npm run verify` command stopped at the dependency audit, so it is not reported as passing.

On 18 November 2026 (Sri Lanka), the original zero-advisory audit reported GHSA-fc5q-39xc-vjpf in `picomatch`, used by the current frontend build/test toolchain. The advisory lists no patched release, and the latest published version checked was 4.0.7. This is pre-existing tooling exposure, not a dependency added by this design. The original release attempt remained blocked rather than bypassing its required checks.

The owner subsequently authorized a temporary scoped build-tool exception. Its production boundary, mandatory audits, full-report retention and automatic 18 December 2026 expiry are documented in [security-exception-picomatch.md](security-exception-picomatch.md). The earlier blocked results above describe the original unmodified zero-advisory policy; this acceptance does not fix the vulnerable library.

Advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf
