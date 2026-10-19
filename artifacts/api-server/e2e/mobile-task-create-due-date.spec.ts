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
const userId = randomUUID();
const email = `task265-mobile-${randomUUID()}@example.invalid`;
const password = `Task265-${randomUUID()}!`;
const suffix = randomUUID().slice(0, 8);
const emptyDateTitle = `مهمة بلا موعد ${suffix}`;
const validDateTitle = `مهمة بموعد صحيح ${suffix}`;
const validDueDate = '2027-02-28';

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
  await db.insert(staffUsers).values({
    id: userId,
    email,
    name: 'مسؤول أمن لاختبار المهام',
    passwordHash: await bcrypt.hash(password, 12),
    role: 'SECURITY_OFFICER' satisfies StaffRole,
  });
});

test.afterAll(async () => {
  await db.delete(syncAuditEvents).where(eq(syncAuditEvents.actorStaffId, userId));
  await db.delete(tasks).where(eq(tasks.createdById, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('security officer creates tasks with empty and valid due dates and sees both after reload', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 400, height: 720 },
    deviceScaleFactor: 1,
    timezoneId: 'America/Los_Angeles',
  });
  const page = await context.newPage();

  try {
    await signIn(page);

    const createTask = async (title: string, dueDate: string) => {
      await page.getByTestId('add-task').click();
      await page.getByTestId('task-title').fill(title);
      await page.getByTestId('task-description').fill(`تفاصيل ${title}`);
      await page.getByTestId('task-location').fill('القطاع الشمالي');
      await page.getByTestId('task-due-date').fill(dueDate);

      const saveButton = page.getByTestId('save-task');
      await expect(saveButton).toBeEnabled();
      const createResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/sync/tasks' &&
          response.status() === 201,
      );
      await saveButton.click();
      const response = await createResponse;
      const payload = response.request().postDataJSON() as { dueAt: string | null };
      await expect(page.getByText(title, { exact: true }).filter({ visible: true })).toBeVisible();
      return payload;
    };

    const noDatePayload = await createTask(emptyDateTitle, '');
    expect(noDatePayload.dueAt).toBeNull();

    const validDatePayload = await createTask(validDateTitle, validDueDate);
    expect(validDatePayload.dueAt).toBe(`${validDueDate}T08:00:00.000Z`);

    const savedTasks = await db
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt })
      .from(tasks)
      .where(eq(tasks.createdById, userId));
    expect(savedTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: emptyDateTitle, dueAt: null }),
        expect.objectContaining({ title: validDateTitle, dueAt: new Date(`${validDueDate}T08:00:00.000Z`) }),
      ]),
    );
    const validSavedTask = savedTasks.find((task) => task.title === validDateTitle);
    expect(validSavedTask?.dueAt?.toISOString()).toBe(`${validDueDate}T08:00:00.000Z`);
    expect(validSavedTask).toBeTruthy();
    const validDueAt = validSavedTask!.dueAt!.toISOString();
    const formatInBrowser = (page: Page, dueAt: string) => page.evaluate((value) => new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(value)), dueAt);

    const refreshedTasks = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/sync/tasks' &&
        response.ok(),
    );
    await page.reload();
    await refreshedTasks;
    await expect(page.getByTestId('home-login')).toHaveCount(0);
    await page.getByText('التنبيهات', { exact: true }).last().click();
    await expect(page.getByText(emptyDateTitle, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(validDateTitle, { exact: true }).filter({ visible: true })).toBeVisible();
    const losAngelesLabel = await formatInBrowser(page, validDueAt);
    await expect(page.getByTestId(`task-due-at-${validSavedTask!.id}`)).toContainText(losAngelesLabel);
    await page.getByTestId(`edit-task-${validSavedTask!.id}`).click();
    await expect(page.getByTestId('task-due-at')).toContainText(losAngelesLabel);

    const tokyoContext = await browser.newContext({
      viewport: { width: 400, height: 720 },
      deviceScaleFactor: 1,
      timezoneId: 'Asia/Tokyo',
    });
    try {
      const tokyoPage = await tokyoContext.newPage();
      await signIn(tokyoPage);
      const tokyoLabel = await formatInBrowser(tokyoPage, validDueAt);
      expect(tokyoLabel).not.toBe(losAngelesLabel);
      await expect(tokyoPage.getByTestId(`task-due-at-${validSavedTask!.id}`)).toContainText(tokyoLabel);
      await tokyoPage.getByTestId(`edit-task-${validSavedTask!.id}`).click();
      await expect(tokyoPage.getByTestId('task-due-at')).toContainText(tokyoLabel);
    } finally {
      await tokyoContext.close();
    }
  } finally {
    await context.close();
  }
});
