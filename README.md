# Yaans.lk – Sri Lankan Multi-Vendor Marketplace (MERN Stack)

A modern, lightweight, mobile-first, fully responsive Sri Lankan multi-vendor e-commerce marketplace built with **MongoDB (Mongoose), Express.js, React.js (Vite + Tailwind CSS), and Node.js**.

## Key Platform Capabilities

1. **Customer Marketplace (Mobile-First, Responsive)**
   - **Adapted Transparent Logo on White Header**: Extracted from the supplied Yaans.lk brand mark with its pink background completely removed (`frontend/public/brand/yaans-logo-horizontal-dark.png`, `yaans-logo-dark.png`, `yaans-mark-dark.png`, `favicon.png`).
   - **2x2 Category Quad Cards**: Modeled directly on the mobile category reference layout for rapid product discovery across mobile, tablet, and desktop.
   - **Sri Lankan Homemade & Cottage Showcase**: Dedicated discovery for home-prepared foods, spices, village terracotta cookware, handloom, and Ayurveda.
   - **Multi-Seller Shopping Cart & Automated Order Splitting**: Customers can add products from multiple sellers into a single cart. Checkout automatically splits the master `Order` (`YLK-2026-XXXX`) into per-seller `SubOrder` packages (`YLK-2026-XXXX-S1`, `-S2`, etc.).
   - **25 Sri Lankan Districts Courier Calculator**: Calculates Same-District, Standard, and Outstation delivery fees in **LKR (Rs.)** per seller shipment, including seller-specific free shipping thresholds and **zero tax calculation**.
   - **Guest Checkout & Registered Checkout with Cash on Delivery (COD)**: Full Sri Lankan address support, COD confirmation, and private order tracking using the owning account or a guest access code.

2. **Seller Portal (`/seller/dashboard`)**
   - Supports **Home-Based & Cottage Sellers (5% low commission)**, **Artisan & Craft Vendors**, **Small Businesses**, and **Verified Retail Vendors**.
   - Product & Inventory CRUD with **Cloudinary Image Upload** (`POST /api/seller/upload-image` with automatic local storage fallback).
   - Independent `SubOrder` fulfillment (`Confirmed` → `Packed` → `Shipped` → `Out for Delivery` → `Delivered & COD Collected`).
   - Transparent Earnings & Settlement Ledger showing gross sales, marketplace commission deduction, and bank payout settlements.

3. **Admin & Management Dashboard (`/admin`)**
   - Approve or reject seller applications and product listings.
   - Configure delivery fees and COD availability across all **25 Sri Lankan administrative districts**.
   - Configure marketplace commission rates (`Default %` and `Homemade %`) and execute **Seller Bank Payout Settlements** (`STL-YLK-2026-XXX`).

## Accounts and production safety

No default administrator or demo customer/seller account is created. Provision an administrator explicitly with `node backend/scripts/provision-admin.js --email=<owner-email>`; use `--reset-existing` to recover an existing administrator. Password input is hidden and must be at least 14 characters. See [SECURITY-RELEASE.md](SECURITY-RELEASE.md) for credential recovery, encrypted backups and release gates.

## Running Locally

```bash
# Start Backend API (http://localhost:5000)
npm run dev:backend

# Start Frontend Vite Server (http://localhost:5173)
npm run dev:frontend
```

## Performance and verification

- Page code and public catalog data load in parallel. Hovering, focusing, or touching an internal link warms its next page; speculative requests are skipped on data-saving and 2G connections.
- Public catalog responses share in-flight requests and stay cached for 15 seconds (categories: 60 seconds). The homepage and categories also use a small session cache. Successful edits and checkout invalidate catalog caches; account and order responses are never cached.
- Checkout recalculates prices and shipping on the server. Cached product prices are only for browsing.
- Visible images receive priority, hidden banner slides load progressively, and Cloudinary delivers responsive images with the same artwork and crop. Fonts load without blocking the first render.
- Each route reads an explicit database selection. Writes update only changed records/fields, await a MongoDB transaction and reject stale versions. Business data is never synchronized from a process-wide snapshot.
- Checkout reserves product/variant stock and creates parent/package records atomically. A persistent retry key prevents duplicate orders after uncertain responses. Guests receive a private, expiring tracking code.
- Use MongoDB Atlas or a local replica set and configure a unique random `JWT_SECRET` of at least 32 characters. Database/authentication failures have no JSON-store, default-secret or seed-admin fallback.

Run `npm run verify` before releasing: it runs the existing Node tests, React interaction tests, API integration tests against disposable MongoDB, the production frontend build, and Chromium journeys at desktop and mobile sizes. Tests never use the configured application database. See [TESTING.md](TESTING.md) for setup, individual commands, coverage, and the required GitHub/Vercel release settings.
