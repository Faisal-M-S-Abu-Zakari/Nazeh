import { expect, test } from '@playwright/test';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, sessions, staffUsers } from '@workspace/db';

const webUrl = process.env.WEB_E2E_URL;
const expoUrl = process.env.EXPO_E2E_URL;
const password = `Task10-${randomUUID()}!`;
const userId = randomUUID();
const email = `task10-browser-${randomUUID()}@example.invalid`;

test.beforeAll(async () => {
  expect(webUrl, 'Set WEB_E2E_URL to the running web artifact URL').toBeTruthy();
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  await db.insert(staffUsers).values({
    id: userId,
    email,
    name: 'Task 10 browser user',
    passwordHash: await bcrypt.hash(password, 12),
    role: 'MANAGER',
  });
});

test.afterAll(async () => {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(staffUsers).where(eq(staffUsers.id, userId));
});

test('web login, reload, synchronized refresh and logout clear private state', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${webUrl}/auth/login`);
  await page.locator('[data-testid="login-email"]:visible').fill(email);
  await page.locator('[data-testid="login-password"]:visible').fill(password);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/manager\/.+\/profile/);
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