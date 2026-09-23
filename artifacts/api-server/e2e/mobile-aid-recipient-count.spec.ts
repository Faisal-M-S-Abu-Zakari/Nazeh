import { expect, test } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { aids, db, sessions, staffUsers, syncAuditEvents, type StaffRole } from '@workspace/db';

const expoUrl = process.env.EXPO_E2E_URL;
const password = `Task98-${randomUUID()}!`;
const userId = randomUUID();
const email = `task98-mobile-${randomUUID()}@example.invalid`;
const aidTitle = `اختبار عداد المستلمين ${randomUUID().slice(0, 8)}`;

const recipientCountFrom = (text: string | null): number => {
  const match = text?.match(/(\d+)$/);
  if (!match) throw new Error(`Could not read recipient count from "${text ?? ''}"`);
  return Number(match[1]);
};

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').click();
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('home-login')).toHaveCount(0);
  await page.getByText('المساعدات', { exact: true }).last().click();
  await expect(page.getByText('إدارة المساعدات', { exact: true })).toBeVisible();
}

async function findAidCard(page: import('@playwright/test').Page, title: string) {
  const card = page.locator('[data-testid^="open-aid-"]').filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  return card;
}

test.beforeAll(async () => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(staffUsers).values({
    id: userId,
    email,
    name: 'Task 98 mobile test user',
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

test('keeps the mobile aid recipient count identical in the list and details after refresh', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 720 } });
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

  const aidCard = await findAidCard(page, aidTitle);
  const listCountBeforeUpdate = recipientCountFrom(
    await aidCard.locator('[data-testid^="recipient-count-"]').textContent(),
  );
  await aidCard.click();
  const detailCountBeforeUpdate = page.getByTestId('aid-recipient-count');
  await expect(detailCountBeforeUpdate).toHaveText(/عدد المستلمين(?: المتزامن)?: \d+/);
  expect(recipientCountFrom(await detailCountBeforeUpdate.textContent())).toBe(listCountBeforeUpdate);

  const updatedTitle = `${aidTitle} بعد التحديث`;
  await page.getByTestId('edit-aid-title').fill(updatedTitle);
  const refreshedAids = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/aids' &&
      response.status() < 400,
  );
  await page.getByTestId('save-aid-edits').click();
  await refreshedAids;

  const updatedAidCard = await findAidCard(page, updatedTitle);
  const listCountAfterUpdate = recipientCountFrom(
    await updatedAidCard.locator('[data-testid^="recipient-count-"]').textContent(),
  );
  expect(listCountAfterUpdate).toBe(listCountBeforeUpdate);

  await updatedAidCard.click();
  const detailCountAfterUpdate = page.getByTestId('aid-recipient-count');
  await expect(detailCountAfterUpdate).toHaveText(/عدد المستلمين(?: المتزامن)?: \d+/);
  expect(recipientCountFrom(await detailCountAfterUpdate.textContent())).toBe(listCountAfterUpdate);
  await context.close();
});