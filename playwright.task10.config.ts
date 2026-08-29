import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './artifacts/api-server/e2e',
  testMatch: 'auth-lifecycle.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});