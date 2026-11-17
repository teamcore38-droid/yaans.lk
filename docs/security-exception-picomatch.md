# Temporary picomatch build-tool exception

Owner authorization: the repository owner explicitly requested this scoped CI/CD exception on 18 November 2026. Review date: **18 December 2026** (30 calendar days). It expires automatically at **00:00 Asia/Colombo on 18 December 2026**; review before that boundary. Expiry fails the security check and blocks release until a reviewed policy change or remediation is committed.

## Scope and justification

Only `GHSA-fc5q-39xc-vjpf` for `picomatch` **2.3.2 and 4.0.7**, exclusively in the frontend development dependency graph, is temporarily accepted. There is no officially patched version at the time of approval. These tools build assets and execute tests; the exception accepts remaining build-time risk and does not assert the vulnerable code is fixed. No package source, installed dependency, package version or lockfile is changed.

Installed paths reviewed:

- Tailwind CSS -> micromatch / chokidar / anymatch / readdirp -> picomatch 2.3.2.
- Vite -> picomatch / fdir / tinyglobby -> picomatch 4.0.7.
- Vitest -> picomatch / tinyglobby -> picomatch 4.0.7.

## Production runtime boundary

All three production dependency audits (root, backend and frontend) reported zero advisories. All installed picomatch occurrences in the lockfiles are marked `dev: true` and confined to the frontend. The security script checks this on every run, independently of advisory feed results, and refuses acceptance if any occurrence becomes a production dependency or appears outside the frontend.

Source review of `api/`, `backend/src/` and `frontend/src/` found no import of picomatch, Vite or Vitest. Existing dynamic imports use literal application module paths and known runtime libraries; no request-supplied module loading was found. The API entry imports the Express application from `backend/src/server.js`. Runtime dependencies contain no picomatch occurrence. Production Vercel routing serves prebuilt `frontend/dist` assets and routes `/api/*` to `api/index`; Vite's dev/preview servers are not production request handlers. Customer search strings, product content and uploads therefore do not reach these build-tool glob matchers in the reviewed deployment architecture.

The Vite production build now inspects emitted chunk module graphs and fails if picomatch, Vite or Vitest is included in the browser runtime bundle. This guard does not change emitted UI or application code. Changes to production imports, dependencies or deployment architecture require a new exposure review; a development dependency label alone is not proof of safety.

Build/test tooling still executes on repository-controlled patterns and source files. Untrusted code in a pull request is a separate CI risk: the existing workflow uses read-only GitHub permissions, no persisted checkout credentials and no production application secrets. The existing job timeout remains enforced. This exception does not authorize exposing a Vite development server publicly or passing customer-controlled patterns to build tooling.

## Mandatory checks and visible findings

`npm run verify` still requires security policy checks, all Node/React/MongoDB/browser tests and the production bundle build. Secret scanning, OWASP source scanning and exact-commit production release verification remain unchanged.

For **each** root/backend/frontend directory, the security check runs:

1. `npm audit --omit=dev --audit-level=high --json` with **no exception**. The report is also inspected to reject lower-severity unapproved findings, preserving the previous stricter policy.
2. Full `npm audit --json`, including development dependencies. Only graph paths whose every advisory leaf is the approved GHSA and whose nodes are development-only may pass. Mixed advisories, missing graph edges, unknown nodes and cycles fail closed.
3. The complete locked inventory is checked against OSV. Only the exact approved GHSA/package/versions/development scope may pass. Every other finding, feed error or malformed/incomplete response fails.

Full npm and OSV JSON reports are retained in `test-results/security/` and uploaded even on failure as the `dependency-security-reports` artifact for 30 days. All npm reports, OSV findings and a prominent temporary-acceptance/expiry message are printed in the CI log. Findings remain visible; they are classified as accepted risk rather than removed. No audit command uses `fix --force`, and no global severity threshold or broad package allowlist suppresses development findings.

## Review/removal

Before expiry, check upstream fixes and this deployment's runtime boundary. Once an appropriate release is available, update dependencies without forced breaking upgrades, remove this acceptance, regenerate lockfiles as needed, and run the unchanged complete verification suite plus production audits and staging checks. Extending acceptance requires an explicit owner decision and reviewed changes to both the policy document and strict validator. Do not silently renew it.
