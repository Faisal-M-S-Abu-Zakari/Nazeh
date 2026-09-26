import { expect, test, type Browser, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  campSectorsTable, campsTable, db, familiesTable, familyNeedsTable,
  sessions, sessionsTable, staffUsers, tasks, usersTable,
} from '@workspace/db';
import { hashPassword, hashSessionToken } from '../src/lib/security';

const expoUrl = process.env.EXPO_E2E_URL;
const suffix = randomUUID().slice(0, 8);
const password = `Home-${randomUUID()}!`;
let managerId: string;
let managerCreated = false;
const memberId = randomUUID();
const familyId = randomUUID();
const campId = randomUUID();
const sectorId = randomUUID();
const needId = randomUUID();
const taskId = randomUUID();
const managerToken = `home-${randomUUID()}`;
const familyEmail = `home-family-${suffix}@example.invalid`;
const memberEmail = `home-member-${suffix}@example.invalid`;
let familyUserId: number | undefined;

const dashboardNumbers = {
  totalDisplacedPersons: 321, activeAids: 42, openComplaints: 8,
  totalDelegates: 13, unreadNotifications: 5,
};
const tabLabels = ['الرئيسية', 'المساعدات', 'السجل', 'التنبيهات', 'الحساب'];
const metricLabels = ['فرداً في السجل', 'مساعدة نشطة', 'شكوى مفتوحة', 'مندوباً', 'إشعاراً جديداً'];
const managementActions = ['تسجيل مساعدة', 'إضافة فرد', 'تسجيل شكوى', 'تكليف مهمة', 'العائلات', 'الاحتياجات', 'وحدات الإيواء', 'التقارير', 'إدارة الإعلانات'];

async function openHome(browser: Browser, role: 'guest' | 'manager' | 'member' | 'family') {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  if (role === 'manager') {
    await context.addInitScript((token) => {
      sessionStorage.setItem('al-aqsa-auth-token', token);
      sessionStorage.setItem('al-aqsa-auth-role', 'MANAGER');
    }, managerToken);
  }
  const page = await context.newPage();
  // Control the changing public feed and dashboard figures, while using the real login and role-scoped sync APIs.
  await page.route(/\/api\/content(?:\?.*)?$/, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [
      { id: randomUUID(), title: `إعلان منشور ${suffix}`, body: 'تحديث عام للمخيم', status: 'published', createdAt: '2026-09-01T12:00:00.000Z' },
      { id: randomUUID(), title: `مسودة مخفية ${suffix}`, body: 'غير منشور', status: 'draft', createdAt: '2026-09-01T12:00:00.000Z' },
    ], total: 2 }),
  }));
  await page.route('**/api/dashboard', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(dashboardNumbers),
  }));
  await page.goto(expoUrl!);
  if (role === 'member' || role === 'family') {
    await page.getByTestId('home-login').filter({ visible: true }).click();
    if (role === 'family') await page.getByText('رب الأسرة', { exact: true }).click();
    await page.getByTestId('login-email').fill(role === 'family' ? familyEmail : memberEmail);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();
  }
  await expect(page.getByTestId('home-dashboard').filter({ visible: true })).toBeVisible();
  if (role !== 'guest') await expect(page.getByTestId('home-login').filter({ visible: true })).toHaveCount(0);
  await expect(page.getByText(`إعلان منشور ${suffix}`).filter({ visible: true })).toBeVisible();
  return { context, page, home: page.getByTestId('home-dashboard').filter({ visible: true }) };
}

async function expectNoManagement(page: Page, home: ReturnType<Page['getByTestId']>) {
  for (const title of managementActions) {
    await expect(home.getByRole('button', { name: new RegExp(`^${title}،`) })).toHaveCount(0);
  }
  for (const label of metricLabels) await expect(home.getByTestId(`home-metric-${label}`)).toHaveCount(0);
  await expect(home.getByTestId('home-operations-summary')).toHaveCount(0);
  await expect(home.getByTestId('home-queue-notice')).toHaveCount(0);
  await expect(page.getByText(`مسودة مخفية ${suffix}`).filter({ visible: true })).toHaveCount(0);
}

async function expectFits375(page: Page, home: ReturnType<Page['getByTestId']>) {
  // Measure all cards, action text and tab labels, including those below the fold.
  const measurement = await home.evaluate((root) => {
    const viewport = document.documentElement.clientWidth;
    const selectors = [
      '[data-testid^="home-metric-"]', '[data-testid="home-shortcuts"] [role="button"]',
      '[data-testid="home-sections"] [role="button"]', '[data-testid="home-staff-alert"]',
      '[data-testid="home-family-alert"]', '[data-testid="home-login"]',
      '[data-testid="home-operations-summary"]', '[data-testid="home-queue-notice"]',
    ];
    const elements = selectors.flatMap((selector) => Array.from(root.querySelectorAll<HTMLElement>(selector)));
    const overflowing = elements.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width < 35 || box.left < -1 || box.right > viewport + 1 ||
        element.scrollWidth > element.clientWidth + 2;
    }).map((element) => element.getAttribute('data-testid') ?? element.textContent?.slice(0, 40));
    const metricRows = Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="home-metric-"]'))
      .map((element) => element.getBoundingClientRect());
    const collidingMetrics = metricRows.some((box, index) => metricRows.slice(index + 1)
      .some((other) => Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 &&
        Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1));
    return { viewport, pageWidth: document.documentElement.scrollWidth, overflowing, collidingMetrics };
  });
  expect(measurement.viewport).toBe(375);
  expect(measurement.pageWidth).toBeLessThanOrEqual(375);
  expect(measurement.overflowing).toEqual([]);
  expect(measurement.collidingMetrics).toBe(false);
  const tabs = page.getByRole('tablist').filter({ visible: true });
  await expect(tabs).toBeVisible();
  const tabBounds = await tabs.boundingBox();
  expect(tabBounds).not.toBeNull();
  expect(tabBounds!.x).toBeGreaterThanOrEqual(-1);
  expect(tabBounds!.x + tabBounds!.width).toBeLessThanOrEqual(376);
}

async function expectReadableAtLargeText(page: Page, home: ReturnType<Page['getByTestId']>) {
  const scaledTextCount = await home.evaluate((dashboard, scale) => {
    const roots = [
      dashboard,
      ...Array.from(document.querySelectorAll<HTMLElement>('[role="tablist"]'))
        .filter((root) => root.getBoundingClientRect().width > 0),
    ];
    const textElements = new Set<HTMLElement>();
    for (const root of roots) {
      for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
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
    return textElements.size;
  }, 1.5);
  expect(scaledTextCount).toBeGreaterThan(0);

  const measurement = await home.evaluate((root) => {
    const viewport = document.documentElement.clientWidth;
    const selectors = [
      '[data-testid^="home-metric-"]',
      '[role="button"]',
    ];
    const targets = selectors.flatMap((selector) => Array.from(root.querySelectorAll<HTMLElement>(selector)));
    const tabTargets = Array.from(document.querySelectorAll<HTMLElement>('[role="tablist"] [role="tab"]'))
      .filter((tab) => tab.getBoundingClientRect().width > 0);
    const clippedText = [...targets, ...tabTargets].flatMap((target) => {
      const textElements = Array.from(target.querySelectorAll<HTMLElement>('*')).filter((element) =>
        Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()),
      );
      return textElements.flatMap((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const box = target.getBoundingClientRect();
        const outside = Array.from(range.getClientRects()).some((line) =>
          line.left < box.left - 3 || line.right > box.right + 3 ||
          line.top < box.top - 3 || line.bottom > box.bottom + 3,
        );
        return outside ? [element.textContent?.trim() ?? ''] : [];
      });
    });
    const overflowing = targets.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.left < -1 || box.right > viewport + 1 ||
        element.scrollWidth > element.clientWidth + 2;
    }).map((element) => element.getAttribute('data-testid') ?? element.textContent?.slice(0, 40));
    const metricBoxes = Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="home-metric-"]'))
      .map((element) => element.getBoundingClientRect());
    const collidingMetrics = metricBoxes.some((box, index) => metricBoxes.slice(index + 1)
      .some((other) => Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 &&
        Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1));
    return { viewport, pageWidth: document.documentElement.scrollWidth, overflowing, clippedText, collidingMetrics };
  });
  expect(measurement.viewport).toBe(375);
  expect(measurement.pageWidth).toBeLessThanOrEqual(375);
  expect(measurement.overflowing).toEqual([]);
  expect(measurement.clippedText).toEqual([]);
  expect(measurement.collidingMetrics).toBe(false);

  const buttons = home.getByRole('button').filter({ visible: true });
  for (const button of await buttons.all()) await button.click({ trial: true });
  const tabs = page.getByRole('tab').filter({ visible: true });
  await expect(tabs).toHaveCount(tabLabels.length);
  const visibleTabLabels = await tabs.evaluateAll((elements) => elements.map((element) =>
    Array.from(element.textContent ?? '')
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return !((codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
          (codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
          (codePoint >= 0x100000 && codePoint <= 0x10fffd));
      })
      .join('')
      .trim(),
  ));
  expect(visibleTabLabels).toEqual(tabLabels);
  for (const tab of await tabs.all()) await tab.click({ trial: true });
}

async function expectFormReadableAtLargeText(
  page: Page,
  labels: string[],
  controlTestIds: string[],
  actionLabels: string[] = [],
) {
  const scaledTextCount = await page.evaluate((scale) => {
    const textElements = new Set<HTMLElement>();
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const box = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      if (box.width <= 0 || box.height <= 0 || computed.display === 'none' ||
        computed.visibility === 'hidden' || computed.opacity === '0') continue;
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
    return textElements.size;
  }, 1.5);
  expect(scaledTextCount).toBeGreaterThan(0);

  const pageLayout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
  }));
  expect(pageLayout.viewport).toBe(375);
  expect(pageLayout.pageWidth).toBeLessThanOrEqual(375);

  for (const label of labels) {
    const text = page.getByText(label, { exact: true }).filter({ visible: true }).first();
    await expect(text, `Expected visible form label: ${label}`).toBeVisible();
    const measurement = await text.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = Array.from(range.getClientRects()).map((line) => ({
        left: line.left, right: line.right, top: line.top, bottom: line.bottom,
      }));
      return {
        left: box.left,
        right: box.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        lines,
      };
    });
    expect(measurement.left, `${label} starts outside the screen`).toBeGreaterThanOrEqual(-1);
    expect(measurement.right, `${label} ends outside the screen`).toBeLessThanOrEqual(376);
    expect(measurement.scrollWidth, `${label} is horizontally clipped`).toBeLessThanOrEqual(measurement.clientWidth + 2);
    expect(measurement.scrollHeight, `${label} is vertically clipped`).toBeLessThanOrEqual(measurement.clientHeight + 2);
    expect(measurement.lines, `${label} has no measurable text`).not.toEqual([]);
    expect(measurement.lines.every((line) => line.left >= measurement.left - 2 &&
      line.right <= measurement.right + 2), `${label} text extends past its label`).toBe(true);
  }

  for (const testId of controlTestIds) {
    const control = page.getByTestId(testId).filter({ visible: true });
    await expect(control, `Expected visible, tappable control: ${testId}`).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds, `${testId} has no touch target`).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(35);
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(376);
    await control.click({ trial: true });
  }

  for (const label of actionLabels) {
    const action = page.getByText(label, { exact: true }).filter({ visible: true }).first();
    await expect(action, `Expected visible action: ${label}`).toBeVisible();
    await action.click({ trial: true });
  }
}

test.beforeAll(async () => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const hash = await bcrypt.hash(password, 12);
  const [existingManager] = await db.select({ id: staffUsers.id }).from(staffUsers)
    .where(and(eq(staffUsers.active, true), inArray(staffUsers.role, ['MANAGER', 'ADMIN']))).limit(1);
  managerId = existingManager?.id ?? randomUUID();
  if (!existingManager) {
    await db.insert(staffUsers).values({ id: managerId, name: 'Home manager', email: `home-manager-${suffix}@example.invalid`, role: 'MANAGER', passwordHash: hash });
    managerCreated = true;
  }
  await db.insert(staffUsers).values({ id: memberId, name: 'Home security member', email: memberEmail, role: 'SECURITY_MEMBER', passwordHash: hash });
  await db.insert(sessions).values({ userId: managerId, tokenHash: hashSessionToken(managerToken), expiresAt: new Date(Date.now() + 3_600_000) });
  const [familyUser] = await db.insert(usersTable).values({
    email: familyEmail, name: 'أسرة الاختبار', identity: `home-${suffix}`,
    passwordHash: await hashPassword(password), role: 'DISPLACED', rank: 'DISPLACED',
  }).returning({ id: usersTable.id });
  familyUserId = familyUser.id;
  await db.insert(campsTable).values({ id: campId, name: 'مخيم اختبار الرئيسية' });
  await db.insert(campSectorsTable).values({ id: sectorId, campId, name: 'قطاع الاختبار' });
  await db.insert(familiesTable).values({ id: familyId, campId, sectorId, headName: 'أسرة الاختبار', headLegacyUserId: familyUserId, status: 'ACTIVE', createdById: managerId });
  await db.insert(familyNeedsTable).values({ id: needId, familyId, category: 'FOOD', title: 'احتياج المنزل', priority: 'MEDIUM', status: 'APPROVED', createdById: managerId });
  await db.insert(tasks).values({ id: taskId, title: 'مهمة منزلية', description: 'متابعة', location: 'المخيم', status: 'IN_PROGRESS', assignedToId: memberId, createdById: managerId });
});

test.afterAll(async () => {
  await db.delete(tasks).where(eq(tasks.id, taskId));
  await db.delete(familyNeedsTable).where(eq(familyNeedsTable.id, needId));
  await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
  await db.delete(campSectorsTable).where(eq(campSectorsTable.id, sectorId));
  await db.delete(campsTable).where(eq(campsTable.id, campId));
  if (familyUserId !== undefined) {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, familyUserId));
    await db.delete(usersTable).where(eq(usersTable.id, familyUserId));
  }
  await db.delete(sessions).where(eq(sessions.userId, managerId));
  await db.delete(sessions).where(eq(sessions.userId, memberId));
  await db.delete(staffUsers).where(eq(staffUsers.id, memberId));
  if (managerCreated) await db.delete(staffUsers).where(eq(staffUsers.id, managerId));
});

test('guest sees public feed and login but no private controls or counts in the 375px web fallback at 150% text', async ({ browser }) => {
  const { context, page, home } = await openHome(browser, 'guest');
  await expect(home.getByTestId('home-login')).toBeVisible();
  await expect(home.getByTestId('home-notifications')).toHaveCount(0);
  await expect(home.getByTestId('home-staff-alert')).toHaveCount(0);
  await expect(home.getByTestId('home-family-alert')).toHaveCount(0);
  await expectNoManagement(page, home);
  await expectFits375(page, home);
  await expectReadableAtLargeText(page, home);
  await context.close();
});

test('manager sees actions, all five figures and operations freshness in the 375px web fallback at 150% text', async ({ browser }) => {
  const { context, page, home } = await openHome(browser, 'manager');
  for (const title of managementActions) {
    await expect(home.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  }
  for (const [index, label] of metricLabels.entries()) {
    await expect(home.getByTestId(`home-metric-${label}`)).toContainText(Object.values(dashboardNumbers)[index].toLocaleString('ar'));
  }
  await expect(home.getByTestId('home-operations-summary')).toContainText('لمحة العمليات');
  await expect(home.getByTestId('home-operations-summary')).toContainText(/بيانات الخادم|قد لا تكون الأرقام محدثة/);
  await expect(home.getByTestId('home-notifications')).toBeVisible();
  await expect(home.getByTestId('home-family-portal')).toHaveCount(0);
  await expect(home.getByTestId('home-family-alert')).toHaveCount(0);
  await expectFits375(page, home);
  await expectReadableAtLargeText(page, home);
  await context.close();
});

test('limited security member sees assigned-task alert without management actions or figures in the 375px web fallback at 150% text', async ({ browser }) => {
  const { context, page, home } = await openHome(browser, 'member');
  await expect(home.getByTestId('home-notifications')).toBeVisible();
  await expect(home.getByTestId('home-staff-alert')).toContainText('1 مهام جارية أو معلّقة');
  await expect(home.getByTestId('home-family-alert')).toHaveCount(0);
  await expect(home.getByTestId('home-family-portal')).toHaveCount(0);
  await expectNoManagement(page, home);
  await expectFits375(page, home);
  await expectReadableAtLargeText(page, home);
  await context.close();
});

test('family head sees only family portal and pending need alert in the 375px web fallback at 150% text', async ({ browser }) => {
  const { context, page, home } = await openHome(browser, 'family');
  await expect(home.getByTestId('home-notifications')).toBeVisible();
  await expect(home.getByTestId('home-family-portal')).toBeVisible();
  await expect(home.getByTestId('home-family-alert')).toContainText('1 طلبات احتياج قيد الانتظار');
  await expect(home.getByTestId('home-staff-alert')).toHaveCount(0);
  await expectNoManagement(page, home);
  await expectFits375(page, home);
  await expectReadableAtLargeText(page, home);
  await context.close();
});

test('login labels, account choices and links stay readable and tappable at 375px and 150% text', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').filter({ visible: true }).click();
  await expect(page.getByText('مرحباً بعودتك', { exact: true })).toBeVisible();
  await expectFormReadableAtLargeText(page, [
    'مرحباً بعودتك',
    'اختر نوع الحساب للوصول إلى مساحة فريق المخيم أو ملف أسرتك.',
    'رب الأسرة',
    'فريق المخيم',
    'البريد الإلكتروني',
    'كلمة المرور',
    'نسيت كلمة المرور؟',
    'لديّ رمز دعوة أو استعادة',
  ], [
    'login-account-family',
    'login-account-staff',
    'login-email',
    'login-password',
    'login-submit',
    'forgot-password-link',
    'complete-invite-link',
  ]);
  await context.close();
});

test('family head can read and tap the need request form at 375px and 150% text', async ({ browser }) => {
  const { context, page } = await openHome(browser, 'family');
  await page.getByTestId('home-family-portal').filter({ visible: true }).click();
  await expect(page.getByText('إرسال طلب احتياج', { exact: true })).toBeVisible();
  await expectFormReadableAtLargeText(page, [
    'إرسال طلب احتياج',
    'نوع الاحتياج',
    'الأولوية',
    'عنوان الطلب',
    'تفاصيل إضافية',
  ], [
    'family-need-title',
    'family-need-description',
    'family-need-submit',
  ], ['غذاء', 'متوسطة']);
  await context.close();
});

test('staff can fill the need form and tap its actions at 375px and 150% text', async ({ browser }) => {
  const { context, page } = await openHome(browser, 'manager');
  await page.goto(`${expoUrl}/need-form`);
  await expect(page.getByText('تفاصيل الاحتياج', { exact: true })).toBeVisible();
  const familyChoice = page.getByText('أسرة الاختبار', { exact: true }).filter({ visible: true }).first();
  await expect(familyChoice).toBeVisible();
  await familyChoice.click();
  await page.getByTestId('need-form-title').fill('احتياج تكبير النص');
  await expect(page.getByTestId('need-form-submit')).toBeEnabled();
  await expectFormReadableAtLargeText(page, [
    'إضافة احتياج جديد',
    'الأسرة المستفيدة',
    'تفاصيل الاحتياج',
    'عنوان الاحتياج *',
    'التصنيف',
    'الأولوية',
    'الوصف (اختياري)',
  ], [
    'need-form-title',
    'need-form-description',
    'need-form-submit',
  ], ['أسرة الاختبار', 'غذاء', 'متوسطة']);
  await context.close();
});

test('staff can create and update family records with readable, tappable forms at 375px and 150% text', async ({ browser }) => {
  const { context, page } = await openHome(browser, 'manager');
  await page.goto(`${expoUrl}/family-form`);
  await expect(page.getByText('إضافة عائلة جديدة', { exact: true })).toBeVisible();
  await page.getByTestId(`family-camp-${campId}`).filter({ visible: true }).click();
  const sectorChoice = page.getByTestId(`family-sector-${sectorId}`).filter({ visible: true });
  await expect(sectorChoice).toBeVisible();
  await page.getByTestId('family-form-head-name').fill('عائلة اختبار التكبير');
  await sectorChoice.click();
  await expect(page.getByTestId('family-form-submit')).toBeEnabled();
  await expectFormReadableAtLargeText(page, [
    'إضافة عائلة جديدة',
    'البيانات الأساسية',
    'اسم رب الأسرة *',
    'رقم الجوال',
    'الموقع في المخيم',
    'المخيم *',
    'المربع / القطاع *',
    'ملاحظات إيواء (اختياري)',
  ], [
    'family-form-head-name',
    'family-form-phone',
    'family-form-critical-notes',
    `family-camp-${campId}`,
    `family-sector-${sectorId}`,
    'family-form-submit',
  ]);

  await page.goto(`${expoUrl}/family-form?id=${familyId}`);
  await expect(page.getByText('تعديل العائلة', { exact: true })).toBeVisible();
  await expect(page.getByTestId('family-form-submit')).toBeEnabled();
  await expectFormReadableAtLargeText(page, [
    'تعديل العائلة',
    'البيانات الأساسية',
    'اسم رب الأسرة *',
    'رقم الجوال',
    'الموقع في المخيم',
    'المخيم *',
    'المربع / القطاع *',
    'ملاحظات إيواء (اختياري)',
  ], [
    'family-form-head-name',
    'family-form-phone',
    'family-form-critical-notes',
    `family-sector-${sectorId}`,
    'family-form-submit',
  ]);
  await context.close();
});