// Isolated browser/HTTP verification. No .env, external Google, Stripe, or MongoDB access.
// Run from Backend: node verification/local-flows.cjs
require('ts-node').register();
require('reflect-metadata');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { mkdirSync, existsSync } = require('node:fs');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { Types } = require('mongoose');
const express = require('express');
const bcrypt = require('bcryptjs');
const { chromium, expect } = require('@playwright/test');
const { AuthController } = require('../src/auth/auth.controller');
const { AuthService } = require('../src/auth/auth.service');
const { GoogleOAuthService } = require('../src/auth/google-oauth.service');
const { UsersService } = require('../src/users/users.service');
const { CouponsController } = require('../src/coupons/coupons.controller');
const { CouponsService } = require('../src/coupons/coupons.service');
const { OrdersController } = require('../src/orders/orders.controller');
const { OrdersService } = require('../src/orders/orders.service');
const { JwtAuthGuard } = require('../src/common/guards/jwt-auth.guard');
const { AdminGuard } = require('../src/common/guards/admin.guard');
const { configureApp } = require('../src/setup');

function query(value) {
  return { select() { return this; }, session() { return this; }, sort() { return this; }, lean() { return this; }, async exec() { return value; } };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

(async () => {
  const user = { _id: new Types.ObjectId(), googleId: 'verified-fixture', email: 'fixture@example.test',
    firstName: 'Local', lastName: 'Verification', isAdmin: true, tokenVersion: 0, refreshSessions: [],
    passwordHash: await bcrypt.hash('Legacy-password1!', 4), billingAddress: {}, shippingAddress: {} };
  const userModel = {
    findById: () => query(user), findOne: () => query(user),
    updateOne(filter, update) {
      if (filter.tokenVersion !== undefined && filter.tokenVersion !== user.tokenVersion) return query({ matchedCount: 0 });
      if (update.$inc) user.tokenVersion += update.$inc.tokenVersion;
      if (update.$unset?.refreshSessions) user.refreshSessions = [];
      if (update.$pull?.refreshSessions) {
        const condition = update.$pull.refreshSessions;
        user.refreshSessions = user.refreshSessions.filter(s => condition.previousHashes
          ? !s.previousHashes.includes(condition.previousHashes) : s.expiresAt > condition.expiresAt.$lte);
      }
      if (update.$push?.refreshSessions) user.refreshSessions.push(...update.$push.refreshSessions.$each);
      return query({ matchedCount: 1 });
    },
    findOneAndUpdate(filter, update) {
      const hash = filter.refreshSessions.$elemMatch.hash;
      const session = user.refreshSessions.find(s => s.hash === hash && s.expiresAt > new Date());
      if (!session) return query(null);
      session.hash = update.$set['refreshSessions.$.hash'];
      session.previousHashes.push(hash);
      return query(user);
    },
  };
  const users = new UsersService(userModel, {});
  let origin;
  const config = new ConfigService({ NODE_ENV: 'development', FRONTEND_URL: 'http://localhost', JWT_SECRET: 'isolated-verification-secret-32-characters' });
  const jwt = new JwtService({ secret: config.get('JWT_SECRET'), signOptions: { expiresIn: '20m' } });
  const auth = new AuthService(users, jwt, config, {});
  const google = new GoogleOAuthService(config);
  google.getAuthorizationUrl = state => origin + '/api/auth/google/callback?code=fixture&state=' + state;
  google.getProfileFromAuthorizationCode = async () => ({ googleId: user.googleId, email: user.email, firstName: user.firstName, lastName: user.lastName });
  let holdRefresh = false;
  const rotated = deferred(), release = deferred();
  const realRefresh = auth.refresh.bind(auth);
  auth.refresh = async (...args) => {
    const result = await realRefresh(...args);
    if (holdRefresh) { holdRefresh = false; rotated.resolve(); await release.promise; }
    return result;
  };
  const savedCoupons = [];
  const couponModel = {
    find: () => query(savedCoupons),
    findOne: filter => query(savedCoupons.find(c => c.code === filter.code) || null),
    exists: async filter => savedCoupons.find(c => c.code === filter.code) || null,
    create: async dto => { const coupon = { ...dto, _id: new Types.ObjectId(), expiresAt: new Date(dto.expiresAt), usedCount: 0, reservedCount: 0 }; savedCoupons.push(coupon); return coupon; },
  };
  const coupons = new CouponsService(couponModel, {}, {});
  const product = { _id: new Types.ObjectId(), name: 'Verification chair', price: 100, stock: 10,
    images: [], colors: [{ name: 'Black' }] };
  const savedOrders = [];
  function OrderModel(data) { Object.assign(this, data, { _id: new Types.ObjectId() }); this.save = async () => { savedOrders.push(this); return this; }; }
  OrderModel.find = () => query(savedOrders);
  const orders = new OrdersService(OrderModel, { findOne: async () => product }, {}, coupons);
  const module = await Test.createTestingModule({
    controllers: [AuthController, CouponsController, OrdersController],
    providers: [JwtAuthGuard, AdminGuard,
      { provide: AuthService, useValue: auth }, { provide: GoogleOAuthService, useValue: google },
      { provide: UsersService, useValue: users }, { provide: JwtService, useValue: jwt },
      { provide: CouponsService, useValue: coupons }, { provide: OrdersService, useValue: orders }],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app, config);
  app.use('/api/products', (req, res) => res.json({ data: [product], total: 1 }));
  app.use(express.static(resolve(__dirname, '../../Frontend')));
  let browser;
  try {
    await app.listen(0, '127.0.0.1');
    origin = 'http://localhost:' + app.getHttpServer().address().port;
    config.set('FRONTEND_URL', origin);
    const executablePath = process.env.VERIFY_BROWSER_PATH || [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      chromium.executablePath(),
    ].find(existsSync);
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    // Avoid third-party fonts/images in this isolated verification.
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    holdRefresh = true;
    const exchanged = page.waitForResponse(response => response.url().endsWith('/api/auth/google/session'));
    await page.goto(origin + '/api/auth/google');
    await rotated.promise;
    await exchanged;
    assert.match(page.url(), /oauth-callback/);
    release.resolve();
    await page.waitForURL('**/account.html');
    await expect(page.locator('#account-name')).toContainText('Local');
    await page.reload();
    await expect(page.locator('#account-name')).toContainText('Local');
    const cookie = (await context.cookies()).find(c => c.name === 'threelegant_refresh');
    assert(cookie && cookie.httpOnly && cookie.sameSite === 'Lax' && cookie.path === '/api/auth' && !cookie.secure);
    console.log('PASS localhost OAuth handoff waits for rotation; account reload restores the session; HTTP cookie flags correct.');

    await page.locator('#f-newPassword').fill('abcdefgh');
    await expect(page.locator('.password-requirements li')).toHaveCount(3);
    await page.locator('#f-newPassword').fill('Abcdefgh');
    await expect(page.locator('.password-requirements li')).toHaveCount(2);
    await page.locator('#f-newPassword').fill('Abcdefg1');
    await expect(page.locator('.password-requirements li')).toHaveCount(1);
    await page.locator('#f-newPassword').fill('Abcdef1!');
    await expect(page.locator('.password-requirements')).toBeHidden();
    for (const path of ['/register.html', '/reset-password.html?token=' + 'x'.repeat(43)]) {
      await page.goto(origin + path);
      await page.locator('[name=password]').fill('Abcdefg1');
      await expect(page.locator('.password-requirements li')).toHaveCount(1);
      await page.locator('[name=password]').fill('Abcdef1!');
      await expect(page.locator('.password-requirements')).toBeHidden();
    }
    console.log('PASS dynamic missing-only validation on signup, reset, and change password.');

    await page.goto(origin + '/admin/coupons.html');
    await expect(page.locator('#coupons-body')).toContainText('No coupons yet');
    await page.locator('#add-coupon').click();
    await page.locator('#generate-coupon').click();
    await expect(page.locator('#coupon-code')).toHaveValue(/^[A-Z0-9]{10}$/);
    const code = await page.locator('#coupon-code').inputValue();
    await page.locator('[name=percentage]').fill('23');
    await page.locator('[name=usageLimit]').fill('5');
    await page.locator('[name=expiresAt]').fill('2099-01-01T12:00');
    const artifacts = resolve(__dirname, '../test-results/local-flows');
    mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: resolve(artifacts, 'coupons-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.locator('#coupon-editor').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.screenshot({ path: resolve(artifacts, 'coupons-mobile.png'), fullPage: true });
    await page.locator('#coupon-form [type=submit]').click();
    await expect(page.locator('#coupons-body')).toContainText(code);
    assert.equal(savedCoupons[0].percentage, 23);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(origin + '/cart.html');
    await page.evaluate(item => window.CartStore.addItem(item), { id: String(product._id), name: product.name, price: 1, stock: 10, qty: 2, color: 'Black' });
    await page.reload();
    await page.locator('#cart-coupon [name=coupon]').fill(code);
    await page.locator('#cart-coupon [type=submit]').click();
    await expect(page.locator('#cart-coupon .coupon-message')).toContainText('Coupon applied');
    let pricing = await page.evaluate(() => window.CartStore.pricing());
    assert.equal(pricing.subtotal, 200); assert.equal(pricing.discount, 46); assert.equal(pricing.total, 154);
    await page.goto(origin + '/checkout.html');
    await expect(page.locator('#checkout-body .summary-total')).toContainText('$154.00');
    const order = await page.evaluate(async code => apiPost('/orders', {
      items: CartStore.getCart().map(item => ({ productId: item.id, color: item.color, qty: item.qty, price: 1 })),
      couponCode: code, paymentMethod: 'card', shippingOption: 'free',
      contact: { firstName: 'Test', lastName: 'User', phone: '123', email: 'test@example.test' },
      shippingAddress: { street: 'Test', city: 'Test', state: 'Test', zip: '123', country: 'Test' },
    }), code);
    assert.equal(order.total, 154); assert.equal(order.discountPercent, 23); assert.equal(savedOrders[0].discount, 46);
    assert.equal(savedCoupons[0].usedCount, 0); assert.equal(savedCoupons[0].reservedCount, 0);
    console.log('PASS generate/create -> cart apply -> checkout: saved 23% of $200 = $46 discount, $154 total; forged price ignored; applying consumes no usage.');

    await page.goto(origin + '/account.html');
    await page.locator('#logout-link').click();
    await page.waitForURL('**/index.html');
    assert.equal(user.refreshSessions.length, 0);
    assert.equal((await context.cookies()).filter(c => c.name === 'threelegant_refresh').length, 0);
    await page.goto(origin + '/account.html');
    await page.waitForURL(/login\.html/);
    await page.locator('[name=email]').fill(user.email);
    await page.locator('[name=password]').fill('Legacy-password1!');
    await page.locator('#login-form [type=submit]').click();
    await page.waitForURL('**/account.html');
    await expect(page.locator('#account-name')).toContainText('Local');
    console.log('PASS logout revokes sessions and clears cookie; guards reject reload; email/password login still works.');
  } finally {
    release.resolve();
    if (browser) await browser.close();
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
