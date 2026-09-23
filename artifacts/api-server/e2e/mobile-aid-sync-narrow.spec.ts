import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  aids,
  db,
  sessions,
  staffUsers,
  syncAuditEvents,
  type StaffRole,
} from '@workspace/db';

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
  await expect(
    page.getByText('إدارة المساعدات', { exact: true }),
  ).toBeVisible();
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
  await db
    .delete(syncAuditEvents)
    .where(eq(syncAuditEvents.actorStaffId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('retries a failed aid save successfully after the server recovers on a narrow phone', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
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

  const aidCard = page
    .locator('[data-testid^="open-aid-"]')
    .filter({ hasText: aidTitle })
    .first();
  await expect(aidCard).toBeVisible();
  const aidId = await aidCard.getAttribute('data-testid');
  expect(aidId).toMatch(/^open-aid-/);

  await page.evaluate(
    ({ storageKey, id, title }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          aids: [
            {
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
            },
          ],
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
  expect(timestampLayout.scrollWidth).toBeLessThanOrEqual(
    timestampLayout.clientWidth + 1,
  );

  for (const fieldId of [
    'edit-aid-title',
    'edit-aid-quantity',
    'edit-aid-unit',
    'edit-aid-location',
    'edit-aid-date',
  ]) {
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
      documentWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ),
    };
  });
  expect(saveLayout.width).toBeGreaterThan(0);
  expect(saveLayout.left).toBeGreaterThanOrEqual(0);
  expect(saveLayout.right).toBeLessThanOrEqual(saveLayout.viewportWidth);
  expect(saveLayout.viewportWidth).toBeLessThanOrEqual(375);
  expect(saveLayout.documentWidth).toBeLessThanOrEqual(
    saveLayout.viewportWidth,
  );

  let archiveRequests = 0;
  page.on('request', (request) => {
    if (
      request.method() !== 'OPTIONS' &&
      new URL(request.url()).pathname.endsWith('/archive')
    ) {
      archiveRequests += 1;
    }
  });
  const archiveButton = page.getByTestId('archive-aid');
  await archiveButton.scrollIntoViewIfNeeded();
  await expect(archiveButton).toBeVisible();
  await expect(archiveButton).toBeEnabled();
  const archiveLayout = await archiveButton.evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ),
    };
  });
  expect(archiveLayout.width).toBeGreaterThan(0);
  expect(archiveLayout.top).toBeGreaterThanOrEqual(0);
  expect(archiveLayout.bottom).toBeLessThanOrEqual(
    archiveLayout.viewportHeight,
  );
  expect(archiveLayout.left).toBeGreaterThanOrEqual(0);
  expect(archiveLayout.right).toBeLessThanOrEqual(archiveLayout.viewportWidth);
  expect(archiveLayout.viewportWidth).toBeLessThanOrEqual(375);
  expect(archiveLayout.documentWidth).toBeLessThanOrEqual(
    archiveLayout.viewportWidth,
  );

  await archiveButton.click();
  const archiveModal = page.getByTestId('archive-aid-modal');
  await expect(archiveModal).toBeVisible();
  for (const element of [
    archiveModal,
    page.getByTestId('archive-aid-title'),
    page.getByTestId('archive-aid-message'),
    page.getByTestId('archive-aid-actions'),
    page.getByTestId('archive-aid-cancel'),
    page.getByTestId('archive-aid-confirm'),
  ]) {
    await expect(element).toBeVisible();
    const layout = await element.evaluate((node) => {
      const element = node as HTMLElement;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      };
    });
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.top).toBeGreaterThanOrEqual(0);
    expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.viewportWidth).toBeLessThanOrEqual(375);
  }
  await page.getByTestId('archive-aid-cancel').click();
  await expect(archiveModal).toBeHidden();
  expect(archiveRequests).toBe(0);

  await page.unroute('**/api/sync/aids');
  const aidRecordId = aidId!.replace(/^open-aid-/, '');

  let patchAttempts = 0;
  await page.route('**/api/sync/aids/**', async (route) => {
    if (
      route.request().method() === 'PATCH' &&
      new URL(route.request().url()).pathname ===
        `/api/sync/aids/${aidRecordId}`
    ) {
      patchAttempts += 1;
      if (patchAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'temporary aid save failure' }),
        });
        return;
      }
    }
    await route.fallback();
  });

  const updatedTitle = `${aidTitle} بعد عودة الخادم`;
  await page.getByTestId('edit-aid-title').fill(updatedTitle);
  const failedAidUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/sync/aids/${aidRecordId}` &&
      response.status() === 503,
  );
  await saveButton.click();
  await failedAidUpdate;

  const saveError = page.getByTestId('aid-save-error');
  const saveErrorRetry = page.getByTestId('aid-save-error-retry');
  const saveErrorMessage = page.getByTestId('aid-save-error-message');
  await expect(saveError).toBeVisible();
  await expect(saveErrorMessage).toHaveText(
    'تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.',
  );
  await expect(saveErrorRetry).toBeVisible();
  await expect(saveErrorRetry).toBeEnabled();

  const saveErrorLayout = await saveError.evaluate((node) => {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
      documentWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ),
    };
  });
  expect(saveErrorLayout.width).toBeGreaterThan(0);
  expect(saveErrorLayout.left).toBeGreaterThanOrEqual(0);
  expect(saveErrorLayout.right).toBeLessThanOrEqual(
    saveErrorLayout.viewportWidth,
  );
  expect(saveErrorLayout.viewportWidth).toBeLessThanOrEqual(375);
  expect(saveErrorLayout.documentWidth).toBeLessThanOrEqual(
    saveErrorLayout.viewportWidth,
  );

  for (const element of [saveErrorMessage, saveErrorRetry]) {
    const elementLayout = await element.evaluate((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        documentWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ),
      };
    });
    expect(elementLayout.left).toBeGreaterThanOrEqual(0);
    expect(elementLayout.right).toBeLessThanOrEqual(375);
    expect(elementLayout.documentWidth).toBeLessThanOrEqual(375);
  }

  const recoveredAidResponse = page.waitForResponse(
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
  await saveErrorRetry.click();
  await recoveredAidResponse;
  await refreshedAids;
  expect(patchAttempts).toBe(2);
  await expect(saveError).toHaveCount(0);
  await expect(page.getByText(updatedTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(aidTitle, { exact: true })).toHaveCount(0);

  await context.close();
});
