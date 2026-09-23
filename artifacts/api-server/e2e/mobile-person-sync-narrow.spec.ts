import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  db,
  people,
  sessions,
  staffUsers,
  syncAuditEvents,
  type StaffRole,
} from '@workspace/db';

const expoUrl = process.env.EXPO_E2E_URL;
const password = `Task144-${randomUUID()}!`;
const userId = randomUUID();
const personId = randomUUID();
const email = `task144-mobile-${randomUUID()}@example.invalid`;
const personName = `اختبار الحفظ المتزامن ${randomUUID().slice(0, 8)}`;

async function signIn(page: Page) {
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').click();
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('home-login')).toHaveCount(0);
  await page.getByText('السجل', { exact: true }).last().click();
  await expect(page.getByText('سجل المخيم', { exact: true })).toBeVisible();
}

test.beforeAll(async () => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(staffUsers).values({
    id: userId,
    email,
    name: 'Task 144 mobile test user',
    passwordHash,
    role: 'DELEGATE' satisfies StaffRole,
  });
  await db.insert(people).values({
    id: personId,
    nationalId: `TASK144-${randomUUID().slice(0, 8)}`,
    fullName: personName,
    gender: 'MALE',
    birthDate: '1988-04-12',
    phone: '0590000144',
    tentNumber: 'ت-144',
    familySize: 4,
    notes: 'سجل اختبار الحفظ المتزامن',
    createdById: userId,
  });
});

test.afterAll(async () => {
  await db.delete(syncAuditEvents).where(eq(syncAuditEvents.actorStaffId, userId));
  await db.delete(people).where(eq(people.id, personId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('sends one person update when save is clicked repeatedly on a narrow phone', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => void dialog.accept());

  await signIn(page);
  await page.getByTestId(`open-person-${personId}`).click();
  await expect(page.getByTestId('edit-person-name')).toHaveValue(personName);

  let patchRequests = 0;
  let releasePatch!: () => void;
  const patchReleased = new Promise<void>((resolve) => {
    releasePatch = resolve;
  });
  await page.route('**/api/sync/people/**', async (route) => {
    const request = route.request();
    if (
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === `/api/sync/people/${personId}`
    ) {
      patchRequests += 1;
      await patchReleased;
    }
    await route.fallback();
  });

  const updatedName = `${personName} بعد الحفظ`;
  await page.getByTestId('edit-person-name').fill(updatedName);
  const saveButton = page.getByTestId('save-person-edits');
  const patchResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/sync/people/${personId}` &&
      response.ok(),
  );
  await saveButton.click();
  await expect(saveButton).toHaveAttribute('aria-disabled', 'true');

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
  expect(patchRequests).toBe(1);

  const refreshedPeople = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/people' &&
      response.ok(),
  );
  releasePatch();
  await patchResponse;
  await refreshedPeople;
  const updatedPersonCard = page.getByTestId(`open-person-${personId}`);
  await expect(
    updatedPersonCard.getByText(updatedName, { exact: true }),
  ).toBeVisible();

  await context.close();
});