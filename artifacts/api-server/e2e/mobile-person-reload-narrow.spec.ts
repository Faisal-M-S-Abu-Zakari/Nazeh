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
const password = `Task147-${randomUUID()}!`;
const userId = randomUUID();
const personId = randomUUID();
const email = `task147-mobile-${randomUUID()}@example.invalid`;
const personName = `اختبار إعادة فتح الشخص ${randomUUID().slice(0, 8)}`;
const oldPersonName = `${personName} القديم`;
const updatedPerson = {
  name: `${personName} بعد إعادة الفتح`,
  nationalId: `TASK147-${randomUUID().slice(0, 8)}`,
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
    name: 'Task 147 mobile test user',
    passwordHash,
    role: 'DELEGATE' satisfies StaffRole,
  });
  await db.insert(people).values({
    id: personId,
    nationalId: `TASK147-OLD-${randomUUID().slice(0, 8)}`,
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

test('shows the latest person edits after reloading the narrow Expo app', async ({
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
  await page.evaluate(
    ({ key, id, name }) => {
      const cache = JSON.parse(localStorage.getItem(key) ?? '{}') as {
        people?: Array<Record<string, unknown>>;
      };
      cache.people = [
        {
          id,
          nationalId: 'TASK147-OLD-CACHE',
          fullName: name,
          gender: 'MALE',
          birthDate: '1988-04-12T00:00:00.000Z',
          phone: '0590000100',
          tentNumber: 'ت-147',
          familySize: 4,
          notes: 'نسخة محلية قديمة',
          version: 1,
          createdById: null,
          createdAt: '2026-09-23T00:00:00.000Z',
          updatedAt: '2026-09-23T00:00:00.000Z',
          archivedAt: null,
        },
      ];
      localStorage.setItem(key, JSON.stringify(cache));
    },
    { key: cacheKey, id: personId, name: oldPersonName },
  );

  let releasePeopleResponse!: () => void;
  const peopleResponseReleased = new Promise<void>((resolve) => {
    releasePeopleResponse = resolve;
  });
  await page.route('**/api/sync/people', async (route) => {
    if (route.request().method() === 'GET') {
      await peopleResponseReleased;
    }
    await route.fallback();
  });

  await page.reload();
  await expect(page.getByTestId(`open-person-${personId}`)).toContainText(
    oldPersonName,
  );
  await page.getByTestId(`open-person-${personId}`).click();
  await expect(page.getByTestId('edit-person-name')).toHaveValue(oldPersonName);

  const peopleResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/people' &&
      response.ok(),
  );
  releasePeopleResponse();
  await peopleResponse;

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