import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './artifacts/al-aqsa-camp/e2e',
  testMatch: 'task-deadline-timezone.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
        '/repl/tools/bin/chromium',
    },
  },
});
