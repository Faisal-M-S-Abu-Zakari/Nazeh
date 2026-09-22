import { expect, test, type Page } from '@playwright/test';

const webUrl = process.env.WEB_E2E_URL;
const demoPassword = 'CampDemo2025!';

type DemoAccount = {
  email: string;
  name: string;
};

const manager: DemoAccount = {
  email: 'manager@alaqsa.local',
  name: 'أحمد',
};

const delegate: DemoAccount = {
  email: 'delegate@alaqsa.local',
  name: 'سارة',
};

async function login(page: Page, account: DemoAccount) {
  await page.goto(`${webUrl}/auth/login`);
  await page.locator('[data-testid="login-email"]:visible').fill(account.email);
  await page.locator('[data-testid="login-password"]:visible').fill(demoPassword);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/actor\/operations$/);
  await expect(page.getByTestId('actor-layout')).toBeVisible();
}

async function logout(page: Page) {
  const navbarLogout = page.locator('[data-testid="navbar-logout"]:visible');
  if (await navbarLogout.count()) {
    await navbarLogout.click();
  } else {
    const bannerClose = page.locator('#replit-dev-banner .banner-close');
    if (await bannerClose.count()) await bannerClose.click({ force: true });
    await page.getByTestId('header-account-menu').click();
    await page.getByTestId('header-logout').click();
  }
  await expect(page).toHaveURL(/\/auth\/login/);
}

async function openNeedForm(page: Page) {
  await page.goto(`${webUrl}/actor/needs/new`);
  await expect(page.getByRole('heading', { name: 'تسجيل طلب جديد', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'عنوان الطلب', exact: false })).toBeVisible();
}

test.beforeAll(() => {
  expect(webUrl, 'Set WEB_E2E_URL to the running web artifact URL').toBeTruthy();
});

test('restores a draft after reload, isolates it between accounts, and clears it', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, manager);
    await openNeedForm(page);

    const title = page.getByRole('textbox', { name: 'عنوان الطلب', exact: false });
    const description = page.getByRole('textbox', { name: 'وصف تفصيلي', exact: false });
    const family = page.getByRole('textbox', { name: 'الأسرة المستفيدة', exact: false });
    const category = page.getByRole('textbox', { name: 'فئة الطلب', exact: false });
    const priority = page.getByRole('textbox', { name: 'الأولوية', exact: false });

    await family.click();
    await page.getByRole('option').first().click();
    await category.click();
    await page.getByRole('option', { name: 'رعاية طبية', exact: true }).click();
    await priority.click();
    await page.getByRole('option', { name: 'عالية', exact: true }).click();

    const selectedFamily = await family.inputValue();
    await title.fill('حليب وأدوية للأطفال');
    await description.fill('احتياج تجريبي يجب أن يبقى مرتبطًا بحساب المدير فقط');

    await expect.poll(() =>
      page.evaluate(() =>
        Object.entries(localStorage).some(
          ([key, value]) =>
            key.startsWith('aqsa-need-draft:') &&
            value.includes('حليب وأدوية للأطفال'),
        ),
      ),
    ).toBe(true);

    await page.reload();
    await expect(family).toHaveValue(selectedFamily);
    await expect(category).toHaveValue('رعاية طبية');
    await expect(priority).toHaveValue('عالية');
    await expect(title).toHaveValue('حليب وأدوية للأطفال');
    await expect(description).toHaveValue('احتياج تجريبي يجب أن يبقى مرتبطًا بحساب المدير فقط');

    await logout(page);
    await login(page, delegate);
    await openNeedForm(page);
    await expect(page.getByRole('textbox', { name: 'الأسرة المستفيدة', exact: false })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'فئة الطلب', exact: false })).toHaveValue('غذاء');
    await expect(page.getByRole('textbox', { name: 'الأولوية', exact: false })).toHaveValue('متوسطة');
    await expect(page.getByRole('textbox', { name: 'عنوان الطلب', exact: false })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'وصف تفصيلي', exact: false })).toHaveValue('');

    await logout(page);
    await login(page, manager);
    await openNeedForm(page);
    await expect(page.getByRole('textbox', { name: 'الأسرة المستفيدة', exact: false })).toHaveValue(selectedFamily);
    await expect(page.getByRole('textbox', { name: 'فئة الطلب', exact: false })).toHaveValue('رعاية طبية');
    await expect(page.getByRole('textbox', { name: 'الأولوية', exact: false })).toHaveValue('عالية');
    await expect(page.getByRole('textbox', { name: 'عنوان الطلب', exact: false })).toHaveValue('حليب وأدوية للأطفال');
    await expect(page.getByRole('textbox', { name: 'وصف تفصيلي', exact: false })).toHaveValue(
      'احتياج تجريبي يجب أن يبقى مرتبطًا بحساب المدير فقط',
    );

    await page.getByRole('button', { name: 'مسح المسودة', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'الأسرة المستفيدة', exact: false })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'فئة الطلب', exact: false })).toHaveValue('غذاء');
    await expect(page.getByRole('textbox', { name: 'الأولوية', exact: false })).toHaveValue('متوسطة');
    await expect(page.getByRole('textbox', { name: 'عنوان الطلب', exact: false })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'وصف تفصيلي', exact: false })).toHaveValue('');

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'الأسرة المستفيدة', exact: false })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'فئة الطلب', exact: false })).toHaveValue('غذاء');
    await expect(page.getByRole('textbox', { name: 'الأولوية', exact: false })).toHaveValue('متوسطة');
    await expect(page.getByRole('textbox', { name: 'عنوان الطلب', exact: false })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'وصف تفصيلي', exact: false })).toHaveValue('');
    await expect.poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) => key.startsWith('aqsa-need-draft:')),
      ),
    ).toBe(false);
  } finally {
    await context.close();
  }
});