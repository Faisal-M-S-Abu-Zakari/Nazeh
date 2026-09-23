import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  db,
  sessions,
  staffUsers,
  syncAuditEvents,
  tasks,
  type StaffRole,
} from '@workspace/db';

const expoUrl = process.env.EXPO_E2E_URL;
const password = `Task145-${randomUUID()}!`;
const userId = randomUUID();
const email = `task145-mobile-${randomUUID()}@example.invalid`;
const taskTitle = `اختبار منع التكرار ${randomUUID().slice(0, 8)}`;

async function signIn(page: Page) {
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').click();
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('home-login')).toHaveCount(0);
  await page.getByText('التنبيهات', { exact: true }).last().click();
  await expect(page.getByText('المهام الأمنية', { exact: true })).toBeVisible();
}

test.beforeAll(async () => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(staffUsers).values({
    id: userId,
    email,
    name: 'Task 145 mobile test user',
    passwordHash,
    role: 'SECURITY_OFFICER' satisfies StaffRole,
  });
});

test.afterAll(async () => {
  await db.delete(tasks).where(eq(tasks.createdById, userId));
  await db.delete(syncAuditEvents).where(eq(syncAuditEvents.actorStaffId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('prevents duplicate task saves while a narrow-phone request is delayed', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => void dialog.accept());

  let createRequests = 0;
  let releaseCreate!: () => void;
  const createReleased = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  await page.route('**/api/sync/tasks', async (route) => {
    if (route.request().method() === 'POST') {
      createRequests += 1;
      await createReleased;
    }
    await route.fallback();
  });

  await signIn(page);
  await page.getByTestId('add-task').click();
  await page.getByTestId('task-title').fill(taskTitle);
  await page.getByTestId('task-description').fill('تفاصيل مهمة الاختبار');
  await page.getByTestId('task-location').fill('المخيم الشمالي');

  const saveButton = page.getByTestId('save-task');
  await expect(saveButton).toBeEnabled();
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/sync/tasks' &&
      response.status() === 201,
  );
  await saveButton.click();
  await expect(saveButton).toHaveAttribute('aria-disabled', 'true');
  await expect(saveButton).toHaveText(/جارٍ الحفظ/);

  const saveButtonBox = await saveButton.boundingBox();
  expect(saveButtonBox).not.toBeNull();
  await page.mouse.click(
    saveButtonBox!.x + saveButtonBox!.width / 2,
    saveButtonBox!.y + saveButtonBox!.height / 2,
  );
  await page.mouse.click(
    saveButtonBox!.x + saveButtonBox!.width / 2,
    saveButtonBox!.y + saveButtonBox!.height / 2,
  );
  expect(createRequests).toBe(1);

  releaseCreate();
  await createResponse;
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
  expect(createRequests).toBe(1);
  await context.close();
});