# Yaans.lk – Sri Lankan Multi-Vendor Marketplace (MERN Stack)

A modern, lightweight, mobile-first, fully responsive Sri Lankan multi-vendor e-commerce marketplace built with **MongoDB (Mongoose), Express.js, React.js (Vite + Tailwind CSS), and Node.js**.

## Key Platform Capabilities

1. **Customer Marketplace (Mobile-First, Responsive)**
   - **Adapted Transparent Logo on White Header**: Extracted from the supplied Yaans.lk brand mark with its pink background completely removed (`frontend/public/brand/yaans-logo-horizontal-dark.png`, `yaans-logo-dark.png`, `yaans-mark-dark.png`, `favicon.png`).
   - **2x2 Category Quad Cards**: Modeled directly on the mobile category reference layout for rapid product discovery across mobile, tablet, and desktop.
   - **Sri Lankan Homemade & Cottage Showcase**: Dedicated discovery for home-prepared foods, spices, village terracotta cookware, handloom, and Ayurveda.
   - **Multi-Seller Shopping Cart & Automated Order Splitting**: Customers can add products from multiple sellers into a single cart. Checkout automatically splits the master `Order` (`YLK-2026-XXXX`) into per-seller `SubOrder` packages (`YLK-2026-XXXX-S1`, `-S2`, etc.).
   - **25 Sri Lankan Districts Courier Calculator**: Calculates Same-District, Standard, and Outstation delivery fees in **LKR (Rs.)** per seller shipment, including seller-specific free shipping thresholds and **zero tax calculation**.
   - **Guest Checkout & Registered Checkout with Cash on Delivery (COD)**: Full Sri Lankan address support, COD confirmation, and public Order Tracking by Order Number.

2. **Seller Portal (`/seller/dashboard`)**
   - Supports **Home-Based & Cottage Sellers (5% low commission)**, **Artisan & Craft Vendors**, **Small Businesses**, and **Verified Retail Vendors**.
   - Product & Inventory CRUD with **Cloudinary Image Upload** (`POST /api/seller/upload-image` with automatic local storage fallback).
   - Independent `SubOrder` fulfillment (`Confirmed` → `Packed` → `Shipped` → `Out for Delivery` → `Delivered & COD Collected`).
   - Transparent Earnings & Settlement Ledger showing gross sales, marketplace commission deduction, and bank payout settlements.

3. **Admin & Management Dashboard (`/admin`)**
   - Approve or reject seller applications and product listings.
   - Configure delivery fees and COD availability across all **25 Sri Lankan administrative districts**.
   - Configure marketplace commission rates (`Default %` and `Homemade %`) and execute **Seller Bank Payout Settlements** (`STL-YLK-2026-XXX`).

## Demo Accounts (1-Click Sign-In Available in Header & Login Page)

| Role | Email | Password | Store / Notes |
| :--- | :--- | :--- | :--- |
| **Customer** | `kasun@gmail.com` | `Customer@123` | Saved Colombo 05 & Kandy addresses |
| **Seller (Homemade)** | `kumari@kandykitchen.lk` | `Seller@123` | Kandy Spice & Homemade Pantry (Approved) |
| **Seller (Retail Tech)** | `rizwan@colombotech.lk` | `Seller@123` | Colombo Tech Hub (Approved) |
| **Seller (Pending)** | `suresh@jaffnapalm.lk` | `Seller@123` | Jaffna Palmyrah & Organic Foods (Pending Admin Approval) |
| **Marketplace Admin** | `admin@yaans.lk` | `Admin@123` | Full Marketplace Administration |

## Running Locally

```bash
# Start Backend API (http://localhost:5000)
npm run dev:backend

# Start Frontend Vite Server (http://localhost:5173)
npm run dev:frontend
```
