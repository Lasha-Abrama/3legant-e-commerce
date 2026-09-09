import { expect, test } from '@playwright/test';
import mongoose, { Connection } from 'mongoose';
import Stripe from 'stripe';

const mongoUrl = process.env.E2E_MONGO_URL;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const runStripe = process.env.E2E_RUN_STRIPE === 'true';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const account = {
  email: `e2e.${runId}@example.test`,
  password: 'E2ePassword!234',
  firstName: 'E2E',
  lastName: 'Customer',
};
const product = {
  name: `E2E Product ${runId}`,
  sku: `E2E-${runId}`,
  price: '24.00',
  stock: '6',
};

let database: Connection;
let productId = '';
let orderId = '';
let stripe: Stripe;

async function login(page: import('@playwright/test').Page, destination: RegExp) {
  await page.goto('/login.html');
  await page.locator('[name="email"]').fill(account.email);
  await page.locator('[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(destination);
}

function orderFilter() {
  return {
    'contact.email': account.email,
    'items.productId': new mongoose.Types.ObjectId(productId),
  };
}

async function getOrder() {
  return database.collection('orders').findOne(orderFilter());
}

async function sendWebhook(baseURL: string, event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: stripeWebhookSecret as string,
  });
  const response = await fetch(`${baseURL}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });
  expect(response.status).toBe(201);
}

test.describe.serial('storefront critical customer and admin journeys', () => {
  test.skip(
    !mongoUrl || !stripeSecretKey || !stripeWebhookSecret || !runStripe,
    'Set E2E_MONGO_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and E2E_RUN_STRIPE=true to run browser E2E tests.',
  );

  test.beforeAll(async () => {
    database = await mongoose.createConnection(mongoUrl as string).asPromise();
    stripe = new Stripe(stripeSecretKey as string);
  });

  test.afterAll(async () => {
    if (!database) return;
    await database.collection('orders').deleteMany({ 'contact.email': account.email });
    await database.collection('products').deleteMany({ sku: product.sku });
    await database.collection('users').deleteMany({ email: account.email });
    await database.close();
  });

  test('rejects invalid login and redirects anonymous visitors from protected pages', async ({ page }) => {
    await page.goto('/account.html');
    await expect(page).toHaveURL(/login\.html\?next=/);

    await page.locator('[name="email"]').fill('missing@example.test');
    await page.locator('[name="password"]').fill('not-the-password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.locator('#login-error')).not.toBeEmpty();
  });

  test('registers, logs in, and handles an empty cart checkout', async ({ page }) => {
    await page.goto('/register.html');
    await page.locator('[name="firstName"]').fill(account.firstName);
    await page.locator('[name="lastName"]').fill(account.lastName);
    await page.locator('[name="email"]').fill(account.email);
    await page.locator('[name="password"]').fill(account.password);
    await page.locator('[name="confirmPassword"]').fill(account.password);
    await page.locator('[name="agree"]').check();
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/account\.html/);
    await expect(page.getByText('Account Details')).toBeVisible();

    await page.getByText('Log Out', { exact: true }).click();
    await expect(page).toHaveURL(/index\.html/);
    await page.goto('/login.html');
    await page.locator('[name="email"]').fill(account.email);
    await page.locator('[name="password"]').fill(account.password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/account\.html/);

    await page.goto('/checkout.html');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  });

  test('admin creates and edits a product with deterministic inventory', async ({ page }) => {
    await database.collection('users').updateOne({ email: account.email }, { $set: { isAdmin: true } });

    await page.goto('/admin/login.html');
    await page.locator('[name="email"]').fill(account.email);
    await page.locator('[name="password"]').fill(account.password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/admin\/index\.html/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.goto('/admin/products.html');
    await page.getByRole('button', { name: '+ Add product' }).click();
    await page.locator('#f-name').fill(product.name);
    await page.locator('#f-category').selectOption('Living Room');
    await page.locator('#f-price').fill(product.price);
    await page.locator('#f-sku').fill(product.sku);
    await page.locator('#f-stock').fill(product.stock);
    await page.locator('#f-description').fill('Temporary product created by the browser E2E suite.');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByRole('cell', { name: product.name })).toBeVisible();

    const created = await database.collection('products').findOne({ sku: product.sku });
    expect(created?._id).toBeTruthy();
    productId = String(created?._id);

    const row = page.getByRole('row', { name: new RegExp(product.name) });
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#f-stock').fill('5');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(row.getByRole('cell', { name: '5', exact: true })).toBeVisible();
  });

  test('customer completes Stripe test checkout and sees the order in history', async ({ page, baseURL }) => {
    await login(page, /account\.html/);
    await page.goto(`/shop.html?q=${encodeURIComponent(product.name)}`);
    const productCard = page.locator('.product-card').filter({ hasText: product.name }).first();
    await expect(productCard).toBeVisible();
    await productCard.locator('a[href^="product.html?id="]').first().click();
    await expect(page.getByRole('heading', { name: product.name })).toBeVisible();
    await page.getByRole('button', { name: 'Add to Cart' }).click();

    await page.goto('/cart.html');
    await expect(page.locator('.cart-table-row').filter({ hasText: product.name })).toBeVisible();
    await page.locator('#cart-checkout-link').click();
    await expect(page.getByRole('heading', { name: 'Check Out' })).toBeVisible();

    const fields = {
      firstName: account.firstName,
      lastName: account.lastName,
      phone: '5550101234',
      email: account.email,
      street: '1 E2E Street',
      city: 'Tbilisi',
      state: 'Tbilisi',
      zip: '0100',
    };
    for (const [name, value] of Object.entries(fields)) {
      await page.locator(`[data-field="${name}"]`).fill(value);
    }
    await page.locator('[data-field="country"]').selectOption('Georgia');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[name="cardNumber"]').fill('4242 4242 4242 4242');
    await page.locator('input[name="cardExpiry"]').fill('12/34');
    await page.locator('input[name="cardCvc"]').fill('123');
    await page.locator('input[name="billingName"]').fill('E2E Customer');
    await page.getByRole('button', { name: /^Pay/ }).click();
    await page.waitForURL(/checkout\.html\?payment=success/, { timeout: 30_000 });

    await expect.poll(async () => {
      const currentOrder = await getOrder();
      return currentOrder?.stripeCheckoutSessionId || '';
    }).not.toBe('');
    const pendingOrder = await getOrder();
    orderId = String(pendingOrder?._id);
    const checkoutSession = await stripe.checkout.sessions.retrieve(pendingOrder?.stripeCheckoutSessionId as string);
    expect(checkoutSession.payment_status).toBe('paid');

    await sendWebhook(baseURL as string, {
      id: `evt_e2e_paid_${runId}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: checkoutSession },
    });
    await expect.poll(async () => (await getOrder())?.paymentStatus).toBe('paid');
    await expect(page.getByText('Thank you, your order is placed!')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('link', { name: 'View my orders' }).click();
    await expect(page.getByText(`#${orderId.slice(-8)}`)).toBeVisible();
    await page.getByRole('button', { name: 'View' }).click();
    await expect(page.getByText('Order details')).toBeVisible();
    await expect(page.locator('.order-detail-items')).toContainText(product.name);
  });

  test('shows a retry state when the product API is unavailable', async ({ page }) => {
    await page.route(`**/api/products/${productId}`, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'The service is currently unavailable.' }),
      });
    });
    await page.goto(`/product.html?id=${productId}`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('admin refunds the Stripe test order and inventory is restored', async ({ page, baseURL }) => {
    await login(page, /account\.html/);
    await page.goto('/admin/orders.html');
    const orderCode = `#${orderId.slice(-8)}`;
    const row = page.getByRole('row', { name: new RegExp(orderCode) });
    await expect(row.getByText('paid', { exact: true })).toBeVisible();
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });
    await row.getByRole('button', { name: 'Refund' }).click();
    await expect.poll(() => dialogs.some((message) => message.includes('Refund requested.'))).toBe(true);

    const refundedOrder = await getOrder();
    const paymentIntent = await stripe.paymentIntents.retrieve(refundedOrder?.stripePaymentIntentId as string, {
      expand: ['latest_charge'],
    });
    const charge = typeof paymentIntent.latest_charge === 'string'
      ? await stripe.charges.retrieve(paymentIntent.latest_charge)
      : paymentIntent.latest_charge;
    expect(charge?.refunded).toBe(true);

    await sendWebhook(baseURL as string, {
      id: `evt_e2e_refund_${runId}`,
      object: 'event',
      type: 'charge.refunded',
      data: { object: charge },
    });
    await expect.poll(async () => (await getOrder())?.paymentStatus).toBe('refunded');
    await expect.poll(async () => (await getOrder())?.inventoryStatus).toBe('restored');
    await expect.poll(async () => (await database.collection('products').findOne({ _id: new mongoose.Types.ObjectId(productId) }))?.stock).toBe(5);

    await page.reload();
    await expect(page.getByRole('row', { name: new RegExp(orderCode) }).getByText('refunded', { exact: true })).toBeVisible();
  });
});
