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
const password = `Task152-${randomUUID()}!`;
const userId = randomUUID();
const personId = randomUUID();
const email = `task152-mobile-${randomUUID()}@example.invalid`;
const personName = `اختبار إعادة فتح الشخص ${randomUUID().slice(0, 8)}`;
const updatedPerson = {
  name: `${personName} بعد إعادة الفتح`,
  nationalId: `TASK152-${randomUUID().slice(0, 8)}`,
  phone: '0590000147',
  tentNumber: 'ت-147-محدث',
  familySize: '6',
  notes: 'تعديل محفوظ بعد إعادة فتح التطبيق',
};

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
    name: 'Task 152 mobile test user',
    passwordHash,
    role: 'DELEGATE' satisfies StaffRole,
  });
  await db.insert(people).values({
    id: personId,
    nationalId: `TASK152-OLD-${randomUUID().slice(0, 8)}`,
    fullName: personName,
    gender: 'MALE',
    birthDate: '1988-04-12',
    phone: '0590000100',
    tentNumber: 'ت-147',
    familySize: 4,
    notes: 'سجل اختبار إعادة فتح الشخص',
    createdById: userId,
  });
});

test.afterAll(async () => {
  await db
    .delete(syncAuditEvents)
    .where(eq(syncAuditEvents.actorStaffId, userId));
  await db.delete(people).where(eq(people.id, personId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('keeps the latest cached person visible after list sync fails and retries successfully', async ({
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

  await page.getByTestId('edit-person-name').fill(updatedPerson.name);
  await page
    .getByTestId('edit-person-national-id')
    .fill(updatedPerson.nationalId);
  await page.getByTestId('edit-person-phone').fill(updatedPerson.phone);
  await page.getByTestId('edit-person-tent').fill(updatedPerson.tentNumber);
  await page
    .getByTestId('edit-person-family-size')
    .fill(updatedPerson.familySize);
  await page.getByTestId('edit-person-notes').fill(updatedPerson.notes);

  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/sync/people/${personId}` &&
      response.ok(),
  );
  await page.getByTestId('save-person-edits').click();
  await updateResponse;
  await expect(page.getByTestId(`open-person-${personId}`)).toContainText(
    updatedPerson.name,
  );

  const cacheKey = `al-aqsa-read-cache-v2:${userId}`;
  await expect
    .poll(async () => {
      const stored = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
        cacheKey,
      );
      return stored.people?.find(
        (person: { id?: string }) => person.id === personId,
      )?.fullName;
    })
    .toBe(updatedPerson.name);

  let failNextPeopleList = true;
  await page.route('**/api/sync/people', async (route) => {
    if (route.request().method() === 'GET' && failNextPeopleList) {
      failNextPeopleList = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Temporarily unavailable' }),
      });
      return;
    }
    await route.fallback();
  });

  const failedPeopleResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/people' &&
      response.status() === 503,
  );
  await page.reload();
  await failedPeopleResponse;
  await expect(page.getByTestId(`open-person-${personId}`)).toContainText(
    updatedPerson.name,
  );

  const cachedPerson = await page.evaluate(
    ({ key, id }) => {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
      return stored.people?.find((person: { id?: string }) => person.id === id);
    },
    { key: cacheKey, id: personId },
  );
  expect(cachedPerson).toMatchObject({
    fullName: updatedPerson.name,
    nationalId: updatedPerson.nationalId,
    phone: updatedPerson.phone,
    tentNumber: updatedPerson.tentNumber,
    familySize: Number(updatedPerson.familySize),
    notes: updatedPerson.notes,
  });

  const syncBanner = page.getByTestId('retry-sync');
  await expect(syncBanner).toBeVisible();
  await expect(syncBanner).toContainText(/تعذرت المزامنة|غير متصل/);
  await expect(syncBanner).toHaveAttribute('aria-label', /إعادة المحاولة/);
  const peopleResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/people' &&
      response.ok(),
  );
  await syncBanner.click();
  await peopleResponse;

  await page.getByTestId(`open-person-${personId}`).click();
  await expect(page.getByTestId('edit-person-name')).toHaveValue(
    updatedPerson.name,
  );
  await expect(page.getByTestId('edit-person-national-id')).toHaveValue(
    updatedPerson.nationalId,
  );
  await expect(page.getByTestId('edit-person-phone')).toHaveValue(
    updatedPerson.phone,
  );
  await expect(page.getByTestId('edit-person-tent')).toHaveValue(
    updatedPerson.tentNumber,
  );
  await expect(page.getByTestId('edit-person-family-size')).toHaveValue(
    updatedPerson.familySize,
  );
  await expect(page.getByTestId('edit-person-notes')).toHaveValue(
    updatedPerson.notes,
  );

  await expect
    .poll(async () => {
      const stored = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
        cacheKey,
      );
      return stored.people?.find(
        (person: { id?: string }) => person.id === personId,
      )?.fullName;
    })
    .toBe(updatedPerson.name);

  await context.close();
});
