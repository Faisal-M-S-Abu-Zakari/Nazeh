import { expect, test, type Browser, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  aids, aidDistributionsTable, campSectorsTable, campsTable, db, familiesTable,
  familyNeedsTable, needStatusHistoryTable, sessions, sessionsTable, staffUsers,
  syncAuditEvents, tasks, usersTable, type StaffRole,
} from '@workspace/db';
import { hashSessionToken } from '../src/lib/security';
import { hashPassword } from '../src/lib/security';

const expoUrl = process.env.EXPO_E2E_URL;
const suffix = randomUUID().slice(0, 8);
const password = `Presentation-${randomUUID()}!`;
const staffRoles = ['DELEGATE', 'SECURITY_OFFICER', 'SECURITY_MEMBER'] as const;
const staff = Object.fromEntries(staffRoles.map((role) => [role, {
  id: randomUUID(), email: `mobile-${role.toLowerCase()}-${suffix}@example.invalid`, role,
}])) as Record<(typeof staffRoles)[number], { id: string; email: string; role: StaffRole }>;
const familyEmail = `mobile-family-${suffix}@example.invalid`;
const familyId = randomUUID();
const campId = randomUUID();
const sectorId = randomUUID();
const approvedNeedId = randomUUID();
const aidId = randomUUID();
const taskId = randomUUID();
const newNeedTitle = `احتياج التجربة ${suffix}`;
const taskTitle = `مهمة التجربة ${suffix}`;
let familyUserId: number;
let managerId: string;
let managerCreated = false;
let managerToken: string;

async function openSession(
  browser: Browser,
  role: 'MANAGER' | (typeof staffRoles)[number],
  viewport = { width: 400, height: 720 },
) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const token = role === 'MANAGER' ? managerToken : '';
  if (token) {
    await context.addInitScript(({ token: value }) => {
      sessionStorage.setItem('al-aqsa-auth-token', value);
      sessionStorage.setItem('al-aqsa-auth-role', 'MANAGER');
    }, { token });
  }
  const page = await context.newPage();
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto(expoUrl!);
  if (role !== 'MANAGER') {
    await page.getByTestId('home-login').click();
    await page.getByTestId('login-email').fill(staff[role].email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();
  }
  await expect(page.getByTestId('home-login')).toHaveCount(0);
  return { page, context };
}

async function expectTaskFormReadableAtLargeText(
  page: Page,
  labels: string[],
  controlTestIds: string[],
  actionLabels: string[],
) {
  const scaledTextCount = await page.evaluate((scale) => {
    const textElements = new Set<HTMLElement>();
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width <= 0 || box.height <= 0 || style.display === 'none' ||
        style.visibility === 'hidden' || style.opacity === '0') continue;
      const text = Array.from(element.childNodes)
        .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .filter(Boolean)
        .join('');
      if (!text || Array.from(text).every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return (codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
          (codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
          (codePoint >= 0x100000 && codePoint <= 0x10fffd);
      })) continue;
      textElements.add(element);
    }
    for (const element of textElements) {
      const style = getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      const lineHeight = Number.parseFloat(style.lineHeight);
      if (!Number.isFinite(fontSize)) continue;
      element.style.setProperty('font-size', `${fontSize * scale}px`, 'important');
      element.style.setProperty(
        'line-height',
        `${(Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.25) * scale}px`,
        'important',
      );
    }
    for (const control of Array.from(document.querySelectorAll<HTMLElement>(
      '[data-testid="task-result-input"], [data-testid="task-approval-note"]',
    ))) {
      const style = getComputedStyle(control);
      const fontSize = Number.parseFloat(style.fontSize);
      const lineHeight = Number.parseFloat(style.lineHeight);
      if (!Number.isFinite(fontSize)) continue;
      control.style.setProperty('font-size', `${fontSize * scale}px`, 'important');
      if (Number.isFinite(lineHeight)) {
        control.style.setProperty('line-height', `${lineHeight * scale}px`, 'important');
      }
    }
    return textElements.size;
  }, 1.5);
  expect(scaledTextCount).toBeGreaterThan(0);

  const layout = await page.getByTestId('task-form-scroll').evaluate((element) => ({
    viewport: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(layout.viewport).toBe(375);
  expect(layout.pageWidth).toBeLessThanOrEqual(375);
  expect(layout.left).toBeGreaterThanOrEqual(-1);
  expect(layout.right).toBeLessThanOrEqual(376);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 2);

  for (const label of labels) {
    const text = page.getByText(label, { exact: true }).filter({ visible: true }).first();
    await expect(text, `Expected visible task label: ${label}`).toBeVisible();
    const measurement = await text.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      return {
        left: box.left,
        right: box.right,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        lines: Array.from(range.getClientRects()).map((line) => ({
          left: line.left, right: line.right, top: line.top, bottom: line.bottom,
        })),
      };
    });
    expect(measurement.left, `${label} starts outside the screen`).toBeGreaterThanOrEqual(-1);
    expect(measurement.right, `${label} ends outside the screen`).toBeLessThanOrEqual(376);
    expect(measurement.scrollWidth, `${label} is horizontally clipped`).toBeLessThanOrEqual(measurement.clientWidth + 2);
    expect(measurement.lines, `${label} has no measurable text`).not.toEqual([]);
    expect(measurement.lines.every((line) => line.left >= measurement.left - 2 &&
      line.right <= measurement.right + 2), `${label} text extends past its label`).toBe(true);
  }

  for (const testId of controlTestIds) {
    const control = page.getByTestId(testId).filter({ visible: true });
    await expect(control, `Expected visible, tappable task control: ${testId}`).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds, `${testId} has no touch target`).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(35);
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(376);
    await control.click({ trial: true });
  }

  for (const label of actionLabels) {
    const action = page.getByText(label, { exact: true }).filter({ visible: true }).first();
    await expect(action, `Expected visible task action: ${label}`).toBeVisible();
    const textBounds = await action.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return Array.from(range.getClientRects()).map((line) => ({
        left: line.left,
        right: line.right,
      }));
    });
    expect(textBounds, `${label} has no measurable text`).not.toEqual([]);
    expect(textBounds.every((line) => line.left >= -1 && line.right <= 376),
      `${label} text extends beyond the screen`).toBe(true);
    await action.click({ trial: true });
  }
}

test.beforeAll(async () => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const passwordHash = await bcrypt.hash(password, 12);
  const [existingManager] = await db.select().from(staffUsers)
    .where(and(eq(staffUsers.active, true), inArray(staffUsers.role, ['MANAGER', 'ADMIN']))).limit(1);
  managerId = existingManager?.id ?? randomUUID();
  if (!existingManager) {
    await db.insert(staffUsers).values({ id: managerId, email: `mobile-manager-${suffix}@example.invalid`, name: 'Presentation manager', role: 'MANAGER', passwordHash });
    managerCreated = true;
  }
  await db.insert(staffUsers).values(staffRoles.map((role) => ({
    ...staff[role], name: `Presentation ${role}`, passwordHash,
  })));
  managerToken = `presentation-${randomUUID()}`;
  await db.insert(sessions).values({
    userId: managerId, tokenHash: hashSessionToken(managerToken),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const [familyUser] = await db.insert(usersTable).values({
    email: familyEmail, name: `أسرة التجربة ${suffix}`, identity: `presentation-${suffix}`,
    passwordHash: await hashPassword(password), role: 'DISPLACED', rank: 'DISPLACED',
  }).returning({ id: usersTable.id });
  familyUserId = familyUser.id;
  await db.insert(campsTable).values({ id: campId, name: `مخيم التجربة ${suffix}` });
  await db.insert(campSectorsTable).values({ id: sectorId, campId, name: 'القطاع التجريبي' });
  await db.insert(familiesTable).values({
    id: familyId, campId, sectorId, headName: `أسرة التجربة ${suffix}`,
    headLegacyUserId: familyUserId, delegateId: staff.DELEGATE.id,
    status: 'ACTIVE', createdById: managerId,
  });
  await db.insert(familyNeedsTable).values({
    id: approvedNeedId, familyId, category: 'FOOD', title: `احتياج معتمد ${suffix}`,
    priority: 'MEDIUM', status: 'APPROVED', createdById: managerId,
  });
  await db.insert(aids).values({
    id: aidId, title: `مساعدة التجربة ${suffix}`, type: 'FOOD', quantity: 20,
    unit: 'سلة', location: 'المستودع', distributionDate: '2030-01-01',
    createdById: managerId,
  });
  await db.insert(tasks).values({
    id: taskId, title: taskTitle, description: 'نتيجة مهمة أمنية', location: 'المخيم',
    status: 'IN_PROGRESS', assignedToId: staff.SECURITY_MEMBER.id, createdById: managerId,
  });
});

test.afterAll(async () => {
  // Delete only records owned by this suite; never alter the pre-existing manager.
  await db.delete(aidDistributionsTable).where(eq(aidDistributionsTable.aidId, aidId));
  await db.delete(needStatusHistoryTable).where(inArray(needStatusHistoryTable.needId,
    db.select({ id: familyNeedsTable.id }).from(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId))));
  await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId));
  await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
  await db.delete(tasks).where(eq(tasks.id, taskId));
  await db.delete(aids).where(eq(aids.id, aidId));
  await db.delete(syncAuditEvents).where(inArray(syncAuditEvents.actorStaffId,
    staffRoles.map((role) => staff[role].id)));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, familyUserId));
  await db.delete(usersTable).where(eq(usersTable.id, familyUserId));
  await db.delete(campSectorsTable).where(eq(campSectorsTable.id, sectorId));
  await db.delete(campsTable).where(eq(campsTable.id, campId));
  for (const role of staffRoles) {
    await db.delete(sessions).where(eq(sessions.userId, staff[role].id));
    await db.delete(staffUsers).where(eq(staffUsers.id, staff[role].id));
  }
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(managerToken)));
  if (managerCreated) await db.delete(staffUsers).where(eq(staffUsers.id, managerId));
});

test('manager sees reports and content, including loading, empty, error and retry states', async ({ browser }) => {
  const { page, context } = await openSession(browser, 'MANAGER');
  await expect(page.getByText('التقارير', { exact: true })).toBeVisible();
  await expect(page.getByText('إدارة الإعلانات', { exact: true })).toBeVisible();
  await page.getByText('التقارير', { exact: true }).click();
  await expect(page.getByText('إجمالي الأفراد')).toBeVisible();

  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  let recovered = false;
  await page.route('**/api/content*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    requests++;
    if (requests === 1) await blocked;
    if (!recovered) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"total":0}' });
  });
  await page.goto(`${expoUrl}/content`);
  await expect(page.locator('[role="progressbar"]')).toBeVisible();
  release();
  await expect(page.getByText('تعذر جلب المحتوى.')).toBeVisible();
  recovered = true;
  await page.getByText('إعادة المحاولة').click();
  await expect(page.getByText('لا توجد إعلانات مسجلة بعد.')).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(3);
  await page.route('**/api/sync/needs', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.goto(`${expoUrl}/needs`);
  await expect(page.getByText('لا توجد احتياجات مسجلة.')).toBeVisible();
  await context.close();
});

test('delegate creates a need, changes its status and assigns approved aid', async ({ browser }) => {
  const { page, context } = await openSession(browser, 'DELEGATE');
  await expect(page.getByText('التقارير', { exact: true })).toHaveCount(0);
  await expect(page.getByText('الإعلانات', { exact: true })).toHaveCount(0);
  await page.goto(`${expoUrl}/reports`);
  await expect(page.getByText('هذه الصفحة مخصصة لمدراء النظام فقط.')).toBeVisible();
  await page.goto(expoUrl!);
  await expect(page.getByText('العائلات', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByText('العائلات', { exact: true }).filter({ visible: true }).click({ timeout: 10_000 });
  await expect(page.getByText(`أسرة التجربة ${suffix}`)).toBeVisible();
  await page.goto(`${expoUrl}/needs`);
  await expect(page.getByText(`احتياج معتمد ${suffix}`)).toBeVisible();
  await page.getByTestId('add-need').click();
  await page.getByText(`أسرة التجربة ${suffix}`, { exact: true }).filter({ visible: true }).click();
  await page.getByPlaceholder('مثال: حليب أطفال، خيمة بديلة').fill(newNeedTitle);
  await page.getByText('إضافة الاحتياج', { exact: true }).click();
  await expect(page.getByText(newNeedTitle, { exact: true })).toBeVisible();
  await page.getByText(newNeedTitle, { exact: true }).click();
  await page.getByText('اعتماد الاحتياج', { exact: true }).click();
  await expect.poll(async () => (await db.select({ status: familyNeedsTable.status }).from(familyNeedsTable)
    .where(eq(familyNeedsTable.title, newNeedTitle)))[0]?.status).toBe('APPROVED');
  await page.getByText('تحديث إلى: قيد التنفيذ').click();
  await expect.poll(async () => (await db.select({ status: familyNeedsTable.status }).from(familyNeedsTable)
    .where(eq(familyNeedsTable.title, newNeedTitle)))[0]?.status).toBe('IN_PROGRESS');

  await page.goto(`${expoUrl}/operations`);
  await page.locator('[data-testid^="open-aid-"]').filter({ hasText: `مساعدة التجربة ${suffix}` }).click();
  await page.getByText(`أسرة التجربة ${suffix}`, { exact: true }).filter({ visible: true }).click();
  await page.getByText(`احتياج معتمد ${suffix}`, { exact: true }).filter({ visible: true }).click();
  await page.getByText('تخصيص وتوزيع').click();
  await expect(page.getByText(`أسرة: ${familyId}`)).toBeVisible();
  await context.close();
});

test('Expo web: security member submits a result and manager approves it at 375px and 150% text', async ({ browser }) => {
  const member = await openSession(browser, 'SECURITY_MEMBER', { width: 375, height: 812 });
  await expect(member.page.getByText('العائلات', { exact: true })).toHaveCount(0);
  await expect(member.page.getByText('التقارير', { exact: true })).toHaveCount(0);
  await expect(member.page.getByTestId('add-aid')).toHaveCount(0);
  await member.page.getByText('التنبيهات', { exact: true }).last().click();
  await expect(member.page.getByText(taskTitle)).toBeVisible();
  await member.page.goto(`${expoUrl}/task-form?id=${taskId}`);
  await member.page.getByText('تقديم نتيجة المهمة', { exact: true }).waitFor();
  await expect(member.page.getByTestId('archive-task')).toHaveCount(0);
  await expect(member.page.getByTestId('save-task')).toHaveCount(0);
  const submittedResult = 'اكتملت الجولة الأمنية';
  await member.page.getByTestId('task-result-input').fill(submittedResult);
  let submitAttempts = 0;
  await member.page.route(`**/api/sync/tasks/${taskId}/submit`, async (route) => {
    submitAttempts++;
    if (submitAttempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      return;
    }
    await route.fallback();
  });
  await member.page.getByTestId('submit-task-result').click();
  await expect(member.page.getByRole('alert')).toBeVisible();
  await expect(member.page.getByTestId('task-result-error-message')).toHaveText('تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.');
  await expect(member.page.getByTestId('task-result-input')).toHaveValue(submittedResult);
  await expect.poll(async () => (await db.select({ result: tasks.result }).from(tasks).where(eq(tasks.id, taskId)))[0]?.result).toBeNull();
  await expectTaskFormReadableAtLargeText(member.page, [
    'تقديم نتيجة المهمة',
    'النتيجة',
    'تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.',
  ], [
    'task-result-input',
    'task-result-error-retry',
  ], ['تقديم', 'إعادة المحاولة']);
  await member.page.getByTestId('task-result-error-retry').click();
  await expect.poll(async () => (await db.select({ result: tasks.result }).from(tasks).where(eq(tasks.id, taskId)))[0]?.result).toBe(submittedResult);
  expect(submitAttempts).toBe(2);
  await member.context.close();

  const manager = await openSession(browser, 'MANAGER', { width: 375, height: 812 });
  await manager.page.goto(`${expoUrl}/task-form?id=${taskId}`);
  await expect(manager.page.getByText('اعتماد نتيجة المهمة', { exact: true })).toBeVisible();
  const approvalNote = 'تم فحص الموقع بعد التسليم';
  await manager.page.getByTestId('task-approval-note').fill(approvalNote);
  let approvalAttempts = 0;
  await manager.page.route(`**/api/sync/tasks/${taskId}/approve`, async (route) => {
    approvalAttempts++;
    if (approvalAttempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      return;
    }
    await route.fallback();
  });
  await manager.page.getByTestId('approve-task-result').click();
  await expect(manager.page.getByRole('alert')).toBeVisible();
  await expect(manager.page.getByTestId('task-approval-error-message')).toHaveText('تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.');
  await expect(manager.page.getByTestId('task-approval-note')).toHaveValue(approvalNote);
  await expect.poll(async () => (await db.select({ approvedAt: tasks.approvedAt }).from(tasks).where(eq(tasks.id, taskId)))[0]?.approvedAt).toBeNull();
  await expectTaskFormReadableAtLargeText(manager.page, [
    'اعتماد نتيجة المهمة',
    `النتيجة المقدمة: ${submittedResult}`,
    'ملاحظة الاعتماد (اختياري)',
    'تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.',
  ], [
    'task-approval-note',
    'task-approval-error-retry',
  ], ['اعتماد المهمة', 'إعادة المحاولة']);
  await manager.page.getByTestId('task-approval-error-retry').click();
  await expect.poll(async () => (await db.select({ approvedAt: tasks.approvedAt }).from(tasks).where(eq(tasks.id, taskId)))[0]?.approvedAt).not.toBeNull();
  expect(approvalAttempts).toBe(2);
  await manager.context.close();
});

test('family head sees their own portal and notifications without staff administration', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 720 } });
  const page = await context.newPage();
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').click();
  await page.getByText('رب الأسرة', { exact: true }).click();
  await page.getByTestId('login-email').fill(familyEmail);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('home-family-portal').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('العائلات', { exact: true })).toHaveCount(0);
  await expect(page.getByText('التقارير', { exact: true })).toHaveCount(0);
  await page.goto(`${expoUrl}/family-head`);
  await expect(page.getByText(`أسرة التجربة ${suffix}`)).toBeVisible();
  await expect(page.getByText('إرسال طلب احتياج', { exact: true })).toBeVisible();
  await expect(page.getByText(`احتياج معتمد ${suffix}`)).toBeVisible();
  await page.goto(`${expoUrl}/notifications`);
  await expect(page.getByText('الإشعارات', { exact: true }).first()).toBeVisible();
  await context.close();
});