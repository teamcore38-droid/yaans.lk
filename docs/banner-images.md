# Independent desktop and mobile banners

Desktop and mobile image fields are independent when creating, editing, uploading and saving a homepage banner. Existing shared URLs and legacy `/mobile_hero_banner.jpg` references are preserved. The explicit “Copy from Desktop/Mobile” actions are available when an administrator wants to share artwork.

An empty device field stays empty in storage. The existing public catalog and responsive `<picture>` continue to display the other image as a fallback, using the same 768 px breakpoint, responsive CDN sizing and lazy loading. No migration, additional requests, dependencies, polling or storefront JavaScript changes are required.

The editor accepts the existing server-supported JPG, PNG, WebP, GIF and AVIF formats up to 4 MiB and gives immediate feedback for incompatible files. Authentication, cookies/CSRF, role checks, rate limits, multipart limits and server-side byte validation are unchanged. An upload replaces only its selected field after success; failures preserve both existing images. Closing or unmounting the editor aborts pending uploads and ignores stale responses. Canceling does not delete uploaded CDN assets or save image changes.

Regression coverage includes shared and distinct artwork, independent URL edits and explicit copying, missing/legacy references, concurrent uploads, failed upload retries, file limits, cancel/unmount behavior, actual secured API writes against disposable MongoDB, multipart/CDN handoff with a storage test double, and desktop/mobile browser save-and-display journeys. Run `npm run verify` before release; retain the existing required CI and exact-commit production gate. Browser upload responses are simulated locally, and no tests write to production Cloudinary or MongoDB.
