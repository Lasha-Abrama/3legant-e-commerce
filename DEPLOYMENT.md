# Production deployment

This repository is configured for a single Vercel project: the static storefront is served from `Frontend/`, and requests under `/api/*` are handled by the NestJS serverless entry point in `Backend/api/index.ts`.

## 1. Prepare provider accounts

- Create a production MongoDB database and a least-privilege database user. Configure Atlas network access for the deployment while avoiding broader access than necessary.
- Create or select the Cloudinary cloud used for product and blog images.
- Complete Stripe account setup. Use test keys until the complete checkout, webhook, refund, and inventory flows pass.
- Verify a sending domain in Resend and create an API key for password-reset email.

## 2. Import the project into Vercel

1. Import the repository into Vercel.
2. Keep the project root at the repository root; do not select `Backend/` or `Frontend/` as the root directory.
3. Choose **Other** as the framework preset if Vercel does not detect one.
4. Do not add separate build or output-directory overrides. `vercel.json` owns routing and builds.

## 3. Configure production environment variables

Add these values in the Vercel project for the Production environment. Add them to Preview only if preview deployments should use isolated preview services.

| Variable | Production requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGO_URL` | Production MongoDB connection URL, including the database name |
| `JWT_SECRET` | Unique random secret containing at least 32 characters |
| `CLOUDINARY_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `STRIPE_SECRET_KEY` | Stripe test or live secret key matching the deployment mode |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from the production Stripe webhook created in the next step |
| `FRONTEND_URL` | Canonical HTTPS storefront origin with no trailing slash |
| `RESEND_API_KEY` | Resend key beginning with `re_` |
| `EMAIL_FROM` | Sender on the verified Resend domain |
| `TRUST_PROXY` | `1` for Vercel's trusted forwarding hop |

Do not put production secrets in `Backend/.env`, commit them, or expose them through frontend JavaScript. `PORT` is optional on Vercel because the serverless handler does not open its own listener.

## 4. Create the Stripe webhook

After the first deployment has a stable production domain, create a Stripe webhook endpoint at:

```text
https://YOUR_DOMAIN/api/payments/webhook
```

Subscribe it to these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Copy the endpoint's `whsec_...` signing secret into the Vercel `STRIPE_WEBHOOK_SECRET` variable, then redeploy. A Stripe CLI signing secret is only for the local listener and must not be used in production.

## 5. Deploy and verify

Run the local release checks before deploying:

```bash
cd Backend
npm ci
npm run check
npm test
```

After deployment, verify each production flow:

1. Open `/api/health` and confirm a `200` response containing `{ "status": "ok" }`.
2. Register, sign in, sign out, and sign back in.
3. Request a password reset and confirm the Resend email points to the production domain.
4. Load the catalog, product detail, blog, contact, and account pages.
5. Upload a JPEG, PNG, GIF, or WebP image smaller than 4 MB from the admin area.
6. Place a Stripe test order with card `4242 4242 4242 4242`, any future expiry, and any CVC.
7. Confirm the signed webhook marks the order paid and adjusts inventory exactly once.
8. Run an eligible admin refund and confirm the refund webhook restores inventory exactly once.
9. Confirm account, checkout, and authentication pages return `Cache-Control: private, no-store`.

Use Stripe live keys only after the complete test-mode checklist passes. When switching modes, replace both the Stripe secret key and webhook signing secret; test and live webhooks have different secrets.

## Operational notes

- `FRONTEND_URL` controls Stripe redirect and password-reset URLs. Preview deployments still redirect to this configured origin unless they receive their own isolated value.
- Vercel's function request limit includes multipart overhead, so application uploads are capped at 4 MB rather than the platform maximum.
- The current throttling store is process-local. Replace it with shared storage before relying on rate limits across multiple instances.
- MongoDB transactions used by payment and inventory flows require a replica set; MongoDB Atlas clusters provide this capability.
