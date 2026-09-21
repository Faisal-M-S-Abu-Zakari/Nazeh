import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './artifacts/al-aqsa-camp/e2e',
  testMatch: 'creation-forms.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/repl/tools/bin/chromium',
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});