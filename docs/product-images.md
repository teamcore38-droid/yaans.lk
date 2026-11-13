# Product galleries

Seller, administrator and permitted staff editors share a gallery with multiple-file selection, individual replacement/removal, ordering and a main-image selector. The first array entry is the main image. Changes are persisted with the product save, using existing authorization and write-conflict protections.

- New galleries accept one to eight images. Existing galleries above eight may be retained, reordered or reduced; adding/replacing requires reducing to eight first. No automatic truncation occurs.
- Uploads accept static JPEG, PNG and WebP, up to 4 MiB and 25 megapixels. The existing 4 MiB multipart limit is retained for serverless request compatibility. Files upload sequentially through the existing authenticated, rate-limited endpoints.
- Sharp decodes the image, applies orientation, resizes within 1600 × 1600 without enlargement, strips metadata and encodes WebP before Cloudinary storage. Sharp is loaded only when processing an upload. Category/banner upload behavior is unchanged.
- Existing HTTPS and internal image URLs remain supported by product APIs. These references are not downloaded by the server; upload decoding guarantees apply to uploaded files. CDN originals use the existing responsive delivery helper, including small lazy-loaded gallery thumbnails. Only the selected full-size image is mounted.
- Replacements do not detach the old reference until upload succeeds. A failed batch retains successfully uploaded images in the editor and shows the failure. Saving is disabled during uploads. Closed editors ignore late upload results.
- Removal detaches the reference on save. It does not destroy the Cloudinary asset: legacy products and other records can share URLs. Abandoned uploads and detached assets remain in storage; automated garbage collection is outside this change and must account for all references before deleting anything.

Verification covers image decoding/limits, legacy preservation, upload failure behavior, multipart CDN handoff using a test double, ownership and staff permission checks, persisted ordering, and desktop/mobile gallery editing and selection. Tests use isolated MongoDB and never upload to production Cloudinary.
