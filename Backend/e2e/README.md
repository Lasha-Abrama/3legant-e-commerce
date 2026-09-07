# Browser E2E tests

The suite uses Playwright and creates uniquely named, temporary test users, products,
orders, and Stripe test-mode payments. It deletes the MongoDB test data in `afterAll`.

## Required environment

Copy `.env.example` in this directory to a local ignored file and provide an isolated
`E2E_MONGO_URL`. The runtime `.env` in `Backend/` must also contain Stripe **test**
credentials and a webhook secret. Never place credentials in this directory or commit
the copied environment file.

Run the local suite with:

```bash
npm run test:e2e
```

Playwright reads both `Backend/.env` and the ignored `Backend/e2e/.env` directly.
Do not use `source` for a MongoDB URI because query characters such as `&` are valid
in a URI but have special meaning in a shell.

The local server starts on `E2E_PORT` and Stripe Checkout redirects back to it. The
suite submits the Stripe test card `4242 4242 4242 4242`, then delivers signed test
webhooks to the local API so payment and refund behavior can be verified without a
public webhook tunnel.

To target a disposable preview deployment, set `E2E_BASE_URL` as well. Do not target
production with a shared Stripe webhook destination: Stripe may deliver the same
test-mode event to that destination.
