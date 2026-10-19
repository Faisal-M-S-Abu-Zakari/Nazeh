import { expect, test } from '@playwright/test';

const webUrl = process.env.WEB_E2E_URL;
const taskTitle = 'تنظيم بوابة الخدمات';
const dueDateFormat = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
} as const;

test.beforeAll(async () => {
  expect(webUrl, 'Set WEB_E2E_URL to the running web artifact URL').toBeTruthy();
});

test('web task list and detail show the same dueAt instant in two device time zones', async ({ browser }) => {
  const labels: string[] = [];

  for (const timezoneId of ['America/Los_Angeles', 'Asia/Tokyo']) {
    const context = await browser.newContext({ timezoneId });
    try {
      const page = await context.newPage();
      await page.goto(`${webUrl}/auth/login`);
      await page.locator('[data-testid="login-email"]:visible').fill('manager@alaqsa.local');
      await page.locator('[data-testid="login-password"]:visible').fill('CampDemo2025!');
      await page.locator('[data-testid="login-submit"]:visible').click();
      await expect(page).toHaveURL(/\/actor\/operations$/);

      const taskResponsePromise = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/api/sync/tasks' && response.ok(),
      );
      await page.goto(`${webUrl}/actor/tasks`);
      const taskResponse = await taskResponsePromise;
      const tasks = await taskResponse.json() as Array<{ title: string; dueAt: string | null }>;
      const task = tasks.find((item) => item.title === taskTitle);
      expect(task?.dueAt).toBeTruthy();
      const dueAt = task!.dueAt!;
      const expectedLocalDeadline = await page.evaluate(
        ({ instant, options }) => new Intl.DateTimeFormat('ar-EG', options).format(new Date(instant)),
        { instant: dueAt, options: dueDateFormat },
      );
      labels.push(expectedLocalDeadline);

      const taskRow = page.getByRole('row').filter({ hasText: taskTitle });
      await expect(taskRow.getByText(expectedLocalDeadline, { exact: true })).toBeVisible();
      await taskRow.getByRole('button', { name: 'إدارة المهمة', exact: true }).click();
      expect(new URL(page.url()).pathname).toMatch(/\/tasks\/[a-f0-9-]+$/);
      await expect(page.getByText(`الاستحقاق: ${expectedLocalDeadline}`, { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  }

  expect(labels[0]).not.toBe(labels[1]);
});
