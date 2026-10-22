# SM Royale

A royal black-and-gold storefront in Modern Standard Arabic and English, with a persistent shopping basket, on-site cash-on-delivery checkout and a private administration dashboard.

## Deploy to Netlify

**Import this GitHub repository and select `main`. Do not upload only `dist/` using Netlify Drop:** checkout needs the serverless function and durable storage as well as the frontend. `netlify.toml` configures the build, function routing and security headers.

1. In Netlify choose **Add new project → Import an existing project → GitHub → redahasnaouy-stack/SM-ROYALE**, branch **main**.
2. Leave the repository's build settings in place (`npm ci && npm run build`, publish directory `dist`). Node 24 is specified.
3. In **Project configuration → Environment variables**, add the following with **Functions** scope, mark the password as a secret, and redeploy:
   - `SM_ADMIN_EMAIL`: your administrator email.
   - `SM_ADMIN_PASSWORD`: your own strong password of 14–200 characters. Never put it in GitHub, frontend code or chat.
4. Visit `/admin/` on the deployed Netlify domain and sign in using those values.
5. Submit a test checkout and verify it appears in the administration dashboard before accepting customer orders.

Netlify Functions automatically supply the authentication context for **Netlify Blobs**. The site-wide store `sm-royale-store-v1` retains orders, product overrides, audit records and hashed sessions across deployments. Do not use a deploy-scoped store or the function's temporary filesystem for order data. No separate database API key is required. Netlify service availability, account permissions and usage charges are managed in your Netlify account; production connectivity must be verified there.

For an alternative credential configuration, `npm run admin:hash` interactively creates a scrypt password verifier to use as `SM_ADMIN_PASSWORD_HASH` instead of `SM_ADMIN_PASSWORD`. The hash setting takes precedence. Changing the configured owner password invalidates previous owner sessions.

**GitHub Pages cannot run this checkout or its administration API.** A static preview can display the catalogue and basket, but displays an unavailable notice and refuses order submission if the backend cannot be reached. It never pretends to save a customer order in the browser.

## Local development

Requires Node.js **24+**. Install reproducibly and start:

```sh
npm ci
npm run dev
```

The default port is 3000 (`PORT` overrides it). Local development uses SQLite at `data/store.sqlite`; `DATABASE_PATH` can override the location. Database files, `.env` files and customer data are ignored by Git. Stop the server before manually copying the database for a consistent offline backup.

Create a local administrator interactively:

```sh
npm run admin:create
```

The password input is hidden and only a salted scrypt verifier is stored. To use environment-based owner authentication locally, inject `SM_ADMIN_EMAIL` and `SM_ADMIN_PASSWORD` through your process environment; the application does not automatically load `.env` files. Do not reuse test credentials in production.

```sh
npm test
npm run build
```

`npm run build` recreates `dist/` from `public/`. Functions and server source are deployed from the repository by Netlify, not copied into the public directory.

## Shopping and order processing

- Customers select a product, size, quantity and optional colour/model, then enter name, phone, city and delivery address. Email and notes are optional.
- The basket survives reloads in the same browser. Customer addresses and phone numbers are sent to the server and are not saved in browser storage.
- Checkout sends an idempotent request to `/api/orders`, receives an order reference and stays on the website. There are no WhatsApp contact or checkout redirects.
- Payment is **cash on delivery**. No card payment or online money collection is implemented.
- The server obtains authoritative prices from its catalogue. Client-supplied prices are ignored. Unknown product prices remain `null`; they are never treated as zero or free.
- Shipping is initially unspecified, not free. The final amount is confirmed by phone before dispatch. Orders containing unpriced products start in “pricing pending”.
- The administrator must enter all unit prices and shipping before confirming or progressing an order. Catalogue changes only affect new orders; old orders retain their recorded names, sizes and prices.
- No physical inventory reservations, shipping-carrier integrations or email/SMS notifications are claimed. Availability is an administrator-controlled ordering switch.

## Administration

The protected `/admin/` interface provides actual order counts and amounts collected, a seven-day order chart, status breakdowns, searchable/filterable orders, order details, delivery charges, editable unit prices, payment/status tracking, internal notes, catalogue price/availability management, a customer summary and CSV export. It refreshes every 30 seconds when visible and no editor is open.

Sessions expire after eight hours. Production cookies use Secure, HttpOnly and SameSite=Strict. Mutations require the session's CSRF token, JSON content and same-origin requests. Passwords are never sent to the frontend. Login and checkout have durable per-IP request limits. Conditional storage writes protect against duplicate order submissions and conflicting administration updates. Customer CSV files contain personal data and must be handled privately.

Order states: `new`, `pricing_pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`. Payment states: `unpaid`, `paid`, `refunded`. The dashboard is protected by the backend, not merely a hidden page or a browser password check.

## Content and design

The bilingual catalogue contains 161 supplied product visuals, 121 priced variants for 31 matched entries, plus a separate 13-line hijama price guide. The original uploaded imagery and pricing provenance are retained locally in `docs/catalogue-sources.json` (not published). Unmatched prices remain for review. Product photos are not altered by the decorative frames.

The transparent crown/SM logo was extracted from the supplied brand image. The cinematic hero is a generated brand illustration, not a guarantee of exact catalogue models. Cairo, Manrope and Cormorant Garamond fonts are served locally with their license notices.

Key files:

- `public/shop.js`: basket, checkout and receipt UI.
- `public/admin.html`, `public/admin.js`: private dashboard UI.
- `public/catalogue.js`, `public/products.json`: product catalogue and base data.
- `server.mjs`: validated checkout and administration API.
- `lib/store.mjs`: business rules, prices, authentication and idempotency.
- `lib/repository.mjs`: local SQLite and Netlify Blobs adapters.
- `netlify/functions/api.mjs`, `netlify.toml`: serverless deployment.

## Validation

`npm test` exercises authoritative pricing, order validation, unknown prices, delivery confirmation, duplicate retries, authentication/CSRF/origin protections, logout, catalogue updates, persistence and concurrent duplicates, the Netlify request adapter and owner password rotation. The Blobs adapter is tested against Netlify's official local emulator; the fixture restores its missing GET ETag from its LIST response so actual conditional PUT checks are exercised. This does not establish live Netlify account connectivity.

Real Chromium checks cover cart quantities and variants, persisted baskets, bilingual checkout, server order creation, admin login, dashboard visibility, shipping/status changes, catalogue price changes, customer summaries, unknown-price handling, mobile layouts and logout. Only synthetic customer data and temporary test administrator credentials are used; no demo orders or accounts are shipped.

Administration uses the canonical `/admin/` directory route (`dist/admin/index.html`). Its assets and API URLs resolve from the site root. Do not add a redirect from `/admin/` back to `/admin`: that can conflict with Netlify pretty-URL canonicalisation.
