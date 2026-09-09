import { expect, test, Page } from '@playwright/test';
import path from 'node:path';

const products = [
  { _id: 'design-sofa', name: 'Loveseat Sofa', category: 'Living Room', images: ['/images/products/loveseat-sofa.jpg'], price: 199, stock: 12, newArrival: true, ratingAvg: 5, reviewsCount: 0, colors: [{ name: 'Grey', hex: '#aaa' }], description: 'Comfortable seating.', sku: 'SOFA-01' },
  { _id: 'design-lamp', name: 'Amber Table Lamp', category: 'Bedroom', images: ['/images/products/table-lamp.jpg'], price: 39, stock: 8, newArrival: true, ratingAvg: 4, reviewsCount: 0, colors: [{ name: 'Beige', hex: '#d2b48c' }], description: 'A warm glow.', sku: 'LAMP-01' },
];
const posts = [{ _id: 'design-article', title: '7 ways to decor your home like a professional', image: '/images/hero-living-room.webp', content: 'Thoughtful furniture makes a home.', createdAt: '2026-01-01' }];
const user = { _id: 'design-user', firstName: 'Design', lastName: 'Preview', displayName: 'Design Preview', email: 'preview@example.test', role: 'user' };

async function fixtures(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('design-session-initialized')) {
      sessionStorage.setItem('threelegant_access_token', 'local-design-test');
      sessionStorage.setItem('design-session-initialized', 'true');
    }
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    let response: unknown = {};
    if (pathname === '/api/auth/me') response = { user };
    else if (pathname === '/api/products') response = { data: products.filter(p => !url.searchParams.get('category') || p.category === url.searchParams.get('category')), total: products.length };
    else if (pathname.startsWith('/api/products/') && pathname.endsWith('/reviews')) response = [];
    else if (pathname.startsWith('/api/products/')) response = products.find(p => pathname.endsWith(p._id)) || products[0];
    else if (pathname === '/api/orders/quote') {
      const body = route.request().postDataJSON();
      const subtotal = body.items.reduce((sum: number, item: any) => sum + (products.find(p => p._id === item.productId)?.price || 0) * item.qty, 0);
      if (body.couponCode && body.couponCode !== 'HOME20') { await route.fulfill({ status: 400, json: { message: 'Invalid coupon code' } }); return; }
      const discount = body.couponCode ? Math.round(subtotal * .2 * 100) / 100 : 0;
      response = { subtotal, discount, shippingCost: 0, total: subtotal - discount };
    }
    else if (pathname === '/api/blogs') response = { data: posts, total: posts.length };
    else if (pathname.startsWith('/api/blogs/')) response = posts[0];
    else if (pathname === '/api/users/me/wishlist' || pathname === '/api/orders/me') response = [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
}

async function noOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > innerWidth + 0.5;
      })
      .slice(0, 10)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${String(element.className).trim().replace(/\s+/g, '.')}` : ''} (${rect.left}, ${rect.right})`;
      }),
  }));
  expect(sizes.content, sizes.offenders.join('\n')).toBeLessThanOrEqual(sizes.viewport);
}

test('homepage carousel, wishlist and cart thumbnails stay connected', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/index.html');
  await expect(page.locator('#new-arrivals .product-card')).toHaveCount(2);
  await expect(page.locator('.hero-slider')).toHaveCSS('height', '536px');
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expect(page.locator('#hero-img')).toHaveAttribute('src', /slide_2/);
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
  await page.getByRole('button', { name: 'Save Loveseat Sofa to wishlist' }).click();
  await expect(page.getByRole('button', { name: 'Save Loveseat Sofa to wishlist' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.product-card').first().hover();
  await page.locator('[data-add-id]').first().click();
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await expect(page.locator('#cart-drawer .cart-product-image img')).toHaveAttribute('src', /loveseat-sofa/);
  await page.goto('/cart.html');
  await expect(page.locator('#cart-items .cart-product-image img')).toBeVisible();
  await page.goto('/checkout.html');
  await expect(page.locator('#order-lines .cart-product-image img')).toBeVisible();
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Design');
  await expect(page.getByText('Card details are entered securely on Stripe Checkout.')).toBeVisible();
});

test('category links and shop layout controls work', async ({ page }) => {
  await fixtures(page);
  await page.goto('/shop.html?category=Bedroom');
  await expect(page.locator('#active-category-label')).toHaveText('Bedroom');
  await expect(page.locator('#product-grid .product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.locator('.shop-layout')).toHaveAttribute('data-view', 'list');
});

test('profile upload validates size and uses the existing multipart contract', async ({ page }) => {
  await fixtures(page);
  await page.goto('/account.html');
  await expect(page.locator('#account-name')).toHaveText('Design Preview');
  const input = page.getByLabel('Change profile picture');
  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  await expect(page.locator('#avatar-message')).toContainText('2 MB');
  let uploaded = false;
  await page.route('**/api/users/me/profile-image', async route => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().postDataBuffer()?.toString()).toContain('name="image"');
    uploaded = true;
    await route.fulfill({ json: { profileImageUrl: '/images/products/cozy-sofa.jpg' } });
  });
  await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('test-image') });
  await expect(page.locator('#avatar-message')).toHaveText('Profile picture updated.');
  expect(uploaded).toBe(true);
});

for (const width of [1440, 375]) {
  test(`pages render without overflow or script errors at ${width}px`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['index.html', 'contact.html', 'shop.html', 'product.html?id=design-sofa', 'blog.html', 'blog-post.html?id=design-article', 'cart.html', 'account.html', 'login.html', 'register.html']) {
      await page.goto('/' + route);
      await page.locator('main').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await noOverflow(page);
      if (process.env.DESIGN_SCREENSHOTS_DIR) {
        await page.screenshot({ path: path.join(process.env.DESIGN_SCREENSHOTS_DIR, `${route.split('.')[0]}-${width}.png`), fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  });
}


test('account addresses save, cancel, reload and orders use stored values', async ({ page }) => {
  await fixtures(page);
  const profile: any = { ...user, billingAddress: {}, shippingAddress: {} };
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: profile } }));
  await page.route('**/api/users/me/address', async route => {
    const { type, ...address } = route.request().postDataJSON();
    profile[type + 'Address'] = address;
    await route.fulfill({ json: profile });
  });
  const order = { _id: 'saved-order', orderCode: 'TEST-080', createdAt: '2026-01-12T12:00:00Z', status: 'Processing', paymentStatus: 'paid', total: 80 };
  await page.route('**/api/orders/me', route => route.fulfill({ json: [order] }));
  await page.route('**/api/users/me/wishlist', route => route.fulfill({ json: products }));
  await page.goto('/account.html?tab=address');
  await page.locator('.edit-address[data-type="shipping"]').click();
  for (const [name, value] of Object.entries({ fullName: 'Design Preview', phone: '+995555000000', street: '24 Design Street', city: 'Tbilisi', state: 'Tbilisi', zip: '0100', country: 'Georgia' })) {
    await page.locator(`.address-form [name="${name}"]`).fill(value);
  }
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Address saved.' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.address-card[data-type="shipping"]')).toContainText('24 Design Street');
  await page.locator('.edit-address[data-type="shipping"]').click();
  await page.getByLabel('Street address').fill('Unsaved edit');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.address-card[data-type="shipping"]')).not.toContainText('Unsaved edit');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tab of ['address', 'orders', 'wishlist']) {
      await page.goto('/account.html?tab=' + tab);
      await expect(page.locator('#account-content')).not.toContainText('Loading...');
      if (tab === 'orders') {
        await expect(page.getByRole('table', { name: 'Order history' })).toBeVisible();
        await expect(page.locator('.order-row')).toContainText('$80.00');
        await expect(page.locator('.order-row')).toContainText('January 12, 2026');
        await expect(page.locator('.order-row')).toContainText('Processing');
      }
      await noOverflow(page);
      if (process.env.DESIGN_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.DESIGN_SCREENSHOTS_DIR, `account-${tab}-${width}.png`), fullPage: true });
    }
  }
});

test('account ignores late orders and logout only finishes after success', async ({ page }) => {
  await fixtures(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/orders/me', async route => { await held; await route.fulfill({ json: [] }); });
  await page.goto('/account.html?tab=orders');
  await expect(page.locator('#orders-list')).toBeVisible();
  await page.locator('#account-nav [data-tab="address"]').click();
  release();
  await expect(page.locator('.address-grid')).toBeVisible();
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
  await page.locator('#logout-link').click();
  await expect(page.locator('#logout-message')).toContainText('Please try again');
  expect(await page.evaluate(() => sessionStorage.getItem('threelegant_access_token'))).toBeTruthy();
  await page.route('**/api/auth/logout', route => route.fulfill({ json: { message: 'Signed out' } }));
  await page.locator('#logout-link').click();
  await expect(page).toHaveURL(/index.html$/);
  expect(await page.evaluate(() => sessionStorage.getItem('threelegant_access_token'))).toBeNull();
  expect(errors).toEqual([]);
});

test('blog filters, dates, four layouts and legacy article navigation work', async ({ page }) => {
  await fixtures(page);
  const articles = Array.from({ length: 14 }, (_, i) => ({ ...posts[0], _id: 'post-' + i, title: 'Design / Interior ' + i, createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`, featured: i % 2 === 0, excerpt: 'A thoughtful interior.', supportingImages: ['/images/slides/slide_4.jpg', '/images/slides/slide_5.jpg'] }));
  await page.route('**/api/blogs?*', async route => {
    const params = new URL(route.request().url()).searchParams;
    let result = articles.filter(article => (!params.has('featured') || article.featured) && article._id !== params.get('exclude'));
    result.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * (params.get('sort') === 'oldest' ? -1 : 1));
    const take = Number(params.get('take') || 12), offset = (Number(params.get('page') || 1) - 1) * take;
    await route.fulfill({ json: { data: result.slice(offset, offset + take), total: result.length } });
  });
  await page.route('**/api/blogs/post-*', route => route.fulfill({ json: articles[0] }));
  await page.goto('/blog.html');
  await expect(page.locator('#post-grid .article-card')).toHaveCount(9);
  await expect(page.locator('#post-grid h3').first()).toHaveText('Design / Interior 13');
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.locator('#post-grid .article-card')).toHaveCount(14);
  await page.locator('#blog-sort-select').selectOption('oldest');
  await expect(page.locator('#post-grid h3').first()).toHaveText('Design / Interior 0');
  await page.getByRole('button', { name: 'Featured', exact: true }).click();
  await expect(page.locator('#post-grid .article-card')).toHaveCount(7);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['three', 'four', 'two', 'list']) {
      await page.locator(`[data-blog-view="${view}"]`).click();
      await expect(page.locator('#post-grid')).toHaveAttribute('data-view', view);
      await expect(page.locator('#post-grid')).toHaveAttribute('aria-busy', 'false');
      await noOverflow(page);
    }
  }
  await page.locator('#post-grid .article-card').first().click();
  await expect(page.locator('#crumb [aria-current="page"]')).toHaveText('Design / Interior 0');
  await expect(page.locator('#crumb a')).toHaveCount(2);
  await expect(page.locator('.post-meta')).toContainText('January 1, 2026');
  await expect(page.locator('.post-meta')).not.toContainText('By');
  await expect(page.locator('.article-body figure')).toHaveCount(2);
  await expect(page.locator('#related-posts .article-card')).toHaveCount(3);
  await expect(page.locator('#related-posts a[href="blog-post.html?id=post-0"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to Blog' })).toHaveAttribute('href', 'blog.html');
  await expect(page.getByRole('link', { name: 'More articles' })).toHaveAttribute('href', 'blog.html');
  await noOverflow(page);
  await page.route('**/api/blogs/post-*', route => route.fulfill({ json: { ...articles[0], author: { displayName: 'Actual Admin' } } }));
  await page.reload();
  await expect(page.locator('.post-meta')).toContainText('By Actual Admin');
});

test('coupons, cancelled checkout and paid confirmation preserve the correct cart quantities', async ({ page }) => {
  await fixtures(page);
  await page.goto('/cart.html');
  await page.evaluate(product => {
    (window as any).CartStore.setCart([{ id: product._id, color: 'Grey', name: product.name, price: product.price, stock: 12, qty: 3 }]);
  }, products[0]);
  await expect(page.locator('#total-label')).toHaveText('$597.00');
  await page.getByLabel('Coupon code').fill('HOME20');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('#total-label')).toHaveText('$477.60');
  await page.getByLabel('Coupon code').fill('INVALID');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.coupon-message')).toContainText('Invalid coupon');
  await expect(page.locator('#total-label')).toHaveText('$477.60');
  await page.goto('/checkout.html?payment=cancelled&order=saved-order');
  await expect(page.locator('#checkout-error')).toContainText('Payment was cancelled');
  await expect(page.locator('#checkout-body .summary-total')).toContainText('$477.60');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lc_cart_items')!)[0].qty)).toBe(3);
  const paid = { _id: 'saved-order', orderCode: 'TEST-080', paymentStatus: 'paid', status: 'Processing', createdAt: '2026-01-12T12:00:00Z', total: 80, discount: 20, couponCode: 'HOME20', items: [{ productId: products[0]._id, name: products[0].name, color: 'Grey', price: 100, qty: 1 }] };
  await page.route('**/api/orders/saved-order', route => route.fulfill({ json: paid }));
  await page.goto('/checkout.html?payment=success&order=saved-order');
  await expect(page.locator('.complete-meta')).toContainText('$80.00');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lc_cart_items')!)[0].qty)).toBe(2);
  await page.reload();
  await expect(page.locator('.complete-meta')).toContainText('TEST-080');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lc_cart_items')!)[0].qty)).toBe(2);
});

test('contact and legal breadcrumbs preserve links and contact actions', async ({ page }) => {
  await fixtures(page);
  for (const [url, label] of [['contact.html', 'Contact Us'], ['privacy.html', 'Privacy Policy'], ['terms.html', 'Terms of Use']]) {
    await page.goto('/' + url);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(page.locator('.breadcrumb [aria-current="page"]')).toHaveText(label);
    await expect(page.locator('.breadcrumb a[aria-current]')).toHaveCount(0);
  }
  await page.goto('/contact.html');
  await expect(page.locator('.contact-card a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:3legant.ecommerce.store@gmail.com');
  await expect(page.locator('.contact-card a[href^="tel:"]')).toHaveAttribute('href', 'tel:+995555000000');
});

test('offer timing survives refresh and expires cleanly', async ({ page }) => {
  await fixtures(page);
  await page.clock.install({ time: new Date('2026-09-10T09:59:59Z') });
  await page.clock.pauseAt(new Date('2026-09-10T10:00:00Z'));
  await page.route('**/api/products/design-sofa', route => route.fulfill({ json: { ...products[0], originalPrice: 299, discountLabel: '-33%', offerExpiresAt: '2026-09-10T10:01:00Z' } }));
  await page.goto('/product.html?id=design-sofa');
  await expect(page.locator('#offer-units')).toBeVisible();
  await page.clock.runFor(2000);
  await expect(page.locator('#offer-units b').last()).toHaveText('58');
  await page.reload();
  await expect(page.locator('#offer-units b').last()).toHaveText('58');
  await page.clock.runFor(59000);
  await expect(page.locator('#offer-countdown')).toHaveCount(0);
  await expect(page.locator('.product-price')).toHaveText('$299.00');
  await expect(page.locator('.product-price .original')).toHaveCount(0);
});

test('review and question composers and Blog navigation work on mobile', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const submitted: any[] = [];
  await page.route(/\/api\/products\/design-sofa\/(reviews|questions)$/, async route => {
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON(); submitted.push(data);
      await route.fulfill({ json: { ...data, _id: 'new-entry', user, createdAt: new Date().toISOString(), likedBy: [], replies: [], answers: [] } });
    } else await route.fulfill({ json: [] });
  });
  await page.goto('/product.html?id=design-sofa');
  await page.locator('#tab-reviews').click();
  const form = page.locator('.community-create');
  await expect(page.locator('.review-product-name')).toHaveCount(0);
  await expect(form.locator('input:checked')).toHaveCount(0);
  await expect(form.locator('label.is-filled')).toHaveCount(0);
  await form.locator('textarea').fill('A comfortable sofa.');
  await form.getByRole('button', { name: 'Write Review', exact: true }).click();
  expect(submitted).toHaveLength(0);
  await form.getByRole('radio', { name: '4 stars', exact: true }).check();
  const inputBox = await form.locator('.community-create__field').boundingBox();
  const ratingBox = await form.locator('.compose-rating').boundingBox();
  expect(ratingBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
  await form.getByRole('button', { name: 'Write Review', exact: true }).click();
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted[0].rating).toBe(4);
  await expect(form.locator('input:checked')).toHaveCount(0);
  await page.locator('#tab-questions').click();
  await expect(form.locator('.community-help')).toBeVisible();
  await form.locator('textarea').fill('Is the cover washable?');
  await form.getByRole('button', { name: 'Ask question', exact: true }).click();
  await expect.poll(() => submitted.length).toBe(2);
  expect(submitted[1].rating).toBeUndefined();
  await noOverflow(page);
  await expect(page.locator('.site-nav').getByRole('link', { name: 'Product', exact: true })).toHaveCount(0);
  await expect(page.locator('.site-footer__links').getByRole('link', { name: 'Product', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.locator('#mobile-nav').getByRole('link', { name: 'Blog', exact: true }).click();
  await expect(page).toHaveURL(/blog\.html$/);
});

test('admin offer duration is optional, validated and editable', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { ...user, isAdmin: true } } }));
  const writes: any[] = [];
  let saved: any = { ...products[0], originalPrice: 299, offerExpiresAt: '2026-10-10T10:00:00Z' };
  await page.route(/\/api\/products(?:\?.*|\/design-sofa)?$/, async route => {
    if (['POST', 'PATCH'].includes(route.request().method())) {
      const body = route.request().postDataJSON(); writes.push(body);
      saved = { ...saved, ...body };
      await route.fulfill({ json: saved });
    } else await route.fulfill({ json: { data: [saved], total: 1 } });
  });
  await page.goto('/admin/products.html');
  await page.locator('#add-product-btn').click();
  await expect(page.locator('#f-offerDuration')).toBeDisabled();
  await page.locator('#f-name').fill('New chair');
  await page.locator('#f-price').fill('80');
  await page.locator('#f-sku').fill('CHAIR-NEW');
  await page.locator('#f-description').fill('Comfortable chair');
  await page.locator('#save-product-btn').click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].offerDurationDays).toBeUndefined();
  await page.locator('[data-edit]').first().click();
  await page.locator('#f-originalPrice').fill('100');
  await expect(page.locator('#f-offerDuration')).toBeEnabled();
  await page.locator('#f-offerDuration').fill('0');
  await page.locator('#save-product-btn').click();
  expect(writes).toHaveLength(1);
  await page.locator('#f-offerDuration').fill('7');
  await page.locator('#save-product-btn').click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].offerDurationDays).toBe(7);
  expect(writes[1].offerExpiresAt).toBeUndefined();
  await page.locator('[data-edit]').first().click();
  await page.locator('#f-clearOfferExpiry').check();
  await expect(page.locator('#f-offerDuration')).toBeDisabled();
  await page.locator('#save-product-btn').click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].offerDurationDays).toBeNull();
});
