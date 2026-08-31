# 3legant E-Commerce

Full-stack e-commerce application based on the 3legant Figma design. The current implementation uses a static vanilla JavaScript storefront and a NestJS API backed by MongoDB.

## Current architecture

- `Frontend/` — static HTML, CSS, and vanilla JavaScript storefront plus admin pages.
- `Backend/` — NestJS API for authentication, users, products, blogs, reviews, orders, contact messages, newsletter subscriptions, and Cloudinary uploads.
- `vercel.json` — deploys the static storefront and routes `/api/*` to the NestJS Vercel handler.
- `DEPLOYMENT.md` — production environment, provider, webhook, and smoke-test checklist.

## Local development

Use Node.js 20.11 or newer.

1. Copy `Backend/.env.example` to `Backend/.env` and set each value locally.
2. Install API dependencies from the lockfile:
   ```bash
   cd Backend
   npm ci
   ```
3. Run the API and storefront:
   ```bash
   npm run start:dev
   ```
4. Open `http://localhost:5000`.

## Verification

GitHub Actions runs the backend type-check, production build, and full test suite on every push and pull request. The same checks can be run locally with the commands below.

Run the backend type-check and production build together:

```bash
cd Backend
npm run check
```

Run isolated backend tests:

```bash
cd Backend
npm test
```

Run only the isolated HTTP integration suite with `npm run test:api`. It starts a temporary Nest application and exercises routing, validation, authorization, security headers, order boundaries, and multipart uploads with mocked persistence and external integrations, so it never writes to the configured database or Cloudinary account.

After deployment, use `GET /api/health` as the hosting health probe. A ready API returns `200` with `{ "status": "ok" }` and disables response caching.

Seed development catalog data with `npm run seed`. Seeding is blocked when `NODE_ENV=production` because it replaces the product and blog collections. Administrator creation is optional: set both `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` of at least 12 characters. The seed never prints the password and refuses to promote an existing non-admin account.

## Environment variables

The API requires `MONGO_URL`, `JWT_SECRET`, `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Stripe checkout additionally requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `FRONTEND_URL`. Production password-reset email requires a Resend sending key in `RESEND_API_KEY` and a verified sender in `EMAIL_FROM`; development can omit both and receives a local reset link in the API response. Do not commit `.env` files or credentials. Authentication uses bearer access tokens stored by the browser client. When deploying behind a known reverse proxy, set `TRUST_PROXY` to a numeric hop count, a named Express range such as `loopback`, or a trusted subnet so IP-based controls use the correct client address. The unsafe value `true` is rejected.

Startup validates every required integration setting before connecting or listening. MongoDB, Stripe, webhook, frontend URL, port, and JWT formats must be valid; production requires a JWT secret of at least 32 characters. Validation errors identify only the variable name or expected format and never print configured secret values.

JWTs carry the user's token version. Password changes, password resets, and authenticated logout increment that version, immediately rejecting every previously issued token. Password recovery stores only a SHA-256 hash of a random one-hour reset token, returns the same response for known and unknown emails, and deletes the token after successful use. Existing pre-version tokens remain valid only while the account version is `0`. Profile email changes are normalized and checked for uniqueness before saving, with duplicate-key races returned as a validation error instead of an internal server error.

Administrator guards enforce the same token-version invalidation as customer routes. Role management prevents self-demotion and rejects attempts to remove the final administrator account; the dashboard locks the current administrator row and confirms every role change.

Checkout sends only the selected payment method; card details are collected by Stripe Checkout and must never be stored or sent to this API. Orders remain `pending` until a signed Stripe webhook confirms payment. Each order uses one idempotent Stripe Checkout Session: retries reuse the existing open session, while its ID, lifecycle status, and expiry are persisted on the order. Completed, failed, and expired session events are recorded from verified webhooks. A successful payment updates the order and decrements product stock in one MongoDB transaction, so duplicate webhook deliveries cannot reduce stock twice. If stock changed before payment completed, the paid order is retained with `inventoryStatus: insufficient` for manual fulfillment review.

After Stripe redirects to the storefront, checkout verifies the returned order through the authenticated `GET /api/orders/:id` endpoint before showing success or clearing the cart. The endpoint is owner-scoped and returns `404` for another user's order. Cancelled checkout attempts preserve the cart and keep the original checkout payload in tab-scoped session storage, allowing the same pending order and Stripe session to be resumed without creating duplicates.

Admins can request a full refund for an unshipped paid order from the Orders dashboard or with `POST /api/admin/payments/orders/:orderId/refund`. The dashboard shows payment and inventory state and exposes the refund control only when the order is eligible. The order is marked `refunded` only after Stripe sends a signed full-refund webhook. Inventory restoration runs in the same MongoDB transaction and is idempotent; `inventoryStatus: restore_failed` identifies refunds that require manual stock reconciliation. Refunds made externally after shipping are marked `inventoryStatus: return_required` instead of immediately returning items to stock.

Fulfillment status changes are forward-only: `Processing → Shipped → Delivered`. The Orders dashboard only offers transitions currently allowed by these rules. A processing order can become `Cancelled` only when it has no checkout session or its pending session has failed or expired; active and completed payment sessions cannot be cancelled. Paid orders must be refunded before cancellation. Shipping requires both `paymentStatus: paid` and `inventoryStatus: adjusted`; terminal and backward transitions are rejected.

Product reviews are verified-purchase only. The API confirms the product exists and appears in one of the authenticated customer's paid, non-cancelled orders before accepting a review. A compound unique index permits one review per customer and product, including under concurrent requests; product rating aggregates are recalculated after successful creation or admin deletion.

Wishlist mutations validate both the authenticated user and product reference. Missing products and users return `404`, duplicate additions remain idempotent through `$addToSet`, populated legacy references to deleted products are filtered from responses, and deleting a product removes it from every customer wishlist.

Customer-facing and admin HTML rendering treats API and browser-storage values as untrusted. Shared helpers encode text and quoted attributes, allow only HTTP(S) image URLs, and restrict dynamic color values to hexadecimal CSS colors before account, checkout, cart, catalog, product, review, order, user, message, or blog content is inserted with `innerHTML`.

Authentication return URLs are restricted to the storefront's current origin before navigation. External, malformed, and non-HTTP(S) `next` values fall back to the account page instead of becoming post-authentication redirects.

Helmet adds browser security headers and a content security policy that permits the storefront's local assets, HTTPS images, Google Fonts, and existing inline styles. A global in-memory rate limit allows 120 requests per IP per minute, while login, registration, contact, and newsletter endpoints use tighter limits. The in-memory store is process-local; use a shared throttler storage provider before scaling the API across multiple instances.

Administrator image uploads accept one file up to 4 MB and verify its binary signature instead of trusting the browser-provided MIME type. The limit leaves room for multipart overhead under Vercel's request-body limit. Only JPEG, PNG, GIF, and WebP files are accepted; SVG and other active or executable formats are rejected before Cloudinary upload. Uploads are additionally limited to 10 requests per IP every 15 minutes.

For local Stripe webhooks:

```bash
stripe login
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Copy the `whsec_...` value printed by `stripe listen` into `Backend/.env` as `STRIPE_WEBHOOK_SECRET`. This local secret is temporary and changes when a new listener is started.

## Delivery roadmap

1. Establish repository documentation, secret handling, and a repeatable local setup.
2. Add backend quality checks and baseline tests.
3. Maintain JWT access tokens, token-version invalidation, and protected API guards.
4. Harden core domains: products, cart/checkout, orders, reviews, and admin authorization.
5. Document and test public/admin API flows.
6. Rebuild the storefront in Next.js only after the API contract is stable.

## Commit convention

Use focused Conventional Commit-style messages:

- `chore:` tooling, configuration, repository hygiene
- `docs:` documentation
- `feat:` user-facing capability
- `fix:` bug correction
- `test:` tests only
- `refactor:` behavior-preserving code changes

Each commit should build successfully and explain one meaningful change.
