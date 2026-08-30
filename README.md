# 3legant E-Commerce

Full-stack e-commerce application based on the 3legant Figma design. The current implementation uses a static vanilla JavaScript storefront and a NestJS API backed by MongoDB.

## Current architecture

- `Frontend/` — static HTML, CSS, and vanilla JavaScript storefront plus admin pages.
- `Backend/` — NestJS API for authentication, users, products, blogs, reviews, orders, contact messages, newsletter subscriptions, and Cloudinary uploads.
- `vercel.json` — deploys the static storefront and routes `/api/*` to the NestJS Vercel handler.

## Local development

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

## Environment variables

The API requires `MONGO_URL`, `JWT_SECRET`, `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Stripe checkout additionally requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `FRONTEND_URL`. Do not commit `.env` files or credentials. Authentication uses bearer access tokens stored by the browser client.

Checkout sends only the selected payment method; card details are collected by Stripe Checkout and must never be stored or sent to this API. Orders remain `pending` until a signed Stripe webhook confirms payment. Each order uses one idempotent Stripe Checkout Session: retries reuse the existing open session, while its ID, lifecycle status, and expiry are persisted on the order. Completed, failed, and expired session events are recorded from verified webhooks. A successful payment updates the order and decrements product stock in one MongoDB transaction, so duplicate webhook deliveries cannot reduce stock twice. If stock changed before payment completed, the paid order is retained with `inventoryStatus: insufficient` for manual fulfillment review.

After Stripe redirects to the storefront, checkout verifies the returned order through the authenticated `GET /api/orders/:id` endpoint before showing success or clearing the cart. The endpoint is owner-scoped and returns `404` for another user's order. Cancelled checkout attempts preserve the cart and keep the original checkout payload in tab-scoped session storage, allowing the same pending order and Stripe session to be resumed without creating duplicates.

Admins can request a full refund for an unshipped paid order with `POST /api/admin/payments/orders/:orderId/refund`. The order is marked `refunded` only after Stripe sends a signed full-refund webhook. Inventory restoration runs in the same MongoDB transaction and is idempotent; `inventoryStatus: restore_failed` identifies refunds that require manual stock reconciliation. Refunds made externally after shipping are marked `inventoryStatus: return_required` instead of immediately returning items to stock.

Fulfillment status changes are forward-only: `Processing → Shipped → Delivered`. A processing order can become `Cancelled` only when it has no checkout session or its pending session has failed or expired; active and completed payment sessions cannot be cancelled. Paid orders must be refunded before cancellation. Shipping requires both `paymentStatus: paid` and `inventoryStatus: adjusted`; terminal and backward transitions are rejected.

For local Stripe webhooks:

```bash
stripe login
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Copy the `whsec_...` value printed by `stripe listen` into `Backend/.env` as `STRIPE_WEBHOOK_SECRET`. This local secret is temporary and changes when a new listener is started.

## Delivery roadmap

1. Establish repository documentation, secret handling, and a repeatable local setup.
2. Add backend quality checks and baseline tests.
3. Replace session authentication with JWT access tokens and protected API guards.
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
