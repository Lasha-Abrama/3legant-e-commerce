import { defineConfig } from '@playwright/test';

// Run against the local app. API mutations in the design suite are mocked.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['frontend-design.spec.ts', 'contact-location.spec.ts'],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5001',
    channel: process.env.E2E_BROWSER_CHANNEL || 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
