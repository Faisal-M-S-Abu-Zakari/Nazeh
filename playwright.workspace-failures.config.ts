import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './artifacts/api-server/e2e',
  testMatch: 'workspace-failure-retry.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
        '/repl/tools/bin/chromium',
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});