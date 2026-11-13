# Customer sign-in and purchase continuation

Customer password login, email registration and Google login use the same allowlisted return destinations. Header links preserve the current customer page and query (including product/results filters), while login/register/fallback links preserve the explicit return URL. Direct login and direct customer registration default to `/account`. Sellers, staff and administrators retain their dedicated destinations. Guest tracking fragments are never copied into header authentication links.

Checkout permits guests to purchase without an account and offers a real sign-in link returning to `/checkout`. New Google customers still confirm name and terms; delivery information remains a checkout requirement. Successful authentication never automatically submits an order. Guest orders are not reassigned by matching an email address, and their private access codes remain required.

## Checkout draft privacy and lifecycle

- A same-tab custom event captures the checkout form immediately before an explicit sign-in/register navigation, whether from the header or checkout banner. No storage writes happen per keystroke, and no background network traffic or polling is added.
- `yaans_checkout_draft_v1` uses sessionStorage only. An allowlist contains bounded delivery/contact fields and the selected district. It excludes credentials, auth/CSRF/guest-access tokens, prices, payment information and COD consent.
- Reads validate the format, size, 30-minute restore deadline and cart identity (product IDs, variants and quantities). Drafts from one customer never transfer to another. A guest draft created for sign-in binds to the successfully authenticated customer; privileged sign-in clears it.
- Logout and successful/recovered checkout clear the draft. Expired/corrupt records are deleted on access. Blocked storage falls back to ordinary checkout without interrupting authentication. Draft storage is convenience data, never proof of order ownership or authority for price/inventory decisions.
- Existing checkout retry keys remain intact throughout authentication and resume; no new order is submitted on return. Delivery data is still validated by the server, along with the existing stock, COD, CSRF, rate-limit and idempotency controls.

The selected shopping district survives password login, registration and Google login. A default account district is applied only when there is no prior selection. A saved address in another district is applied only when the customer explicitly chooses it. A resumed delivery draft takes precedence over automatic saved-address prefilling.

An expired checkout session displays a reauthentication action while retaining entered fields. Fresh Google sign-in can discard an invalid/expired Yaans session cookie; it does not ignore live-session CSRF failures, permit privileged roles through customer login, or waive authentication for sensitive password setup.

## Verification

Run `npm run verify` (dependency audit, unit tests, UI tests, isolated MongoDB integration tests, production build and desktop/mobile browser journeys). Browser fixtures replace only the remote Google provider; they never use production credentials or customer data. Required GitHub secret-scanning and OWASP checks must pass before merging/deploying. No environment-variable changes or database migration are required for this update.
