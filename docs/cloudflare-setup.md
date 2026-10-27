# Deploy VELORA directly from the existing GitHub repository

No Netlify login or ZIP upload is required. This deploys the same source catalogue, photos, storefront pages and dashboard to a **Cloudflare Worker with Static Assets**. Do not choose a static-only Pages deployment: the dashboard needs the Worker API and database.

## Dashboard steps

1. Open **Compute → Workers & Pages → Create application** and choose the option to import/connect a GitHub repository.
2. Authorize access to `redahasnaouy-stack/SM-ROYALE`, select it, and use branch `main`.
3. Use Worker name **velora**, repository root directory, build command **`npm run build`**, and deploy command **`npx wrangler deploy`**. Dependency installation uses the committed lockfile. Node 24 is specified in `.node-version`; if the build settings ask for a version, use `NODE_VERSION=24`.
4. Deploy. The committed `wrangler.jsonc` declares the static assets and a persistent D1 binding named **DB**. The pinned Wrangler version automatically creates/connects **velora-db**, then reuses the deployed binding on subsequent builds. If Cloudflare asks you to approve creation of this database, approve it. The Worker initializes its records table automatically on the first API request.
5. In this Worker's **Settings → Variables and Secrets**, add **`SM_ADMIN_EMAIL`** and **`SM_ADMIN_PASSWORD`**. Use your own email and a password of 14–200 characters. Mark the password **Secret**. Save/deploy the secret changes. Do not commit credentials or send them through chat. Dashboard variables are preserved across GitHub deployments with `keep_vars: true`. Keep these exact variable names; they preserve the existing dashboard authentication implementation.
6. Open the new `velora.<account-subdomain>.workers.dev` address. Test the catalogue, `/admin/`, a checkout, a product/image edit, and refresh the page to verify persistence.

The precise label of the GitHub import button may vary in Cloudflare's dashboard. If a build reports insufficient D1 permissions or a missing DB binding, open the Worker **Bindings** panel and connect the `velora-db` D1 database as **DB**, or provide its Database ID in `wrangler.jsonc`. Use the database already attached to this Worker; do not create a new database for every deployment.

Do not set `PUBLIC_URL` to the old Netlify address: leaving it unset uses the current request hostname for origin checks. The existing `decanteassil.ma` Worker/domain is unrelated and does not need any changes.

## What is included

- All source catalogue entries and their source prices, images and owner-adopted prices.
- The five VELORA pages, basket and WhatsApp handoff.
- Authenticated product creation, full edits, galleries, image uploads, deletion/restoration, orders and review moderation.
- D1-backed persistent orders, products, uploaded images, reviews, sessions, rate limits and audit records. Existing upload limits keep individual image records within D1's row size limit.

This is a **new installation from GitHub**, not a live-data migration. Netlify-only orders, product overrides, uploaded photos and reviews are not in GitHub and are not automatically copied. The old `*.netlify.app` URL cannot be hosted by Cloudflare. Do not delete the old project until any data you need has been backed up or migrated separately.

## Local checks

```sh
npm ci
npm run build
npm test
npm run test:cloudflare
```

The Cloudflare test suite uses the actual `workerd` runtime with local D1, tests the complete API, and also tests optional R2 photo storage. No production account or credentials are used.

For interactive local development, `npm run cf:dev` uses a local database. Put test credentials in `.dev.vars` (gitignored) only. The `cf:deploy` command deploys remotely and requires authenticating to your own Cloudflare account.

## Optional R2 photo storage

D1 alone is sufficient for the initial deployment. For a larger photo library, create an R2 bucket and add a binding named **MEDIA** to this Worker (or add `r2_buckets` with `binding: "MEDIA"` and your bucket name to the Wrangler config). New uploads then use R2. Previously uploaded D1 images remain readable. The original catalogue assets remain in the static build; no public bucket is required.
