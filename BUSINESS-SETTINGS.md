# Business policies and storefront configuration

## Administration

Use **Admin > Business Policies & Storefront**. Changes require the current administrator password and the existing dedicated admin/MFA session. Edit fields, save a draft, preview, re-enter the password and publish. Drafts do not appear in public APIs. Publishing is a transaction with durable audit events, optimistic revision checks and an immutable `businesspublications` archive. Restore a published version as a draft and publish it to roll back. The dashboard lists the latest ten previous versions; archived publications are retained separately rather than duplicating policy documents in the live configuration record.

No staff account, seller account, public registration request or generic profile update can publish these settings. HTML is displayed as text. Menu links remain internal; logo and courier tracking URLs must be internal or HTTPS. Input sizes, collection sources and counts, surcharge amounts, purchase quantities and cancellation statuses are bounded. Secrets, session controls, tax rates and unsupported payment gateways are outside the editable schema.

## Connected controls

- Identity: public description/logo/name, operating address, privacy officer, support/privacy emails, telephone and WhatsApp.
- Announcements: enabled state, text, internal destination and start/end times. A single boundary timer updates visibility without polling.
- Navigation/footer: editable internal menu links. Category data remains managed by existing category tools.
- Home: section visibility, actual DOM ordering, desktop/mobile titles, subtitles, bounded item counts and approved collection sources (`homemade`, `deals`, `featured`, `popular`), plus bounded carousel autoplay timing.
- Trust copy, price-filter bands, cookie notice and optional plain-text Terms/Privacy/Cookie documents. Built-in pages use the published operational rules when no replacement document is supplied. Cookie preference reset remains available for custom policy content.
- Delivery: configurable same-district override or destination estimate, item surcharge threshold/amount, seller onboarding defaults and bounds, preparation days and vacation message. The existing district matrix now edits delivery windows. Global free shipping is exposed alongside existing commission/COD settings.
- Seller shipping: seller preparation days feed product/cart/checkout quotes; administrator seller-specific overrides require reauthentication and are audited. Vacation mode continues to block new purchases, and the displayed message reflects that.
- Returns: enabled state, days from recorded delivery, refund processing target, reason lists, category/product eligibility exceptions and safe cancellation stages. New package return rules and parent policy snapshots are saved atomically at checkout. Whole-package returns use the most restrictive item policy; individual-item return processing is not introduced by this change.
- References: bank choices, seller types, optional type-level commission rates and approved courier selections/tracking templates. Retirement preserves historical seller types. New sellers inherit current defaults with no fixed five-percent commission override; existing negotiated overrides remain unchanged. Signup advertises the same rates used in quotes.
- Notification copy: new-order and view-order labels. Existing sound preferences, visible polling, failure backoff and authentication remain intact.

## Orders and policy versions

New orders save the policy version, cancellation stages/reasons, refund target and tax message. Packages retain delivery quote details and item-derived return eligibility/window. Later publication cannot change these snapshots. Return deadlines use server-recorded delivery time; missing delivery timestamps require support review. Earlier orders without snapshots retain their previous treatment. Refund/payout evidence, return inspection, inventory release, transaction/retry protections and guest access capabilities remain mandatory.

Tracking exposes the checkout policy version and links to `/policies/:version/terms`. Published policy archive reads use the indexed version key and cannot expose drafts. Publication history is included in encrypted business backups, unlike transient staff sessions. Refund turnaround is a published operational target; this does not automatically issue refunds or transfers.

## Supported integrations and engineering limits

The current implemented payment integration remains COD in LKR, with no additional tax collection. Public tax wording no longer declares blanket exemption. Changing descriptive copy does not enable VAT, card payments, email, SMS, WhatsApp messaging or push delivery. Those need separately implemented and verified integrations; there are no misleading enable switches. Courier tracking templates link to providers; this does not purchase labels or automatically create courier bookings. Weight-based parcel rating and holiday-calendar calculations remain future integrations rather than unimplemented promises.

Security sessions, MFA, CSRF, upload validation, financial proofs, safe fulfillment transitions and hard resource caps are not ordinary content settings. Configured cart limits may be lower than hard caps of 50 selections / 99 units, never higher.

## Performance and release verification

Settings piggyback on the existing initial home/category request, with existing public browser-cache bounds and publication-triggered invalidation. Public settings exclude drafts, audit logs and publication history. Product details return their computed eligibility and quote rather than duplicating policy documents. Checkout loads compact configuration without draft/history/audit payloads, preserving its original write-version guard. No new per-order settings query or background polling loop is added. Home section queries stay bounded; configuration and archive access use existing singleton/version keys. Historical content is lazy-loaded only when explicitly opened.

Run `npm run verify` before release and retain the required exact-revision Marketplace verification CI gate, including Gitleaks and OWASP checks. Tests cover malformed settings and privilege injection, draft isolation, reauthentication/CSRF, stale revisions, publish rollback, immutable snapshots, return windows, compact-read persistence guards, delivery rules and purchase caps, plus admin preview/publish and responsive storefront journeys. Passing local checks does not establish hosted capacity; production saturation tests are separate.
