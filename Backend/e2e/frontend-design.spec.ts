import { expect, test, Page } from '@playwright/test';
import path from 'node:path';

const products = [
  { _id: 'design-sofa', name: 'Loveseat Sofa', category: 'Living Room', images: ['/images/products/loveseat-sofa.jpg'], price: 199, stock: 12, newArrival: true, ratingAvg: 5, reviewsCount: 0, colors: [{ name: 'Grey', hex: '#aaa' }], description: 'Comfortable seating.', sku: 'SOFA-01' },
  { _id: 'design-lamp', name: 'Amber Table Lamp', category: 'Bedroom', images: ['/images/products/table-lamp.jpg'], price: 39, stock: 8, newArrival: true, ratingAvg: 4, reviewsCount: 0, colors: [{ name: 'Beige', hex: '#d2b48c' }], description: 'A warm glow.', sku: 'LAMP-01' },
];
const posts = [{ _id: 'design-article', title: '7 ways to decor your home like a professional', image: '/images/hero-living-room.webp', content: 'Thoughtful furniture makes a home.', createdAt: '2026-01-01' }];
const user = { _id: 'design-user', firstName: 'Design', lastName: 'Preview', displayName: 'Design Preview', email: 'preview@example.test', role: 'user' };

async function fixtures(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('threelegant_access_token', 'local-design-test'));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    let response: unknown = {};
    if (pathname === '/api/auth/me') response = { user };
    else if (pathname === '/api/products') response = { data: products.filter(p => !url.searchParams.get('category') || p.category === url.searchParams.get('category')), total: products.length };
    else if (pathname.startsWith('/api/products/') && pathname.endsWith('/reviews')) response = { data: [], total: 0 };
    else if (pathname.startsWith('/api/products/')) response = products.find(p => pathname.endsWith(p._id)) || products[0];
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
