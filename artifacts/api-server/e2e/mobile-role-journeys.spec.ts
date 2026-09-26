import { expect, test, type Browser, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
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

const aidTitle = `مساعدة التجربة ${suffix} - حملة المواد الغذائية العاجلة للأسر في القطاع الشرقي`;
const taskId = randomUUID();

const directTaskId = randomUUID();
const newNeedTitle = `احتياج التجربة ${suffix}`;
const taskTitle = `مهمة التجربة ${suffix}`;

const directTaskTitle = `مهمة رابط مباشر ${suffix}`;
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

async function applyLargeTextScale(page: Page, scale: number) {
  const count = await page.evaluate((multiplier) => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((element) =>
      Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()),
    );
    for (const element of elements) {
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
      const style = getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      const lineHeight = Number.parseFloat(style.lineHeight);
      if (!Number.isFinite(fontSize)) continue;
      element.style.setProperty('font-size', `${fontSize * multiplier}px`, 'important');
      element.style.setProperty(
        'line-height',
        `${(Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.25) * multiplier}px`,
        'important',
      );
    }
    return elements.length;
  }, scale);
  expect(count).toBeGreaterThan(0);
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
    id: aidId, title: aidTitle, type: 'FOOD', quantity: 20,
    unit: 'سلة', location: 'المستودع', distributionDate: '2030-01-01',
    createdById: managerId,
  });
  await db.insert(tasks).values({
    id: taskId, title: taskTitle, description: 'نتيجة مهمة أمنية', location: 'المخيم',
    status: 'IN_PROGRESS', assignedToId: staff.SECURITY_MEMBER.id, createdById: managerId,
  });
  await db.insert(tasks).values({
    id: directTaskId, title: directTaskTitle, description: directTaskDescription,
    location: directTaskLocation, priority: 'HIGH', status: 'IN_PROGRESS', createdById: managerId,
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
  await db.delete(syncAuditEvents).where(and(
    eq(syncAuditEvents.entityType, 'TASK'),
    eq(syncAuditEvents.entityId, directTaskId),
  ));
  await db.delete(tasks).where(eq(tasks.id, directTaskId));
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

test('manager dashboard and operations actions stay readable and announced at 320px and 200% text', async ({ browser }) => {
  const { page, context } = await openSession(browser, 'DELEGATE');

  const homeActions = [
    'home-notifications',
    'home-staff-alert',
  ];
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

  const homeActions = [
    'home-notifications',
    'home-staff-alert',
  ];
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
  const updatedTaskTitle = `مهمة محدّثة ${suffix}`;
  await member.page.getByTestId('task-result-input').fill(submittedResult);
  let submitAttempts = 0;
  await member.page.route(`**/api/sync/tasks/${taskId}/submit`, async (route) => {
    submitAttempts++;
    if (submitAttempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      return;
    }
    if (submitAttempts === 2) {
      await db.update(tasks).set({
        title: updatedTaskTitle,
        version: sql`${tasks.version} + 1`,
        updatedAt: new Date(),
      }).where(eq(tasks.id, taskId));
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

  const submitConflictResponse = member.page.waitForResponse((response) =>
    response.url().includes(`/api/sync/tasks/${taskId}/submit`) && response.status() === 409);
  await member.page.getByTestId('task-result-error-retry').click();
  const submitConflict = await submitConflictResponse;
  expect((await submitConflict.json()).code).toBe('VERSION_CONFLICT');
  await expect(member.page.getByTestId('task-result-error-message')).toHaveText(
    'تعارض في التحديث: تغيّرت البيانات منذ آخر تحميل. راجع أحدث نسخة قبل إعادة المحاولة.',
  );
  await expect(member.page.getByText(updatedTaskTitle, { exact: true })).toBeVisible();
  await expect(member.page.getByTestId('task-result-input')).toHaveValue(submittedResult);
  await expect(member.page.getByTestId('task-result-error-retry')).toHaveCount(0);
  await expect(member.page.getByTestId('task-result-review-update')).toBeVisible();
  await expect.poll(async () => (await db.select({ result: tasks.result }).from(tasks).where(eq(tasks.id, taskId)))[0]?.result).toBeNull();
  await expectTaskFormReadableAtLargeText(member.page, [
    'تقديم نتيجة المهمة',
    'النتيجة',
    'تعارض في التحديث: تغيّرت البيانات منذ آخر تحميل. راجع أحدث نسخة قبل إعادة المحاولة.',
    'أحدث حالة للمهمة: قيد التنفيذ · الإصدار 2',
  ], [
    'task-result-input',
    'task-result-review-update',
  ], ['راجعت التحديث']);
  await member.page.getByTestId('task-result-review-update').click();
  await expect(member.page.getByTestId('task-result-error-retry')).toBeVisible();
  await member.page.getByTestId('task-result-error-retry').click();
  await expect.poll(async () => (await db.select({ result: tasks.result }).from(tasks).where(eq(tasks.id, taskId)))[0]?.result).toBe(submittedResult);
  expect(submitAttempts).toBe(3);
  await member.context.close();

  const manager = await openSession(browser, 'MANAGER', { width: 375, height: 812 });
  await manager.page.getByText('التنبيهات', { exact: true }).last().click();
  await expect(manager.page.getByText(updatedTaskTitle, { exact: true }).filter({ visible: true })).toBeVisible();
  await manager.page.getByTestId(`edit-task-${taskId}`).click();
  await expect(manager.page.getByText('اعتماد نتيجة المهمة', { exact: true })).toBeVisible();
  const approvalNote = 'تم فحص الموقع بعد التسليم';
  const latestResult = 'اكتملت الجولة الأمنية بعد مراجعة إضافية';
  await manager.page.getByTestId('task-approval-note').fill(approvalNote);
  let approvalAttempts = 0;
  await manager.page.route(`**/api/sync/tasks/${taskId}/approve`, async (route) => {
    approvalAttempts++;
    if (approvalAttempts === 1) {
      await db.update(tasks).set({
        result: latestResult,
        version: sql`${tasks.version} + 1`,
        updatedAt: new Date(),
      }).where(eq(tasks.id, taskId));
    }
    await route.fallback();
  });
  const approvalConflictResponse = manager.page.waitForResponse((response) =>
    response.url().includes(`/api/sync/tasks/${taskId}/approve`) && response.status() === 409);
  await manager.page.getByTestId('approve-task-result').click();
  const approvalConflict = await approvalConflictResponse;
  expect((await approvalConflict.json()).code).toBe('VERSION_CONFLICT');
  await expect(manager.page.getByRole('alert')).toBeVisible();
  await expect(manager.page.getByTestId('task-approval-error-message')).toHaveText(
    'تعارض في التحديث: تغيّرت البيانات منذ آخر تحميل. راجع أحدث نسخة قبل إعادة المحاولة.',
  );
  await expect(manager.page.getByText(`النتيجة المقدمة: ${latestResult}`, { exact: true })).toBeVisible();
  await expect(manager.page.getByTestId('task-approval-note')).toHaveValue(approvalNote);
  await expect(manager.page.getByTestId('task-approval-error-retry')).toHaveCount(0);
  await expect(manager.page.getByTestId('task-approval-review-update')).toBeVisible();
  await expect.poll(async () => (await db.select({ approvedAt: tasks.approvedAt }).from(tasks).where(eq(tasks.id, taskId)))[0]?.approvedAt).toBeNull();
  const approvalAuditFilter = and(
    eq(syncAuditEvents.entityType, 'TASK'),
    eq(syncAuditEvents.entityId, taskId),
    eq(syncAuditEvents.action, 'APPROVE'),
    eq(syncAuditEvents.actorStaffId, managerId),
  );
  await expect.poll(async () => db.select().from(syncAuditEvents).where(approvalAuditFilter)).toHaveLength(0);
  await expectTaskFormReadableAtLargeText(manager.page, [
    'اعتماد نتيجة المهمة',
    `النتيجة المقدمة: ${latestResult}`,
    'ملاحظة الاعتماد (اختياري)',
    'تعارض في التحديث: تغيّرت البيانات منذ آخر تحميل. راجع أحدث نسخة قبل إعادة المحاولة.',
  ], [
    'task-approval-note',
    'task-approval-review-update',
  ], ['راجعت التحديث']);
  await manager.page.getByTestId('task-approval-review-update').click();
  await expect(manager.page.getByTestId('task-approval-error-retry')).toBeVisible();
  await manager.page.getByTestId('task-approval-error-retry').click();
  await expect.poll(async () => (await db.select({ approvedAt: tasks.approvedAt }).from(tasks).where(eq(tasks.id, taskId)))[0]?.approvedAt).not.toBeNull();
  expect(approvalAttempts).toBe(2);
  const approvalAuditRows = await db.select().from(syncAuditEvents).where(approvalAuditFilter);
  expect(approvalAuditRows).toHaveLength(1);
  expect(approvalAuditRows[0]?.metadata).toMatchObject({ note: approvalNote });

  const draftTitle = `عنوان المدير ${suffix}`;
  const draftDescription = `تفاصيل المدير ${suffix}`;
  const latestTitle = `عنوان المستخدم الآخر ${suffix}`;
  const latestDescription = `تفاصيل المستخدم الآخر ${suffix}`;
  const latestLocation = `موقع المستخدم الآخر ${suffix}`;
  await manager.page.goBack();
  await expect(manager.page.getByText(updatedTaskTitle, { exact: true }).filter({ visible: true })).toBeVisible();
  await manager.page.getByTestId(`edit-task-${taskId}`).click();
  await manager.page.getByTestId('task-title').fill(draftTitle);
  await manager.page.getByTestId('task-description').fill(draftDescription);
  await manager.page.getByTestId('task-status-PENDING').click();
  let taskUpdateAttempts = 0;
  let retryPayload: Record<string, unknown> | null = null;
  await manager.page.route(`**/api/sync/tasks/${taskId}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    taskUpdateAttempts++;
    if (taskUpdateAttempts === 1) {
      await db.update(tasks).set({
        title: latestTitle,
        description: latestDescription,
        location: latestLocation,
        status: 'IN_PROGRESS',
        version: sql`${tasks.version} + 1`,
        updatedAt: new Date(),
      }).where(eq(tasks.id, taskId));
    } else {
      retryPayload = route.request().postDataJSON() as Record<string, unknown>;
    }
    await route.fallback();
  });
  const taskEditConflictResponse = manager.page.waitForResponse((response) =>
    response.url().includes(`/api/sync/tasks/${taskId}`) && response.request().method() === 'PATCH' && response.status() === 409);
  await manager.page.getByTestId('save-task').click();
  const taskEditConflict = await taskEditConflictResponse;
  expect((await taskEditConflict.json()).code).toBe('VERSION_CONFLICT');
  await expect(manager.page).toHaveURL(new RegExp(`/task-form\\?id=${taskId}`));
  await expect(manager.page.getByTestId('task-edit-conflict')).toBeVisible();
  await expect(manager.page.getByTestId('task-title')).toHaveValue(draftTitle);
  await expect(manager.page.getByTestId('task-description')).toHaveValue(draftDescription);
  await expect(manager.page.getByTestId('task-edit-draft-summary')).toContainText('معلّقة');
  await expect(manager.page.getByTestId('task-location')).toHaveValue(latestLocation);
  await expect(manager.page.getByTestId('task-edit-current-title')).toContainText(latestTitle);
  await expect(manager.page.getByTestId('task-edit-current-description')).toContainText(latestDescription);
  await expect(manager.page.getByTestId('task-edit-current-status')).toContainText('قيد التنفيذ');
  await expect(manager.page.getByTestId('task-edit-draft-summary')).toContainText(draftTitle);
  await expect(manager.page.getByTestId('task-edit-retry')).toHaveCount(0);
  await expect.poll(async () => (await db.select({
    title: tasks.title, description: tasks.description, status: tasks.status,
  }).from(tasks).where(eq(tasks.id, taskId)))[0]).toMatchObject({
    title: latestTitle, description: latestDescription, status: 'IN_PROGRESS',
  });
  await manager.page.getByTestId('task-edit-review-current').click();
  await manager.page.getByTestId('task-edit-retry').click();
  await expect.poll(async () => (await db.select({
    title: tasks.title, description: tasks.description, location: tasks.location, status: tasks.status,
  }).from(tasks).where(eq(tasks.id, taskId)))[0]).toMatchObject({
    title: draftTitle, description: draftDescription, location: latestLocation, status: 'PENDING',
  });
  expect(retryPayload).toMatchObject({
    title: draftTitle, description: draftDescription, location: latestLocation, status: 'PENDING',
  });
  expect(taskUpdateAttempts).toBe(2);
  await manager.context.close();
});

test('manager opens a direct task edit link with an empty query cache and can save', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 720 } });
  const page = await context.newPage();

  let releaseTaskList!: () => void;
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

  const tabListBounds = await page.getByRole('tablist').boundingBox();

    const tab = page.getByRole('tab', { name: label }).filter({ visible: true });

    const action = page.getByRole('button', { name }).filter({ visible: true });

  const campaignCard = page.getByTestId(`open-aid-${aidId}`);

  const expectedTabs = ['الرئيسية', 'المساعدات', 'السجل', 'التنبيهات', 'الحساب'];

  const aidsTab = page.getByRole('tab', { name: /المساعدات/ }).filter({ visible: true });

    const tabLabel = tab.getByText(label, { exact: true }).filter({ visible: true });

async function expectLargeTextActionsReachable(page: Page, screenTestId: string, testIds: string[]) {
  const layout = await page.getByTestId(screenTestId).evaluate((screen) => {
    const viewport = document.documentElement.clientWidth;
    const controls = Array.from(screen.querySelectorAll<HTMLElement>('[role="button"]'))
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && style.display !== 'none' &&
          style.visibility !== 'hidden' && style.opacity !== '0';
      });
    const outsideControls = controls.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.left < -1 || box.right > viewport + 1 || box.width < 35;
    }).map((element) => element.getAttribute('data-testid') ?? element.textContent?.trim());
    const clippedText = controls.flatMap((control) => {
      const controlBounds = control.getBoundingClientRect();
      return Array.from(control.querySelectorAll<HTMLElement>('*')).flatMap((element) => {
        if (!Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim())) return [];
        const range = document.createRange();
        range.selectNodeContents(element);
        let clippingAncestor: HTMLElement | null = element;
        while (clippingAncestor && clippingAncestor !== control.parentElement) {
          const style = getComputedStyle(clippingAncestor);
          const bounds = clippingAncestor.getBoundingClientRect();
          const clipsHorizontally = style.overflowX === 'hidden' || style.overflowX === 'clip';
          const clipsVertically = style.overflowY === 'hidden' || style.overflowY === 'clip';
          if (Array.from(range.getClientRects()).some((line) =>
            (clipsHorizontally && (line.left < bounds.left - 2 || line.right > bounds.right + 2)) ||
            (clipsVertically && (line.top < bounds.top - 2 || line.bottom > bounds.bottom + 2)) ||
            line.left < controlBounds.left - 2 || line.right > controlBounds.right + 2 ||
            line.top < controlBounds.top - 2 || line.bottom > controlBounds.bottom + 2,
          )) return [element.textContent?.trim() ?? ''];
          clippingAncestor = clippingAncestor.parentElement;
        }
        return [];
      });
    });
    return {
      viewport,
      pageWidth: document.documentElement.scrollWidth,
      outsideControls,
      clippedText,
    };
  });
  expect(layout.viewport).toBe(320);
  expect(layout.pageWidth).toBeLessThanOrEqual(320);
  expect(layout.outsideControls).toEqual([]);
  expect(layout.clippedText).toEqual([]);

  for (const testId of testIds) {
    const control = page.getByTestId(testId).filter({ visible: true });
    await expect(control, `Expected readable, visible action ${testId}`).toBeVisible();
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    expect(bounds, `${testId} should have a touch target`).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(35);
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321);
    await control.click({ trial: true });
  }
}

    const labelLines = await tabLabel.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return Array.from(range.getClientRects()).map((line) => ({
        left: line.left, right: line.right, top: line.top, bottom: line.bottom,
      }));
    });

    const tabBounds = await tab.boundingBox();

  const taskListBlocked = new Promise<void>((resolve) => { releaseTaskList = resolve; });

const savedDirectTaskTitle = `مهمة محفوظة من الرابط ${suffix}`;

    const saveResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/sync/tasks/${directTaskId}`) &&
      response.request().method() === 'PATCH');

const directTaskDescription = `تفاصيل رابط مباشر ${suffix}`;

const directTaskLocation = `موقع رابط مباشر ${suffix}`;

    const requestUrl = new URL(route.request().url());

    const currentStatusColor = await page.getByTestId('task-status-IN_PROGRESS')
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    const otherStatusColor = await page.getByTestId('task-status-PENDING')
      .evaluate((element) => getComputedStyle(element).backgroundColor);

  let taskListRequests = 0;
