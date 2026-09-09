import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: 'e2e/.env' });

const port = Number(process.env.E2E_PORT || 5100);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const useExistingDeployment = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: useExistingDeployment
    ? undefined
    : {
        command: 'npm run start',
        cwd: __dirname,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 45_000,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PORT: String(port),
          FRONTEND_URL: baseURL,
          GOOGLE_OAUTH_REDIRECT_URI: `${baseURL}/api/auth/google/callback`,
          MONGO_URL: process.env.E2E_MONGO_URL || '',
        },
      },
});
