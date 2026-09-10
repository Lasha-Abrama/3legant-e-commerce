# 3legant E-Commerce

A full-stack furniture and homeware store with a responsive customer storefront, an administration dashboard, and Stripe-hosted checkout.

Built with **HTML, CSS, vanilla JavaScript, NestJS, TypeScript, and MongoDB**. The frontend and API share one origin, keeping deployment and cookie-based session renewal straightforward.

## Features

**Shopping**
- Product search, category/price filters, sorting, four Shop views, image galleries, and wishlists.
- Persistent cart, backend-calculated totals, coupon discounts, checkout, and order confirmation.
- Account details, saved addresses, purchase history, verified-purchase reviews, replies, and product questions.
- Editorial blog, related articles, contact form, newsletter signup, and responsive navigation.

**Administration**
- Manage products, stock, blog articles, users, orders, reviews, and customer messages.
- Create readable random coupon codes; edit discounts, expiry, usage limits, and availability.
- Track fulfillment and payment status; request eligible Stripe refunds.

**Authentication and security**
- Email/password login, optional Google OAuth, password recovery, and password-strength validation.
- Short-lived access JWTs held in browser memory, rotating HttpOnly refresh cookies, and hashed refresh tokens in MongoDB.
- Session invalidation on logout and credential changes; current-password confirmation for email changes.
- Server-side authorization, input validation, shared MongoDB rate limiting, security headers, and validated image uploads.

## Payments and coupons

Card details are entered only on **Stripe-hosted Checkout**—the application never collects or stores them.

The backend calculates prices from saved products and coupons. Coupons are checked for validity, activity, expiry, and remaining capacity. Checkout reserves capacity; confirmed payment records usage. Verified cancellation, failure, or expiry releases reservations without counting a purchase.

Signed Stripe webhooks—not the success URL—confirm payment. Idempotent payment handling preserves order totals and avoids duplicate stock deductions. Order snapshots retain their original prices and discounts even if the catalog or coupon changes later.

MongoDB transactions require **Atlas or a replica set**. Ambiguous payment failures need reconciliation; do not manually release coupon reservations merely because time has elapsed. See [auth and coupon implementation notes](AUTH_COUPON_COMPLETION.md).

## Architecture

```text
Frontend/
  *.html              Customer pages
  js/                 Shared API client and page interactions
  css/                Responsive storefront styles
  admin/              Administration pages, scripts, and styles
  images/             Storefront assets
Backend/
  src/                NestJS modules, schemas, services, and Jest tests
  api/index.ts        Vercel API entry point
  e2e/                Playwright browser tests
  verification/       Isolated local browser verification
  .env.example        Environment template (no credentials)
.github/workflows/    Backend CI
vercel.json          Static frontend and API routing
```

The backend uses Mongoose for persistence, Cloudinary for uploads, and Stripe for payments. Email delivery uses optional Resend/password-reset and SMTP integrations. SMTP supports contact notifications and newsletter messaging; consult the [email guide](Backend/src/email/README.md) for configuration and failure behavior.

## Run locally

Prerequisites: **Node.js 20.11+**, npm, MongoDB Atlas/a replica set, and development credentials for the required providers.

```bash
git clone https://github.com/Lasha-Abrama/3legant-e-commerce.git
cd 3legant-e-commerce
cp Backend/.env.example Backend/.env
cd Backend
npm ci
npm run start:dev
```

Fill in `Backend/.env` before starting. Open **http://localhost:5000** for the storefront or **http://localhost:5000/admin/login.html** for admin sign-in. Nest serves both the frontend and `/api` locally; no separate frontend build is required.

### Environment

Use [Backend/.env.example](Backend/.env.example) as the complete template. Never commit populated environment files.

| Purpose | Variables |
| --- | --- |
| Runtime | `NODE_ENV`, `PORT`, `FRONTEND_URL`, optional trusted `TRUST_PROXY` |
| MongoDB | `MONGO_URL` |
| Authentication | `JWT_SECRET` — a strong random secret; at least 32 characters in production |
| Uploads | `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Optional Google login | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` |
| Optional reset email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Optional SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`, `CONTACT_RECIPIENT_EMAIL` |
| Optional development admin | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_FIRST_NAME`, `SEED_ADMIN_LAST_NAME` |

For local Google login, register the exact callback `http://localhost:5000/api/auth/google/callback` with your provider. Production uses the corresponding HTTPS origin.

For local Stripe webhook delivery:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Use Stripe test-mode credentials locally. Set the listener's signing secret in your private environment file.

**Optional seed:** run `npm run seed` from `Backend` only against a disposable development database. It replaces catalog/blog data and is blocked in production. Optional admin creation requires both seed credentials and refuses to promote an existing customer account. There are no published default admin credentials.

## Verification

Run from `Backend/`:

```bash
npm test                       # Jest unit and HTTP integration tests
npm run check                  # TypeScript checking + Nest production build
node verification/local-flows.cjs # Isolated browser auth, UX, and coupon checks
npm run test:e2e                # Playwright; see environment requirements below
```

The isolated browser runner uses real frontend/controller/service paths with controlled persistence and provider fixtures; it does not contact live MongoDB, Google, or Stripe. Browser availability and optional overrides are documented in the [verification guide](Backend/verification/README.md).

Live browser/payment tests require an isolated E2E database and Stripe **test** credentials. Read [E2E setup](Backend/e2e/README.md) first; never point these tests at production. Frontend scripts can also be checked with `node --check <file.js>`. There is no separate frontend package or lint script.

GitHub Actions runs `npm run check` and `npm test` on pushes and pull requests.

## Deployment

[DEPLOYMENT.md](DEPLOYMENT.md) covers Vercel setup, environment variables, providers, and smoke checks. The root `vercel.json` serves static frontend files and routes `/api/*` to the Nest handler.

Before release:
- Configure HTTPS, exact Google redirect URLs, Stripe webhooks, and production email delivery.
- Use a transaction-capable database and ensure coupon/reservation unique indexes exist.
- Configure only a known trusted proxy so IP-based throttling cannot be spoofed.
- Check `GET /api/health` and exercise sign-in, checkout, and webhook delivery.
- Keep secrets out of source control, logs, screenshots, and browser storage.

## Design reference and author

Developed by [Lasha Abramishvili](https://github.com/Lasha-Abrama), with contributions recorded in Git history.

The interface was implemented using the [3legant E-Commerce Figma design](https://www.figma.com/design/Bgx266nDq5W1dS45GanktE/3legant-E-Commerce?node-id=0-1) as a visual reference. Credit for the original design belongs to its respective creator; this repository does not claim authorship of that design.

## License

Original source code is available under the [MIT License](LICENSE).

Third-party libraries, fonts, product photography, other assets, and the referenced Figma design remain subject to their respective owners' rights and licenses. The source-code license does not grant rights to those materials. Bundled third-party notices, including Leaflet's license, are retained.
