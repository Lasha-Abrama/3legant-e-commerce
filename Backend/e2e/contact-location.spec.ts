import { expect, test } from '@playwright/test';

test.describe('Contact Us location permission', () => {
  test('shows the permitted location on the map without submitting it', async ({ context, page }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 41.7151, longitude: 44.8271 });

    await page.goto('/contact.html');
    await page.getByRole('button', { name: 'Use my current location' }).click();

    await expect(page.locator('#location-status')).toContainText('Location found');
    await expect(page.locator('#location-map')).toBeVisible();
    await expect(page.locator('#location-map')).toHaveAttribute('src', /openstreetmap\.org\/export\/embed\.html/);
    await expect(page.getByRole('link', { name: 'Open larger map' })).toHaveAttribute('href', /41\.7151/);
  });

  test('keeps the contact form usable when permission is denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
            error({ code: 1, message: 'Permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
          },
        },
      });
    });

    await page.goto('/contact.html');
    await page.getByRole('button', { name: 'Use my current location' }).click();

    await expect(page.locator('#location-status')).toContainText('Location access was denied');
    await expect(page.getByRole('button', { name: 'Try location again' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Send Message' })).toBeEnabled();
  });

  test('reports unavailable and timed-out locations without blocking contact', async ({ page }) => {
    await page.addInitScript(() => {
      let errorCode = 2;
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
            error({ code: errorCode, message: 'Location error', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
            errorCode = 3;
          },
        },
      });
    });

    await page.goto('/contact.html');
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.locator('#location-status')).toContainText('currently unavailable');

    await page.getByRole('button', { name: 'Try location again' }).click();
    await expect(page.locator('#location-status')).toContainText('took too long');
    await expect(page.getByRole('button', { name: 'Send Message' })).toBeEnabled();
  });
});
