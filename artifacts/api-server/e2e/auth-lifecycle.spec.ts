import { expect, test } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, sessions, staffUsers, type StaffRole } from '@workspace/db';

const webUrl = process.env.WEB_E2E_URL;
const expoUrl = process.env.EXPO_E2E_URL;
const password = `Task10-${randomUUID()}!`;
const developmentDemoPassword = "CampDemo2025!";
const userId = randomUUID();
const email = `task10-browser-${randomUUID()}@example.invalid`;
type BrowserStaff = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
};

const browserUsers: BrowserStaff[] = [
  { id: userId, email, name: 'Task 10 browser user', role: 'MANAGER' },
  {
    id: randomUUID(),
    email: `task27-admin-${randomUUID()}@example.invalid`,
    name: 'Task 27 admin user',
    role: 'ADMIN',
  },
  {
    id: randomUUID(),
    email: `task27-delegate-${randomUUID()}@example.invalid`,
    name: 'Task 27 delegate user',
    role: 'DELEGATE',
  },
  {
    id: randomUUID(),
    email: `task27-security-officer-${randomUUID()}@example.invalid`,
    name: 'Task 27 security officer user',
    role: 'SECURITY_OFFICER',
  },
  {
    id: randomUUID(),
    email: `task27-security-member-${randomUUID()}@example.invalid`,
    name: 'Task 27 security member user',
    role: 'SECURITY_MEMBER',
  },
];

const canonicalIdToNumber = (id: string): number => {
  const numeric = Number(id);
  if (Number.isSafeInteger(numeric) && numeric > 0) return numeric;
  return Math.abs(
    Array.from(id).reduce(
      (value, character) => ((value * 31) + character.charCodeAt(0)) | 0,
      7,
    ),
  ) || 1;
};

const userByRole = (role: StaffRole) => {
  const user = browserUsers.find((candidate) => candidate.role === role);
  if (!user) throw new Error(`Missing browser fixture for role ${role}`);
  return user;
};

const closeDevelopmentBanner = async (page: import('@playwright/test').Page) => {
  const closeButton = page.locator('#replit-dev-banner .banner-close');
  if (await closeButton.count()) await closeButton.click({ force: true });
};

test.beforeAll(async () => {
  expect(webUrl, 'Set WEB_E2E_URL to the running web artifact URL').toBeTruthy();
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(staffUsers).values(
    browserUsers.map((user) => ({ ...user, passwordHash })),
  );
});

test.afterAll(async () => {
  for (const user of browserUsers) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(staffUsers).where(eq(staffUsers.id, user.id));
  }
});

test('web login, reload, synchronized refresh and logout clear private state', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${webUrl}/auth/login`);
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/actor\/operations/);
  await expect(page.getByText('Task 10 browser user').first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('aqsa-access-token'))).not.toBeNull();

  await page.reload();
  await expect(page.getByText('Task 10 browser user').first()).toBeAttached();
  const refresh = page.waitForResponse((response) =>
    response.url().includes('/api/auth/me') && response.status() < 400,
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await refresh;

  const navbarLogout = page.locator('[data-testid="navbar-logout"]:visible');
  if (await navbarLogout.count()) {
    await navbarLogout.click();
  } else {
    await closeDevelopmentBanner(page);
    await page.getByTestId('header-account-menu').click();
    await page.getByTestId('header-logout').click();
  }
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('aqsa-access-token'))).toBeNull();
  await page.reload();
  await expect(page.locator('[data-testid="login-submit"]:visible')).toBeVisible();
  await expect(page.getByText('Task 10 browser user')).toHaveCount(0);
  await context.close();
});

test('unauthenticated direct actor links redirect before rendering or fetching private data', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const apiRequests: string[] = [];

  page.on('request', (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname.startsWith('/api/')) apiRequests.push(requestUrl.pathname);
  });

  await page.goto(`${webUrl}/actor/manager/12345/profile`);
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('[data-testid="login-submit"]:visible').first()).toBeVisible();
  await expect(page.getByTestId('actor-layout')).toHaveCount(0);
  await expect(page.getByTestId('access-denied')).toHaveCount(0);
  expect(apiRequests).toEqual([]);

  await context.close();
});

const roleRouteCases: Array<{
  role: StaffRole;
  allowedPath: string;
  deniedPath: string;
  forbiddenMarker: string;
}> = [
  {
    role: 'ADMIN',
    allowedPath: '/actor/staff',
    deniedPath: `/actor/manager/${canonicalIdToNumber(userId)}/profile`,
    forbiddenMarker: 'البيانات الشخصية:',
  },
  {
    role: 'MANAGER',
    allowedPath: `/actor/manager/${canonicalIdToNumber(userId)}/profile`,
    deniedPath: '/actor/staff',
    forbiddenMarker: 'إدارة الموظفين',
  },
  {
    role: 'DELEGATE',
    allowedPath: `/actor/delegates/${canonicalIdToNumber(userByRole('DELEGATE').id)}/profile`,
    deniedPath: `/actor/manager/${canonicalIdToNumber(userId)}/profile`,
    forbiddenMarker: 'البيانات الشخصية:',
  },
  {
    role: 'SECURITY_OFFICER',
    allowedPath: `/actor/securities/${canonicalIdToNumber(userByRole('SECURITY_OFFICER').id)}/tasks`,
    deniedPath: `/actor/manager/${canonicalIdToNumber(userId)}/profile`,
    forbiddenMarker: 'البيانات الشخصية:',
  },
  {
    role: 'SECURITY_MEMBER',
    allowedPath: `/actor/securities/${canonicalIdToNumber(userByRole('SECURITY_MEMBER').id)}/tasks`,
    deniedPath: `/actor/manager/${canonicalIdToNumber(userId)}/profile`,
    forbiddenMarker: 'البيانات الشخصية:',
  },
];

for (const routeCase of roleRouteCases) {
  test(`${routeCase.role} can open its route but cannot open another role's route`, async ({ browser }) => {
    const fixture = userByRole(routeCase.role);
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${webUrl}/auth/login`);
    await page.locator('[data-testid="login-email"]:visible').fill(fixture.email);
    await page.locator('[data-testid="login-password"]:visible').fill(password);
    await page.locator('[data-testid="login-submit"]:visible').click();
    await expect(page).toHaveURL(/\/actor\/operations$/);

    await page.goto(`${webUrl}${routeCase.allowedPath}`);
    await expect(page).toHaveURL(new RegExp(`${routeCase.allowedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.getByTestId('actor-layout')).toBeVisible();
    await expect(page.getByTestId('access-denied')).toHaveCount(0);

    const deniedApiRequests: string[] = [];
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.pathname.startsWith('/api/')) deniedApiRequests.push(requestUrl.pathname);
    });

    await page.goto(`${webUrl}${routeCase.deniedPath}`);
    await expect(page).toHaveURL(new RegExp(`${routeCase.deniedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.getByTestId('access-denied')).toBeVisible();
    await expect(page.getByTestId('actor-layout')).toHaveCount(0);
    await expect(page.getByText(routeCase.forbiddenMarker, { exact: true })).toHaveCount(0);
    expect(deniedApiRequests.filter((path) => !path.startsWith('/api/auth/'))).toEqual([]);

    await context.close();
  });
}

type DemoStaffAccount = {
  role: StaffRole;
  email: string;
  name: string;
  allowedPath: string;
  allowedHeading: string;
  deniedPath: string;
  expectedNavigation: string[];
  hiddenNavigation: string[];
};

const demoStaffAccounts: DemoStaffAccount[] = [
  {
    role: 'ADMIN',
    email: 'admin@alaqsa.local',
    name: 'مدير النظام',
    allowedPath: '/actor/staff',
    allowedHeading: 'إدارة الموظفين',
    deniedPath: '/actor/manager/2000000000/profile',
    expectedNavigation: ['لوحة العمليات', 'ملفي الشخصي', 'الأسر والإيواء', 'الاحتياجات والطلبات', 'المساعدات والتسليم', 'المهام الأمنية', 'التقارير', 'إدارة الموظفين'],
    hiddenNavigation: [],
  },
  {
    role: 'MANAGER',
    email: 'manager@alaqsa.local',
    name: 'أحمد الخطيب',
    allowedPath: '/actor/families',
    allowedHeading: 'سجل الأسر',
    deniedPath: '/actor/staff',
    expectedNavigation: ['لوحة العمليات', 'ملفي الشخصي', 'الأسر والإيواء', 'الاحتياجات والطلبات', 'المساعدات والتسليم', 'المهام الأمنية', 'التقارير'],
    hiddenNavigation: ['إدارة الموظفين'],
  },
  {
    role: 'DELEGATE',
    email: 'delegate@alaqsa.local',
    name: 'سارة النجار',
    allowedPath: '/actor/families',
    allowedHeading: 'سجل الأسر',
    deniedPath: '/actor/tasks',
    expectedNavigation: ['لوحة العمليات', 'ملفي الشخصي', 'الأسر والإيواء', 'الاحتياجات والطلبات', 'المساعدات والتسليم', 'التقارير'],
    hiddenNavigation: ['المهام الأمنية', 'إدارة الموظفين'],
  },
  {
    role: 'SECURITY_OFFICER',
    email: 'security@alaqsa.local',
    name: 'محمود سالم',
    allowedPath: '/actor/needs',
    allowedHeading: 'الاحتياجات',
    deniedPath: '/actor/families',
    expectedNavigation: ['لوحة العمليات', 'ملفي الشخصي', 'الاحتياجات العاجلة', 'المهام الأمنية', 'التقارير'],
    hiddenNavigation: ['الأسر والإيواء', 'المساعدات والتسليم', 'إدارة الموظفين'],
  },
  {
    role: 'SECURITY_MEMBER',
    email: 'security-member@alaqsa.local',
    name: 'فارس شحادة',
    allowedPath: '/actor/tasks',
    allowedHeading: 'المهام الأمنية والميدانية',
    deniedPath: '/actor/needs',
    expectedNavigation: ['لوحة العمليات', 'ملفي الشخصي', 'المهام الأمنية', 'التقارير'],
    hiddenNavigation: ['الأسر والإيواء', 'الاحتياجات العاجلة', 'المساعدات والتسليم', 'إدارة الموظفين'],
  },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loginDemoStaff = async (page: import('@playwright/test').Page, account: DemoStaffAccount) => {
  await page.goto(`${webUrl}/auth/login`);
  await page.locator('[data-testid="login-email"]:visible').fill(account.email);
  await page.locator('[data-testid="login-password"]:visible').fill(developmentDemoPassword);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/actor\/operations$/);
  await expect(page.getByTestId('actor-layout')).toBeVisible();
  await expect(page.getByText(account.name, { exact: true }).first()).toBeVisible();
};

const expectHealthyActorRoute = async (
  page: import('@playwright/test').Page,
  path: string,
  heading: string,
) => {
  const unhealthyApiResponses: string[] = [];
  const onResponse = (response: import('@playwright/test').Response) => {
    const responseUrl = new URL(response.url());
    if (
      responseUrl.pathname.startsWith('/api/') &&
      [401, 403, 404].includes(response.status())
    ) {
      unhealthyApiResponses.push(`${response.status()} ${responseUrl.pathname}`);
    }
  };
  page.on('response', onResponse);
  try {
    await page.goto(`${webUrl}${path}`);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(path)}$`));
    await expect(page.getByTestId('actor-layout')).toBeVisible();
    await expect(page.getByTestId('access-denied')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
    await page.waitForTimeout(250);
    expect(unhealthyApiResponses).toEqual([]);
  } finally {
    page.off('response', onResponse);
  }
};

for (const account of demoStaffAccounts) {
  test(`${account.role} demo account is redirected, sees the right menu, and loads its workspace`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginDemoStaff(page, account);
    const actorLayout = page.getByTestId('actor-layout');
    for (const label of account.expectedNavigation) {
      await expect(actorLayout.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    for (const label of account.hiddenNavigation) {
      await expect(actorLayout.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    await expectHealthyActorRoute(page, account.allowedPath, account.allowedHeading);

    const deniedApiRequests: string[] = [];
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.pathname.startsWith('/api/') && !requestUrl.pathname.startsWith('/api/auth/')) {
        deniedApiRequests.push(requestUrl.pathname);
      }
    });
    await page.goto(`${webUrl}${account.deniedPath}`);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(account.deniedPath)}$`));
    await expect(page.getByTestId('access-denied')).toBeVisible();
    await expect(page.getByTestId('actor-layout')).toHaveCount(0);
    expect(deniedApiRequests).toEqual([]);

    await context.close();
  });
}

test('DELEGATE demo account only sees families assigned to its scope', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const delegate = demoStaffAccounts.find((account) => account.role === 'DELEGATE')!;

  await loginDemoStaff(page, delegate);
  await expectHealthyActorRoute(page, '/actor/families', 'سجل الأسر');
  await expect(page.getByRole('heading', { name: 'أمينة يوسف العطار', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'خالد محمد أبو عودة', exact: true })).toHaveCount(0);

  await context.close();
});

test('family head demo account reaches its private family page without unauthorized API calls', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const unhealthyApiResponses: string[] = [];
  page.on('response', (response) => {
    const responseUrl = new URL(response.url());
    if (responseUrl.pathname.startsWith('/api/') && [401, 403, 404].includes(response.status())) {
      unhealthyApiResponses.push(`${response.status()} ${responseUrl.pathname}`);
    }
  });

  await page.goto(`${webUrl}/auth/login`);
  await page.getByRole('radiogroup').getByText('رب الأسرة', { exact: true }).click();
  await page.locator('[data-testid="login-email"]:visible').fill('resident@local.invalid');
  await page.locator('[data-testid="login-password"]:visible').fill(developmentDemoPassword);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/actor\/family$/);
  await expect(page.getByRole('heading', { name: 'ملف أسرتي واحتياجاتها', exact: true })).toBeVisible();
  await expect(page.getByText('أمينة يوسف العطار', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('actor-layout')).toBeVisible();
  await expect(page.getByTestId('actor-layout').getByRole('link', { name: 'ملف الأسرة وطلباتها', exact: true })).toBeVisible();
  await expect(page.getByTestId('actor-layout').getByRole('link', { name: 'لوحة العمليات', exact: true })).toHaveCount(0);
  await page.waitForTimeout(250);
  expect(unhealthyApiResponses).toEqual([]);

  await context.close();
});

test('browser back after logout cannot restore the protected actor screen', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const manager = userByRole('MANAGER');

  await page.goto(`${webUrl}/auth/login`);
  await page.locator('[data-testid="login-email"]:visible').fill(manager.email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/actor\/operations/);
  await expect(page.getByTestId('actor-layout')).toBeVisible();

  const navbarLogout = page.locator('[data-testid="navbar-logout"]:visible');
  if (await navbarLogout.count()) {
    await navbarLogout.click();
  } else {
    await closeDevelopmentBanner(page);
    await page.getByTestId('header-account-menu').click();
    await page.getByTestId('header-logout').click();
  }
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.goBack();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('[data-testid="login-submit"]:visible').first()).toBeVisible();
  await expect(page.getByTestId('actor-layout')).toHaveCount(0);
  await expect(page.getByText(manager.name)).toHaveCount(0);

  await context.close();
});

test('Expo web login, reload, synchronized refresh and logout clear private state', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 720 } });
  const page = await context.newPage();
  await page.goto(expoUrl!);
  await page.getByTestId('home-login').click();
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('button', { name: /متزامن مع خادم الفريق/ })).toBeVisible();

  await page.getByText('الحساب', { exact: true }).last().click();
  await expect(page.getByText(email).last()).toBeVisible();
  await page.reload();
  await expect(page.getByText(email).last()).toBeVisible();
  await page.getByRole('button', { name: /متزامن مع خادم الفريق/ }).click();
  await expect(page.getByText('حساب متزامن')).toBeVisible();

  await page.getByTestId('account-logout').click();
  await expect(page.getByTestId('account-login')).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('account-login')).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
  await context.close();
});