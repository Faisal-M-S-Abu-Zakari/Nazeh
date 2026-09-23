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
const password = `Task146-${randomUUID()}!`;
const userId = randomUUID();
const personId = randomUUID();
const email = `task146-mobile-${randomUUID()}@example.invalid`;
const personName = `اختبار أرشفة النقر السريع ${randomUUID().slice(0, 8)}`;

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
    name: 'Task 146 mobile test user',
    passwordHash,
    role: 'DELEGATE' satisfies StaffRole,
  });
  await db.insert(people).values({
    id: personId,
    nationalId: `TASK146-${randomUUID().slice(0, 8)}`,
    fullName: personName,
    gender: 'MALE',
    birthDate: '1988-04-12',
    phone: '0590000146',
    tentNumber: 'ت-146',
    familySize: 4,
    notes: 'سجل اختبار الأرشفة بالنقر السريع',
    createdById: userId,
  });
});

test.afterAll(async () => {
  await db.delete(syncAuditEvents).where(eq(syncAuditEvents.actorStaffId, userId));
  await db.delete(people).where(eq(people.id, personId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('sends one archive request when confirmation is clicked repeatedly on a narrow phone', async ({
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

  let archiveRequests = 0;
  let releaseArchive!: () => void;
  const archiveReleased = new Promise<void>((resolve) => {
    releaseArchive = resolve;
  });
  await page.route('**/api/sync/people/**', async (route) => {
    const request = route.request();
    if (
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === `/api/sync/people/${personId}/archive`
    ) {
      archiveRequests += 1;
      await archiveReleased;
    }
    await route.fallback();
  });

  const archiveButton = page.getByTestId('archive-person');
  await archiveButton.scrollIntoViewIfNeeded();
  await archiveButton.click();
  const archiveModal = page.getByTestId('archive-person-modal');
  await expect(archiveModal).toBeVisible();

  const confirmButton = page.getByTestId('archive-person-confirm');
  const archiveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/sync/people/${personId}/archive` &&
      response.ok(),
  );
  await confirmButton.click();
  await expect(confirmButton).toHaveAttribute('aria-disabled', 'true');
  await expect(archiveButton).toHaveAttribute('aria-disabled', 'true');

  const confirmButtonBox = await confirmButton.boundingBox();
  expect(confirmButtonBox).not.toBeNull();
  await page.mouse.click(
    confirmButtonBox!.x + confirmButtonBox!.width / 2,
    confirmButtonBox!.y + confirmButtonBox!.height / 2,
  );
  await page.mouse.click(
    confirmButtonBox!.x + confirmButtonBox!.width / 2,
    confirmButtonBox!.y + confirmButtonBox!.height / 2,
  );
  expect(archiveRequests).toBe(1);

  const refreshedPeople = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/sync/people' &&
      response.ok(),
  );
  releaseArchive();
  await archiveResponse;
  await refreshedPeople;
  await expect(page.getByTestId(`open-person-${personId}`)).toHaveCount(0);

  const [archivedPerson] = await db
    .select({ archivedAt: people.archivedAt, version: people.version })
    .from(people)
    .where(eq(people.id, personId));
  expect(archivedPerson?.archivedAt).not.toBeNull();
  expect(archivedPerson?.version).toBe(2);

  await context.close();
});