import { expect, test, type Page } from '@playwright/test';

const webUrl = process.env.WEB_E2E_URL;
const demoPassword = 'CampDemo2025!';

type CreationFlow = {
  listPath: string;
  listHeading: string;
  addButton: string;
  formPath: string;
  formHeading: string;
  fields: string[];
};

const creationFlows: CreationFlow[] = [
  {
    listPath: '/actor/families',
    listHeading: 'إدارة الأسر والنازحين',
    addButton: 'إضافة أسرة جديدة',
    formPath: '/actor/families/new',
    formHeading: 'تسجيل أسرة جديدة',
    fields: ['الاسم الرباعي', 'رقم الهاتف', 'المخيم', 'القطاع'],
  },
  {
    listPath: '/actor/needs',
    listHeading: 'الاحتياجات والطلبات',
    addButton: 'طلب احتياج جديد',
    formPath: '/actor/needs/new',
    formHeading: 'تسجيل طلب جديد',
    fields: ['الأسرة المستفيدة', 'فئة الطلب', 'عنوان الطلب', 'وصف تفصيلي'],
  },
  {
    listPath: '/actor/aids',
    listHeading: 'المساعدات والتسليم',
    addButton: 'إضافة مورد جديد',
    formPath: '/actor/aids/new',
    formHeading: 'تسجيل مورد مساعدة جديد',
    fields: ['اسم / وصف المساعدة', 'الموقع / المستودع', 'الكمية الإجمالية', 'وحدة القياس'],
  },
  {
    listPath: '/actor/tasks',
    listHeading: 'المهام الأمنية والميدانية',
    addButton: 'إضافة مهمة جديدة',
    formPath: '/actor/tasks/new',
    formHeading: 'إسناد مهمة أمنية',
    fields: ['عنوان المهمة', 'الموقع', 'موعد إنجاز المهمة', 'التفاصيل والتعليمات'],
  },
  {
    listPath: '/actor/content',
    listHeading: 'إدارة المحتوى',
    addButton: 'إضافة محتوى جديد',
    formPath: '/actor/content/new',
    formHeading: 'إضافة محتوى جديد',
    fields: ['العنوان', 'رابط الصورة (اختياري)', 'محتوى المقال'],
  },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function loginAsManager(page: Page) {
  await page.goto(`${webUrl}/auth/login`);
  await page.locator('[data-testid="login-email"]:visible').fill('manager@alaqsa.local');
  await page.locator('[data-testid="login-password"]:visible').fill(demoPassword);
  await page.locator('[data-testid="login-submit"]:visible').click();
  await expect(page).toHaveURL(/\/actor\/operations$/);
  await expect(page.getByTestId('actor-layout')).toBeVisible();
}

test.beforeAll(() => {
  expect(webUrl, 'Set WEB_E2E_URL to the running web artifact URL').toBeTruthy();
});

test('all add buttons open the intended form and cancel returns to its list', async ({ page }) => {
  await loginAsManager(page);

  for (const flow of creationFlows) {
    await test.step(flow.addButton, async () => {
      await page.goto(`${webUrl}${flow.listPath}`);
      await expect(page.getByRole('heading', { name: flow.listHeading, exact: true })).toBeVisible();

      await page.getByRole('button', { name: flow.addButton, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(flow.formPath)}$`));
      await expect(page.getByRole('heading', { name: flow.formHeading, exact: true })).toBeVisible();

      for (const field of flow.fields) {
        await expect(page.getByRole('textbox', { name: field, exact: false })).toBeVisible();
      }

      await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(flow.listPath)}$`));
      await expect(page.getByRole('heading', { name: flow.listHeading, exact: true })).toBeVisible();
    });
  }
});