import { test, expect, Page } from '@playwright/test';

const products = Array.from({ length: 30 }, (_, index) => ({
  _id: 'shop-fixture-' + index, name: 'Product ' + String(index).padStart(2, '0'),
  category: index % 2 ? 'Bedroom' : 'Living Room',
  price: (index * 37) % 480, createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  stock: 10, ratingAvg: 4, newArrival: true, discountLabel: '-50%',
  originalPrice: 550, images: ['/images/home/table-lamp.png'],
  description: 'A carefully crafted piece for your home. Warm materials and considered details.',
  colors: [{ name: 'Black' }],
}));
async function setup(page: Page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/products') {
      return route.fulfill({ json: url.pathname.endsWith('/wishlist') ? [] : {} });
    }
    const params = url.searchParams;
    const rows = products.filter(product =>
      (!params.get('category') || product.category === params.get('category')) &&
      (!params.has('minPrice') || product.price >= Number(params.get('minPrice'))) &&
      (!params.has('maxPrice') || product.price <= Number(params.get('maxPrice'))) &&
      (!params.get('search') || product.name.includes(params.get('search')!)));
    const sort = params.get('sort');
    rows.sort((left, right) => sort === 'price_asc' ? left.price - right.price :
      sort === 'price_desc' ? right.price - left.price :
      sort === 'oldest' ? left.createdAt.localeCompare(right.createdAt) : right.createdAt.localeCompare(left.createdAt));
    const take = Number(params.get('take'));
    const offset = (Number(params.get('page')) - 1) * take;
    await route.fulfill({ json: { data: rows.slice(offset, offset + take), total: rows.length } });
  });
}
async function ready(page: Page) {
  await expect(page.locator('#product-grid')).toHaveAttribute('aria-busy', 'false');
}
for (const [view, count, columns] of [['three', 9, 3], ['four', 12, 4], ['two', 6, 2], ['list', 6, 1]] as const) {
  test(view + ' layout, pagination, links and responsive behavior', async ({ page }) => {
    await setup(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/shop.html');
    await ready(page);
    await page.locator('[data-shop-view="' + view + '"]').click();
    await ready(page);
    await expect(page.locator('#product-grid .product-card')).toHaveCount(count);
    expect(await page.locator('#product-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(columns);
    await expect(page.locator('#shop-sidebar')).toBeVisible({ visible: view === 'three' });
    await expect(page.locator('.shop-top-filters')).toBeVisible({ visible: view !== 'three' });
    await expect(page.locator('#product-grid a').first()).toHaveAttribute('href', /product.html\?id=shop-fixture-/);
    await page.screenshot({ path: '/tmp/shop-' + view + '-desktop.png', fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.screenshot({ path: '/tmp/shop-' + view + '-mobile.png', fullPage: true, animations: 'disabled' });
    for (const width of [320, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#show-more').click();
    await ready(page);
    await expect(page.locator('#product-grid .product-card')).toHaveCount(count * 2);
    const ids = await page.locator('#product-grid .product-card').evaluateAll(cards => cards.map(card => card.getAttribute('data-product-id')));
    expect(new Set(ids).size).toBe(ids.length);
    while (await page.locator('#show-more').isVisible()) {
      await page.locator('#show-more').click(); await ready(page);
    }
    await expect(page.locator('#product-grid .product-card')).toHaveCount(30);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect(errors).toEqual([]);
  });
}
test('filters and all sorts persist across layouts; cart remains functional', async ({ page }) => {
  await setup(page); await page.goto('/shop.html'); await ready(page);
  for (const sort of ['oldest', 'newest', 'price_asc', 'price_desc']) {
    await page.locator('#sort-select').selectOption(sort); await ready(page);
    const first = await page.locator('#product-grid .product-card').first().getAttribute('data-product-id');
    const sorted = [...products].sort((left, right) => sort === 'oldest' ? left.createdAt.localeCompare(right.createdAt) :
      sort === 'newest' ? right.createdAt.localeCompare(left.createdAt) :
      sort === 'price_asc' ? left.price - right.price : right.price - left.price);
    expect(first).toBe(sorted[0]._id);
  }
  await page.locator('[data-cat="Bedroom"]').click(); await ready(page);
  await page.locator('#price-list input[value="2"]').check(); await ready(page);
  for (const view of ['four', 'two', 'list', 'three']) {
    await page.locator('[data-shop-view="' + view + '"]').click(); await ready(page);
    await expect(page.locator('#category-select')).toHaveValue('Bedroom');
    await expect(page.locator('#price-select')).toHaveValue('2');
    await expect(page.locator('#sort-select')).toHaveValue('price_desc');
    const expected = products.filter(product => product.category === 'Bedroom' && product.price >= 100 && product.price <= 199.99);
    await expect(page.locator('#product-grid .product-card')).toHaveCount(expected.length);
  }
  await page.locator('[data-shop-view="list"]').click(); await ready(page);
  await page.locator('#product-grid [data-add-id]').first().click();
  await expect(page.locator('#product-grid [data-add-id]').first()).toHaveText('Added ✓');
});
test('empty state and retry after API failure', async ({ page }) => {
  await setup(page); await page.goto('/shop.html?q=missing'); await ready(page);
  await expect(page.locator('#shop-status')).toContainText('No products found');
  await expect(page.locator('#show-more')).toBeHidden();
  await page.route('**/api/products?**', route => route.fulfill({ status: 500, json: { message: 'Failure' } }), { times: 1 });
  await page.goto('/shop.html'); await ready(page);
  await expect(page.locator('#shop-status')).toContainText('could not be loaded');
  await page.locator('#shop-status button').click(); await ready(page);
  await expect(page.locator('#product-grid .product-card')).toHaveCount(9);
});
