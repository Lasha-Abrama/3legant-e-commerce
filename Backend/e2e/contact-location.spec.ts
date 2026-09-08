import { expect, test } from '@playwright/test';

test('shows the company immediately and calculates distance only on request', async ({ context, page }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 41.7151, longitude: 44.8271 });
  await page.goto('/contact.html');
  await expect(page.locator('.company-map-pin')).toBeVisible();
  await expect(page.locator('.leaflet-popup-content')).toContainText('1 Freedom Square');
  await expect(page.locator('#location-status')).toBeHidden();
  await expect(page.getByText('See your current location')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show my distance' }).click();
  await expect(page.locator('#location-status')).toContainText('About 3.2 km away');
  await expect(page.locator('#open-location-map')).toHaveAttribute('href', /origin=41.7151%2C44.8271/);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Send Message' })).toBeEnabled();
});

test('retains the company map when visitor permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (_success: unknown, error: (value: { code: number }) => void) => error({ code: 1 }),
    } });
  });
  await page.goto('/contact.html');
  await page.getByRole('button', { name: 'Show my distance' }).click();
  await expect(page.locator('#location-status')).toContainText('Location access was denied');
  await expect(page.locator('.company-map-pin')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send Message' })).toBeEnabled();
});
