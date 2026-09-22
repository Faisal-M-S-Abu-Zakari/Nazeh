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
const secondFamilyId = 'family-task53-second';
const needId = 'need-task53';
const alternateNeedId = 'need-task63-other';
const aidId = 'aid-task53';
const alternateAidId = 'aid-task63-other';
const distributionId = 'distribution-task53';
const secondDistributionId = 'distribution-task53-second';

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

const secondFamily = {
  ...family,
  id: secondFamilyId,
  headName: 'أسرة السلام',
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

const alternateNeed = {
  ...baseNeed,
  id: alternateNeedId,
  title: 'مياه للشرب',
  description: 'احتياج آخر للاختبار',
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

const alternateAid = {
  ...aid,
  id: alternateAidId,
  title: 'بطانيات شتوية',
  location: 'المستودع الفرعي',
  distributionCount: 0,
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

const secondAssignedDistribution = {
  ...assignedDistribution,
  id: secondDistributionId,
  familyId: secondFamilyId,
};

type WorkspaceState = {
  needs: typeof baseNeed[];
  families: typeof family[];
  distributions: typeof assignedDistribution[];
  receiveGates?: Record<string, Promise<void>>;
  updateNeedAttempts: number;
  assignAttempts: number;
  receiveAttempts: number;
  receiveAttemptsById: Record<string, number>;
  receiveResponseDelayMs?: number;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type WorkspaceApiDelays = {
  needFailure?: Deferred;
  assignmentFailure?: Deferred;
  receiveFailure?: Deferred;
};

const json = async (route: Route, status: number, body: unknown) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
};

function createDeferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function mockWorkspaceApi(
  page: Page,
  state: WorkspaceState,
  delays: WorkspaceApiDelays = {},
) {
  await page.route('**/api/sync/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/sync/families') {
      await json(route, 200, state.families);
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/sync/needs') {
      await json(route, 200, state.needs);
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/sync/aids') {
      await json(route, 200, [aid, alternateAid]);
      return;
    }

    if (request.method() === 'GET' && url.pathname.startsWith('/api/sync/aids/')) {
      if (url.pathname.endsWith('/distributions')) {
        await json(
          route,
          200,
          url.pathname === `/api/sync/aids/${aidId}/distributions`
            ? state.distributions
            : [],
        );
        return;
      }
    }

    if (
      request.method() === 'PATCH' &&
      url.pathname === `/api/sync/needs/${needId}`
    ) {
      state.updateNeedAttempts += 1;
      if (state.updateNeedAttempts === 1) {
        await delays.needFailure?.promise;
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
        await delays.assignmentFailure?.promise;
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

    const receiveMatch = url.pathname.match(/^\/api\/sync\/distributions\/([^/]+)\/receive$/);
    if (request.method() === 'POST' && receiveMatch) {
      const requestedDistributionId = receiveMatch[1];
      state.receiveAttempts += 1;
      state.receiveAttemptsById[requestedDistributionId] =
        (state.receiveAttemptsById[requestedDistributionId] || 0) + 1;
      if (state.receiveResponseDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, state.receiveResponseDelayMs));
      }
      await state.receiveGates?.[requestedDistributionId];
      if (
        requestedDistributionId === distributionId &&
        state.receiveAttemptsById[requestedDistributionId] === 1
      ) {
        await delays.receiveFailure?.promise;
        await json(route, 500, { error: 'temporary failure' });
        return;
      }

      const existingDistribution = state.distributions.find(
        (distribution) => distribution.id === requestedDistributionId,
      );
      if (!existingDistribution) {
        await json(route, 404, { error: 'distribution not found' });
        return;
      }

      const distribution = {
        ...existingDistribution,
        status: 'RECEIVED',
        deliveredById: userId,
        deliveredAt: '2026-09-21T09:00:00.000Z',
        updatedAt: '2026-09-21T09:00:00.000Z',
      };
      state.distributions = state.distributions.map((currentDistribution) =>
        currentDistribution.id === requestedDistributionId ? distribution : currentDistribution,
      );
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
    needs: [baseNeed, alternateNeed],
    families: [family],
    distributions: [],
    updateNeedAttempts: 0,
    assignAttempts: 0,
    receiveAttempts: 0,
    receiveAttemptsById: {},
    ...overrides,
  };
}
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
  const state = newWorkspaceState({ distributions: [assignedDistribution] });

  const receiveButton = page.getByRole('button', { name: 'تأكيد التسليم' });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/needs/${needId}`);
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

test('failed need status update is hidden after navigating to another need', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({ distributions: [assignedDistribution] });

  const receiveButton = page.getByRole('button', { name: 'تأكيد التسليم' });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/needs/${needId}`);
  await page.getByRole('button', { name: 'موافقة مبدئية' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'تأكيد التحديث' }).click();
  await expect(dialog.getByText('تعذر تحديث حالة الطلب', { exact: true })).toBeVisible();

  await page.goto(`${webUrl}/actor/needs/${alternateNeedId}`);
  await expect(page.getByText('مياه للشرب', { exact: true })).toBeVisible();
  await expect(page.getByText('تعذر تحديث حالة الطلب', { exact: true })).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/actor/needs/${needId}$`));
  await expect(page.getByText('حليب أطفال', { exact: true })).toBeVisible();
  await expect(page.getByText('تعذر تحديث حالة الطلب', { exact: true })).toHaveCount(0);

  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/actor/needs/${alternateNeedId}$`));
  await expect(page.getByText('مياه للشرب', { exact: true })).toBeVisible();
  await expect(page.getByText('تعذر تحديث حالة الطلب', { exact: true })).toHaveCount(0);

  await context.close();
});

test('late failed need status update stays hidden after navigating to another need', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState();
  const delayedFailure = createDeferred();
  await mockWorkspaceApi(page, state, { needFailure: delayedFailure });
  await login(page);

  await page.goto(`${webUrl}/actor/needs/${needId}`);
  await page.getByRole('button', { name: 'موافقة مبدئية' }).click();
  const dialog = page.getByRole('dialog');
  const requestStarted = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === `/api/sync/needs/${needId}`,
  );
  await dialog.getByRole('button', { name: 'تأكيد التحديث' }).click();
  await requestStarted;

  await page.goto(`${webUrl}/actor/needs/${alternateNeedId}`);
  await expect(page.getByText('مياه للشرب', { exact: true })).toBeVisible();
  await expect(page.getByText('تعذر تحديث حالة الطلب', { exact: true })).toHaveCount(0);

  delayedFailure.resolve();
  await expect(page.getByText('تعذر تحديث حالة الطلب', { exact: true })).toHaveCount(0);

  await context.close();
});

test('failed aid assignment keeps the family, need, and quantity inputs', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({ distributions: [assignedDistribution] });

  const receiveButton = page.getByRole('button', { name: 'تأكيد التسليم' });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
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

test('failed aid assignment is hidden after navigating to another aid', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({ distributions: [assignedDistribution] });

  const receiveButton = page.getByRole('button', { name: 'تأكيد التسليم' });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  const familySelect = page.getByRole('textbox', { name: 'الأسرة' });
  await familySelect.click();
  await page.getByRole('option', { name: 'أسرة النور' }).click();
  const needSelect = page.getByRole('textbox', { name: 'طلب الاحتياج' });
  await needSelect.click();
  await page.getByRole('option', { name: 'حليب أطفال' }).click();
  await page.getByRole('button', { name: 'حفظ التخصيص' }).click();
  await expect(page.getByText('تعذر تخصيص المساعدة', { exact: true })).toBeVisible();

  await page.goto(`${webUrl}/actor/aids/${alternateAidId}`);
  await expect(page.getByRole('heading', { name: 'بطانيات شتوية' })).toBeVisible();
  await expect(page.getByText('تعذر تخصيص المساعدة', { exact: true })).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/actor/aids/${aidId}$`));
  await expect(page.getByRole('heading', { name: 'طرود غذائية' })).toBeVisible();
  await expect(page.getByText('تعذر تخصيص المساعدة', { exact: true })).toHaveCount(0);

  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/actor/aids/${alternateAidId}$`));
  await expect(page.getByRole('heading', { name: 'بطانيات شتوية' })).toBeVisible();
  await expect(page.getByText('تعذر تخصيص المساعدة', { exact: true })).toHaveCount(0);

  await context.close();
});

test('late failed aid assignment stays hidden after navigating to another aid', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState();
  const delayedFailure = createDeferred();
  await mockWorkspaceApi(page, state, { assignmentFailure: delayedFailure });
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  const familySelect = page.getByRole('textbox', { name: 'الأسرة' });
  await familySelect.click();
  await page.getByRole('option', { name: 'أسرة النور' }).click();
  const needSelect = page.getByRole('textbox', { name: 'طلب الاحتياج' });
  await needSelect.click();
  await page.getByRole('option', { name: 'حليب أطفال' }).click();
  const requestStarted = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === `/api/sync/aids/${aidId}/distributions`,
  );
  await page.getByRole('button', { name: 'حفظ التخصيص' }).click();
  await requestStarted;

  await page.goto(`${webUrl}/actor/aids/${alternateAidId}`);
  await expect(page.getByRole('heading', { name: 'بطانيات شتوية' })).toBeVisible();
  await expect(page.getByText('تعذر تخصيص المساعدة', { exact: true })).toHaveCount(0);

  delayedFailure.resolve();
  await expect(page.getByText('تعذر تخصيص المساعدة', { exact: true })).toHaveCount(0);

  await context.close();
});

test('shows a delivery failure on only the affected distribution and retries it independently', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({
    families: [family, secondFamily],
    distributions: [assignedDistribution, secondAssignedDistribution],
  });

  const receiveButton = page.getByRole('button', { name: 'تأكيد التسليم' });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  await expect(page.getByRole('button', { name: 'تأكيد التسليم' })).toHaveCount(2);

  const failedRow = page.getByTestId(`distribution-row-${distributionId}`);
  const unaffectedRow = page.getByTestId(`distribution-row-${secondDistributionId}`);
  const failedAlert = failedRow.getByText('تعذر تأكيد التسليم', { exact: true });
  const unaffectedAlert = unaffectedRow.getByText('تعذر تأكيد التسليم', { exact: true });

  await failedRow.getByRole('button', { name: 'تأكيد التسليم' }).click();
  await expect(failedAlert).toBeVisible();
  await expect(unaffectedAlert).toHaveCount(0);
  await expect(
    unaffectedRow.getByRole('button', { name: 'تأكيد التسليم' }),
  ).toBeEnabled();

  await unaffectedRow.getByRole('button', { name: 'تأكيد التسليم' }).click();
  await expect(unaffectedRow.getByText('تم التسليم', { exact: true })).toBeVisible();
  await expect(failedAlert).toBeVisible();
  expect(state.receiveAttemptsById[secondDistributionId]).toBe(1);

  await failedRow.getByRole('button', { name: 'تأكيد التسليم' }).click();
  await expect(failedRow.getByText('تم التسليم', { exact: true })).toBeVisible();
  await expect(failedAlert).toHaveCount(0);
  expect(state.receiveAttemptsById[distributionId]).toBe(2);

  await context.close();
});

test('keeps concurrent delivery confirmations tied to their own distribution rows', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let releaseFailedResponse!: () => void;
  let releaseSuccessfulResponse!: () => void;
  const failedResponse = new Promise<void>((resolve) => {
    releaseFailedResponse = resolve;
  });
  const successfulResponse = new Promise<void>((resolve) => {
    releaseSuccessfulResponse = resolve;
  });
  const state = newWorkspaceState({
    families: [family, secondFamily],
    distributions: [assignedDistribution, secondAssignedDistribution],
    receiveGates: {
      [distributionId]: failedResponse,
      [secondDistributionId]: successfulResponse,
    },
  });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  const failedRow = page.getByTestId(`distribution-row-${distributionId}`);
  const successfulRow = page.getByTestId(`distribution-row-${secondDistributionId}`);
  const failedButton = failedRow.getByRole('button', { name: 'تأكيد التسليم' });
  const successfulButton = successfulRow.getByRole('button', { name: 'تأكيد التسليم' });
  const failedAlert = failedRow.getByText('تعذر تأكيد التسليم', { exact: true });

  await failedButton.click();
  await successfulButton.click();
  await expect.poll(() => state.receiveAttempts).toBe(2);
  await expect(failedButton).toBeDisabled();
  await expect(successfulButton).toBeDisabled();
  await expect(failedAlert).toHaveCount(0);

  releaseSuccessfulResponse();
  await expect(successfulRow.getByText('تم التسليم', { exact: true })).toBeVisible();
  await expect(failedButton).toBeDisabled();
  await expect(failedAlert).toHaveCount(0);

  releaseFailedResponse();
  await expect(failedAlert).toBeVisible();
  await expect(failedButton).toBeEnabled();
  await expect(successfulRow.getByText('تم التسليم', { exact: true })).toBeVisible();
  await expect(successfulRow.getByText('تعذر تأكيد التسليم', { exact: true })).toHaveCount(0);

  await context.close();
});

test('failed delivery confirmation clears its alert after a successful retry', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({ distributions: [assignedDistribution] });

  const receiveButton = page.getByRole('button', { name: 'تأكيد التسليم' });
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

test('failed delivery confirmation is hidden after navigating to another aid', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({ distributions: [assignedDistribution] });

  const receiveButton = page.getByRole('button', { name: 'تأكيد التسليم' });
  await mockWorkspaceApi(page, state);
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  await page.getByRole('button', { name: 'تأكيد التسليم' }).click();
  await expect(page.getByText('تعذر تأكيد التسليم', { exact: true })).toBeVisible();

  await page.goto(`${webUrl}/actor/aids/${alternateAidId}`);
  await expect(page.getByRole('heading', { name: 'بطانيات شتوية' })).toBeVisible();
  await expect(page.getByText('تعذر تأكيد التسليم', { exact: true })).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/actor/aids/${aidId}$`));
  await expect(page.getByRole('heading', { name: 'طرود غذائية' })).toBeVisible();
  await expect(page.getByText('تعذر تأكيد التسليم', { exact: true })).toHaveCount(0);

  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/actor/aids/${alternateAidId}$`));
  await expect(page.getByRole('heading', { name: 'بطانيات شتوية' })).toBeVisible();
  await expect(page.getByText('تعذر تأكيد التسليم', { exact: true })).toHaveCount(0);

  await context.close();
});

test('late failed delivery confirmation stays hidden after navigating to another aid', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = newWorkspaceState({ distributions: [assignedDistribution] });
  const delayedFailure = createDeferred();
  await mockWorkspaceApi(page, state, { receiveFailure: delayedFailure });
  await login(page);

  await page.goto(`${webUrl}/actor/aids/${aidId}`);
  const requestStarted = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname ===
        `/api/sync/distributions/${distributionId}/receive`,
  );
  await page.getByRole('button', { name: 'تأكيد التسليم' }).click();
  await requestStarted;

  await page.goto(`${webUrl}/actor/aids/${alternateAidId}`);
  await expect(page.getByRole('heading', { name: 'بطانيات شتوية' })).toBeVisible();
  await expect(page.getByText('تعذر تأكيد التسليم', { exact: true })).toHaveCount(0);

  delayedFailure.resolve();
  await expect(page.getByText('تعذر تأكيد التسليم', { exact: true })).toHaveCount(0);

  await context.close();
});
