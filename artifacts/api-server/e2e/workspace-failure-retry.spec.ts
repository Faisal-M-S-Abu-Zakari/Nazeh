import { expect, test, type Page, type Route } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, sessions, staffUsers } from '@workspace/db';

const webUrl = process.env.WEB_E2E_URL;
const password = `Task53-${randomUUID()}!`;
const userId = randomUUID();
const email = `task53-browser-${randomUUID()}@example.invalid`;

const familyId = 'family-task53';
const needId = 'need-task53';
const aidId = 'aid-task53';
const distributionId = 'distribution-task53';

const family = {
  id: familyId,
  campId: 'camp-task53',
  sectorId: 'sector-task53',
  shelterId: null,
  headName: 'أسرة النور',
  headPhone: null,
  delegateId: null,
  status: 'ACTIVE',
  criticalNotes: null,
  createdById: userId,
  approvedById: null,
  approvedAt: null,
  archivedAt: null,
  version: 1,
  createdAt: '2026-09-21T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
};

const baseNeed = {
  id: needId,
  familyId,
  category: 'FOOD',
  title: 'حليب أطفال',
  description: 'احتياج عاجل للأسرة',
  priority: 'HIGH',
  status: 'REQUIRED',
  createdById: userId,
  assignedToId: null,
  fulfilledAt: null,
  archivedAt: null,
  version: 3,
  createdAt: '2026-09-21T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
};

const aid = {
  id: aidId,
  title: 'طرود غذائية',
  type: 'FOOD',
  quantity: 10,
  unit: 'طرد',
  location: 'المستودع الرئيسي',
  distributionDate: '2026-09-21T08:00:00.000Z',
  notes: null,
  createdById: userId,
  createdByLegacyUserId: null,
  createdAt: '2026-09-21T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
  archivedAt: null,
  version: 1,
  distributionCount: 1,
  receivedDistributionCount: 0,
};

const assignedDistribution = {
  id: distributionId,
  aidId,
  needId,
  familyId,
  quantity: 2,
  unit: 'طرد',
  status: 'ASSIGNED',
  executedById: userId,
  deliveredById: null,
  deliveredAt: null,
  createdAt: '2026-09-21T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
};

type WorkspaceState = {
  needs: typeof baseNeed[];
  distributions: typeof assignedDistribution[];
  updateNeedAttempts: number;
  assignAttempts: number;
  receiveAttempts: number;
};

const json = async (route: Route, status: number, body: unknown) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
};

async function mockWorkspaceApi(page: Page, state: WorkspaceState) {
  await page.route('**/api/sync/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/sync/families') {
      await json(route, 200, [family]);
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/sync/needs') {
      await json(route, 200, state.needs);
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/sync/aids') {
      await json(route, 200, [aid]);
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/sync/aids/${aidId}/distributions`
    ) {
      await json(route, 200, state.distributions);
      return;
    }

    if (
      request.method() === 'PATCH' &&
      url.pathname === `/api/sync/needs/${needId}`
    ) {
      state.updateNeedAttempts += 1;
      if (state.updateNeedAttempts === 1) {
        await json(route, 500, { error: 'temporary failure' });
        return;
      }

      state.needs = [{ ...baseNeed, status: 'APPROVED', version: 4 }];
      await json(route, 200, state.needs[0]);
      return;
    }

    if (
      request.method() === 'POST' &&
      url.pathname === `/api/sync/aids/${aidId}/distributions`
    ) {
      state.assignAttempts += 1;
      if (state.assignAttempts === 1) {
        await json(route, 500, { error: 'temporary failure' });
        return;
      }

      const distribution = {
        ...assignedDistribution,
        quantity: 3,
        status: 'ASSIGNED',
      };
      state.distributions = [distribution];
      await json(route, 201, distribution);
      return;
    }

    if (
      request.method() === 'POST' &&
      url.pathname === `/api/sync/distributions/${distributionId}/receive`
    ) {
      state.receiveAttempts += 1;
      if (state.receiveAttempts === 1) {
        await json(route, 500, { error: 'temporary failure' });
        return;
      }

      const distribution = {
        ...assignedDistribution,
        status: 'RECEIVED',
        deliveredById: userId,
        deliveredAt: '2026-09-21T09:00:00.000Z',
        updatedAt: '2026-09-21T09:00:00.000Z',
      };
      state.distributions = [distribution];
      await json(route, 200, distribution);
      return;
    }

    await route.continue();
  });
}

async function login(page: Page) {
  await page.goto(`${webUrl}/auth/login`);
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/actor\/operations$/);
}

function newWorkspaceState(
  overrides: Partial<WorkspaceState> = {},
): WorkspaceState {
  return {
    needs: [baseNeed],
    distributions: [],
    updateNeedAttempts: 0,
    assignAttempts: 0,
    receiveAttempts: 0,
    ...overrides,
  };
}

test.beforeAll(async () => {
  expect(webUrl, 'Set WEB_E2E_URL to the running web artifact URL').toBeTruthy();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(staffUsers).values({
    id: userId,
    email,
    name: 'Task 53 browser user',
    passwordHash,
    role: 'DELEGATE',
  });
});

test.afterAll(async () => {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('failed need status update keeps the dialog, note, and selected status', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState();
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/needs/${needId}`);
  await expect(page.getByRole('heading', { name: 'تفاصيل الطلب' })).toBeVisible();
  await page.getByRole('button', { name: 'موافقة مبدئية' }).click();

  const dialog = page.getByRole('dialog');
  const note = dialog.getByRole('textbox', { name: 'ملاحظات (اختياري)' });
  await note.fill('تمت مراجعة الاحتياج مع الأسرة');
  await expect(dialog.getByText('تمت الموافقة', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'تأكيد التحديث' }).click();

  await expect(dialog.getByText('تعذر تحديث حالة الطلب', { exact: true })).toBeVisible();
  await expect(note).toHaveValue('تمت مراجعة الاحتياج مع الأسرة');
  await expect(dialog.getByText('تمت الموافقة', { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'تأكيد التحديث' }),
  ).toBeEnabled();

  await dialog.getByRole('button', { name: 'تأكيد التحديث' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.updateNeedAttempts).toBe(2);

  await context.close();
});

test('failed aid assignment keeps the family, need, and quantity inputs', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState();
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  await expect(
    page.getByRole('heading', { name: 'تخصيص لأسرة جديدة' }),
  ).toBeVisible();

  const familySelect = page.getByRole('textbox', { name: 'الأسرة' });
  await familySelect.click();
  await page.getByRole('option', { name: 'أسرة النور' }).click();

  const needSelect = page.getByRole('textbox', { name: 'طلب الاحتياج' });
  await needSelect.click();
  await page.getByRole('option', { name: 'حليب أطفال' }).click();

  const quantity = page.getByRole('textbox', { name: 'الكمية للتخصيص' });
  await quantity.fill('3');
  await page.getByRole('button', { name: 'حفظ التخصيص' }).click();

  await expect(
    page.getByText('تعذر تخصيص المساعدة', { exact: true }),
  ).toBeVisible();
  await expect(familySelect).toHaveValue('أسرة النور');
  await expect(needSelect).toHaveValue('حليب أطفال');
  await expect(quantity).toHaveValue('3');
  await expect(
    page.getByRole('button', { name: 'حفظ التخصيص' }),
  ).toBeEnabled();

  await context.close();
});

test('failed delivery confirmation clears its alert after a successful retry', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({ distributions: [assignedDistribution] });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  await expect(page.getByRole('button', { name: 'تأكيد التسليم' })).toBeVisible();
  await page.getByRole('button', { name: 'تأكيد التسليم' }).click();

  const receiveAlert = page.getByText('تعذر تأكيد التسليم', { exact: true });
  await expect(receiveAlert).toBeVisible();

  await page.getByRole('button', { name: 'تأكيد التسليم' }).click();
  await expect(receiveAlert).toHaveCount(0);
  await expect(page.getByText('تم التسليم', { exact: true })).toBeVisible();
  expect(state.receiveAttempts).toBe(2);

  await context.close();
});