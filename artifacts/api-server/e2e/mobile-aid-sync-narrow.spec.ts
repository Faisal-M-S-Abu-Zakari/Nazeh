import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { aids, db, sessions, staffUsers, syncAuditEvents, type StaffRole } from '@workspace/db';

const expoUrl = process.env.EXPO_E2E_URL;
const password = `Task121-${randomUUID()}!`;
const userId = randomUUID();
const email = `task121-mobile-${randomUUID()}@example.invalid`;
const aidTitle = `اختبار التفاف المزامنة ${randomUUID().slice(0, 8)}`;
const cacheKey = `al-aqsa-read-cache-v2:${userId}`;

async function signIn(page: Page) {
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').click();
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('home-login')).toHaveCount(0);
  await page.getByText('المساعدات', { exact: true }).last().click();
  await expect(page.getByText('إدارة المساعدات', { exact: true })).toBeVisible();
}

test.beforeAll(async () => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(staffUsers).values({
    id: userId,
    email,
    name: 'Task 121 mobile test user',
    passwordHash,
    role: 'DELEGATE' satisfies StaffRole,
  });
});

test.afterAll(async () => {
  await db.delete(aids).where(eq(aids.createdById, userId));
  await db.delete(syncAuditEvents).where(eq(syncAuditEvents.actorStaffId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('keeps aid details usable when the unavailable sync timestamp wraps on a narrow phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  page.on('dialog', (dialog) => void dialog.accept());

  await signIn(page);
  await page.getByTestId('add-aid').click();
  await page.getByTestId('aid-title').fill(aidTitle);
  await page.getByTestId('aid-quantity').fill('12');
  await page.getByTestId('aid-unit').fill('سلة');
  await page.getByTestId('aid-location').fill('المستودع الرئيسي');
  await page.getByTestId('aid-date').fill('2030-01-01');
  await page.getByTestId('save-aid').click();

  const aidCard = page.locator('[data-testid^="open-aid-"]').filter({ hasText: aidTitle }).first();
  await expect(aidCard).toBeVisible();
  const aidId = await aidCard.getAttribute('data-testid');
  expect(aidId).toMatch(/^open-aid-/);

  await page.evaluate(
    ({ storageKey, id, title }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          aids: [{
            id: id.replace(/^open-aid-/, ''),
            title,
            type: 'FOOD',
            quantity: 12,
            unit: 'سلة',
            location: 'المستودع الرئيسي',
            distributionDate: '2030-01-01T00:00:00.000Z',
            createdById: null,
            createdAt: '2026-09-23T00:00:00.000Z',
            updatedAt: '2026-09-23T00:00:00.000Z',
            version: 1,
            receivedDistributionCount: 0,
          }],
          people: [],
          complaints: [],
          tasks: [],
          familyNeeds: [],
        }),
      );
    },
    { storageKey: cacheKey, id: aidId!, title: aidTitle },
  );

  await page.route('**/api/sync/aids', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'temporary aid sync failure' }),
    });
  });
  await page.reload();
  await expect(page.getByText(aidTitle, { exact: true })).toBeVisible();
  await page.locator(`[data-testid="${aidId}"]`).click();

  const timestamp = page.getByTestId('aid-last-successful-sync');
  await expect(timestamp).toHaveText('آخر مزامنة ناجحة: غير متوفرة بعد');
  const timestampLayout = await timestamp.evaluate((node) => {
    const element = node as HTMLElement;
    const rect = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    return {
      left: rect.left,
      right: rect.right,
      lineCount: range.getClientRects().length,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
  expect(timestampLayout.left).toBeGreaterThanOrEqual(0);
  expect(timestampLayout.right).toBeLessThanOrEqual(375);
  expect(timestampLayout.lineCount).toBeGreaterThan(0);
  expect(timestampLayout.scrollWidth).toBeLessThanOrEqual(timestampLayout.clientWidth + 1);

  for (const fieldId of ['edit-aid-title', 'edit-aid-quantity', 'edit-aid-unit', 'edit-aid-location', 'edit-aid-date']) {
    const field = page.getByTestId(fieldId);
    await field.scrollIntoViewIfNeeded();
    await expect(field).toBeVisible();
  }

  const warning = page.getByTestId('aid-recipient-sync-warning');
  await warning.scrollIntoViewIfNeeded();
  await expect(warning).toBeVisible();
  const retry = page.getByTestId('aid-recipient-sync-warning-retry');
  await retry.scrollIntoViewIfNeeded();
  await expect(retry).toBeVisible();
  const retryResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/aids' &&
      response.status() === 503,
  );
  await retry.click();
  await retryResponse;
  await expect(retry).toBeVisible();

  const saveButton = page.getByTestId('save-aid-edits');
  await saveButton.scrollIntoViewIfNeeded();
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  const saveLayout = await saveButton.evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    };
  });
  expect(saveLayout.width).toBeGreaterThan(0);
  expect(saveLayout.left).toBeGreaterThanOrEqual(0);
  expect(saveLayout.right).toBeLessThanOrEqual(saveLayout.viewportWidth);
  expect(saveLayout.viewportWidth).toBeLessThanOrEqual(375);
  expect(saveLayout.documentWidth).toBeLessThanOrEqual(saveLayout.viewportWidth);

  await page.unroute('**/api/sync/aids');
  const aidRecordId = aidId!.replace(/^open-aid-/, '');
  const updatedAidResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/sync/aids/${aidRecordId}` &&
      response.ok(),
  );
  const refreshedAids = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/aids' &&
      response.ok(),
  );
  await saveButton.click();
  await updatedAidResponse;
  await refreshedAids;
  await expect(page.locator(`[data-testid="${aidId}"]`)).toBeVisible();

  await context.close();
});
