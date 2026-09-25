import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import {
  aidDistributionsTable,
  aids,
  campsTable,
  campSectorsTable,
  db,
  familiesTable,
  familyMembersTable,
  familyNeedsTable,
  sessionsTable,
  staffUsers,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../src/lib/security';

const expoUrl = process.env.EXPO_E2E_URL;
const password = `Family-${randomUUID()}!`;
const emailA = `family-a-${randomUUID()}@example.invalid`;
const emailB = `family-b-${randomUUID()}@example.invalid`;
const titleA = `مساعدة الأسرة الأولى ${randomUUID().slice(0, 8)}`;
const titleB = `مساعدة الأسرة الثانية ${randomUUID().slice(0, 8)}`;
const privateNote = `private-note-${randomUUID()}`;
const memberId = `private-id-${randomUUID()}`;
const campId = randomUUID();
const sectorId = randomUUID();
const familyA = randomUUID();
const familyB = randomUUID();
const aidA = randomUUID();
const aidB = randomUUID();
const needA = randomUUID();
const needB = randomUUID();
const staffId = randomUUID();
const userIds: number[] = [];

async function login(page: Page, email: string) {
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').click();
  await page.getByText('رب الأسرة', { exact: true }).click();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('home-family-portal').last()).toBeVisible();
  await page.getByTestId('home-family-portal').last().click();
  await expect(page.getByText('المساعدات المستلمة').last()).toBeVisible();
}

async function logout(page: Page) {
  await page.goto(`${expoUrl}/account`);
  await expect(page.getByTestId('account-logout')).toBeVisible();
  await page.getByTestId('account-logout').click();
  await expect(page.getByTestId('account-login')).toBeVisible();
}

const cacheKey = (id: number) => `al-aqsa-read-cache-v2:${id}`;
const saved = (page: Page, id: number) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}') as {
    receivedAids?: Array<{ title: string }>;
    lastReceivedAidsSyncAt?: string;
  }, cacheKey(id));

test.beforeAll(async () => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const hash = await hashPassword(password);
  for (const [email, name] of [[emailA, 'الأسرة الأولى'], [emailB, 'الأسرة الثانية']]) {
    const [user] = await db.insert(usersTable).values({
      email,
      name,
      identity: randomUUID(),
      passwordHash: hash,
      role: 'DISPLACED',
      rank: 'DISPLACED',
    }).returning({ id: usersTable.id });
    userIds.push(user.id);
  }
  await db.insert(staffUsers).values({
    id: staffId,
    email: `family-staff-${randomUUID()}@example.invalid`,
    name: 'Family isolation fixture',
    passwordHash: hash,
    role: 'DELEGATE',
  });
  await db.insert(campsTable).values({ id: campId, name: 'Family isolation camp' });
  await db.insert(campSectorsTable).values({ id: sectorId, campId, name: 'Family isolation sector' });
  await db.insert(familiesTable).values([
    { id: familyA, campId, sectorId, headName: 'الأسرة الأولى', headLegacyUserId: userIds[0], status: 'ACTIVE', criticalNotes: privateNote },
    { id: familyB, campId, sectorId, headName: 'الأسرة الثانية', headLegacyUserId: userIds[1], status: 'ACTIVE' },
  ]);
  await db.insert(familyMembersTable).values({
    familyId: familyA, fullName: 'عضو خاص', nationalId: memberId,
    gender: 'OTHER', relationship: 'Child', criticalNotes: privateNote,
  });
  await db.insert(familyNeedsTable).values([
    { id: needA, familyId: familyA, category: 'FOOD', title: 'احتياج الأولى', priority: 'MEDIUM', createdByLegacyUserId: userIds[0] },
    { id: needB, familyId: familyB, category: 'FOOD', title: 'احتياج الثانية', priority: 'MEDIUM', createdByLegacyUserId: userIds[1] },
  ]);
  await db.insert(aids).values([
    { id: aidA, title: titleA, type: 'FOOD', quantity: 2, unit: 'طرد', location: 'المخيم', distributionDate: '2030-01-01', createdById: staffId },
    { id: aidB, title: titleB, type: 'FOOD', quantity: 2, unit: 'طرد', location: 'المخيم', distributionDate: '2030-01-01', createdById: staffId },
  ]);
  await db.insert(aidDistributionsTable).values({
    aidId: aidA, needId: needA, familyId: familyA, quantity: 1, unit: 'طرد',
    status: 'RECEIVED', executedById: staffId, deliveredById: staffId, deliveredAt: new Date(),
  });
});

test.afterAll(async () => {
  await db.delete(aidDistributionsTable).where(inArray(aidDistributionsTable.aidId, [aidA, aidB]));
  await db.delete(aids).where(inArray(aids.id, [aidA, aidB]));
  await db.delete(familyNeedsTable).where(inArray(familyNeedsTable.id, [needA, needB]));
  await db.delete(familiesTable).where(inArray(familiesTable.id, [familyA, familyB]));
  await db.delete(campSectorsTable).where(eq(campSectorsTable.id, sectorId));
  await db.delete(campsTable).where(eq(campsTable.id, campId));
  await db.delete(staffUsers).where(eq(staffUsers.id, staffId));
  if (userIds.length) {
    await db.delete(sessionsTable).where(inArray(sessionsTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
});

test('isolates populated and empty aid snapshots across reloads, failures and account switches', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  page.on('dialog', (dialog) => void dialog.accept());
  const aidPath = '/api/family/me/aid-distributions';
  let failAids = false;
  let failProfile = false;
  await page.route('**/api/family/me', async (route) => {
    if (failProfile) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    } else await route.fallback();
  });
  await page.route('**/api/family/me/aid-distributions', async (route) => {
    if (failAids) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    } else await route.fallback();
  });

  await login(page, emailA);
  await expect(page.getByText(titleA, { exact: true })).toBeVisible();
  const firstTime = await page.getByTestId('family-aids-last-sync').innerText();
  expect(firstTime).toContain('آخر مزامنة ناجحة:');
  await expect.poll(async () => (await saved(page, userIds[0])).receivedAids?.[0]?.title).toBe(titleA);
  await expect.poll(async () => (await saved(page, userIds[0])).lastReceivedAidsSyncAt).toBeTruthy();

  failAids = true;
  await page.reload();
  await expect(page.getByText(titleA, { exact: true })).toBeVisible();
  await expect(page.getByTestId('family-aids-last-sync')).toHaveText(firstTime);
  await expect(page.getByTestId('family-aids-retry')).toBeVisible();
  await logout(page);
  expect((await saved(page, userIds[0])).receivedAids?.[0]?.title).toBe(titleA);
  const retainedA = await page.evaluate((key) => localStorage.getItem(key), cacheKey(userIds[0]));
  expect(retainedA).not.toContain(memberId);
  expect(retainedA).not.toContain(privateNote);
  expect(JSON.parse(retainedA ?? '{}').familyProfile).toBeUndefined();
  expect(JSON.parse(retainedA ?? '{}').familyNeeds).toEqual([]);

  let releaseB!: () => void;
  const heldB = new Promise<void>((resolve) => { releaseB = resolve; });
  let holdB = true;
  await page.route('**/api/family/me/aid-distributions', async (route) => {
    if (holdB) {
      await heldB;
      holdB = false;
    }
    await route.fallback();
  });
  failAids = false;
  await login(page, emailB);
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('family-aids-last-sync')).toHaveCount(0);
  releaseB();
  await expect(page.getByText('لم تستلم الأسرة أي مساعدات بعد.')).toBeVisible();
  const emptyTime = await page.getByTestId('family-aids-last-sync').innerText();
  await expect.poll(async () => (await saved(page, userIds[1])).receivedAids).toEqual([]);
  failAids = true;
  await page.reload();
  await expect(page.getByTestId('family-aids-retry')).toBeVisible();
  await expect(page.getByText('لم تستلم الأسرة أي مساعدات بعد.')).toBeVisible();
  await expect(page.getByTestId('family-aids-last-sync')).toHaveText(emptyTime);
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await db.insert(aidDistributionsTable).values({
    aidId: aidB, needId: needB, familyId: familyB, quantity: 1, unit: 'طرد',
    status: 'RECEIVED', executedById: staffId, deliveredById: staffId, deliveredAt: new Date(),
  });
  failAids = false;
  const success = page.waitForResponse((response) =>
    new URL(response.url()).pathname === aidPath && response.ok());
  await page.getByTestId('family-aids-retry').click();
  await success;
  await expect(page.getByText(titleB, { exact: true })).toBeVisible();
  await expect(page.getByText('لم تستلم الأسرة أي مساعدات بعد.')).toHaveCount(0);
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await saved(page, userIds[1])).receivedAids?.[0]?.title).toBe(titleB);

  await logout(page);
  failAids = true;
  failProfile = true;
  await login(page, emailA);
  await expect(page.getByText(titleA, { exact: true })).toBeVisible();
  await expect(page.getByText(titleB, { exact: true })).toHaveCount(0);
  await expect(page.getByText('سجل المساعدات المحفوظ دون اتصال')).toBeVisible();
  await expect(page.getByTestId('family-aids-last-sync')).toHaveText(firstTime);
  await context.close();
});