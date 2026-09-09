import { expect, test } from '@playwright/test';

test.describe('Storefront design regressions', () => {
  test('Blog navigation reaches the blog listing', async ({ page }) => {
    await page.goto('/index.html');

    const productLink = page.locator('.site-nav').getByRole('link', { name: 'Blog' });
    await expect(productLink).toHaveAttribute('href', 'blog.html');
    await productLink.click();

    await expect(page).toHaveURL(/blog\.html$/);
    await expect(page.locator('#post-grid')).toBeVisible();
  });

  test('homepage service icons share one size and stay centered', async ({ page }) => {
    await page.goto('/index.html');

    const boxes = await page.locator('.values-grid .feature-box__icon').evaluateAll((elements) =>
      elements.map((element) => {
        const icon = element.querySelector('svg, img');
        const boxRect = element.getBoundingClientRect();
        const iconRect = icon?.getBoundingClientRect();
        return {
          boxWidth: boxRect.width,
          boxHeight: boxRect.height,
          iconWidth: iconRect?.width,
          iconHeight: iconRect?.height,
          offsetX: iconRect ? Math.round(iconRect.left - boxRect.left) : -1,
          offsetY: iconRect ? Math.round(iconRect.top - boxRect.top) : -1,
        };
      }),
    );

    expect(boxes).toHaveLength(4);
    expect(new Set(boxes.map((box) => JSON.stringify(box))).size).toBe(1);
  });

  test('contact cards use uniform icon dimensions', async ({ page }) => {
    await page.goto('/contact.html');

    const sizes = await page.locator('.contact-card__media').evaluateAll((icons) =>
      icons.map((icon) => {
        const rect = icon.getBoundingClientRect();
        return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      }),
    );

    expect(sizes).toEqual(['32x32', '32x32', '32x32']);
  });

  test('mobile storefront has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of ['/index.html', '/shop.html', '/contact.html']) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content, path).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
});
