import { expect, test } from '@playwright/test';

const expoUrl = process.env.EXPO_E2E_URL;

test('keeps the credential save button reachable and tappable with the keyboard open on a short screen', async ({
  browser,
}) => {
  expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();

  const context = await browser.newContext({
    viewport: { width: 390, height: 720 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.route(/\/api\/auth\/complete-credential(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'invalid credential' }),
    }),
  );

  await page.goto(expoUrl!);
  await page.getByTestId('home-login').filter({ visible: true }).click();
  await page.getByTestId('complete-invite-link').filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'تعيين كلمة المرور' })).toBeVisible();

  await page.getByTestId('credential-token').fill('a'.repeat(32));
  await page.getByTestId('credential-password').fill('Secure-Password-123!');
  const confirmation = page.getByTestId('credential-confirmation');
  await confirmation.fill('Secure-Password-123!');
  await confirmation.focus();

  // Resizing to the space above the software keyboard models Android's adjust-resize viewport.
  await page.setViewportSize({ width: 390, height: 380 });
  await expect(confirmation).toBeFocused();

  const scrollView = page.getByTestId('credential-scroll-view');
  const scrollMetrics = await scrollView.evaluate((element) => {
    const view = element as HTMLElement;
    return { clientHeight: view.clientHeight, scrollHeight: view.scrollHeight };
  });
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  await scrollView.evaluate((element) => {
    const view = element as HTMLElement;
    view.scrollTop = view.scrollHeight;
  });

  const button = page.getByTestId('credential-submit');
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const buttonBounds = await button.evaluate((element) => {
    const buttonRect = element.getBoundingClientRect();
    const scrollViewRect = element
      .closest('[data-testid="credential-scroll-view"]')!
      .getBoundingClientRect();
    return {
      buttonBottom: buttonRect.bottom,
      scrollBottom: scrollViewRect.bottom,
    };
  });
  expect(buttonBounds.buttonBottom).toBeLessThanOrEqual(buttonBounds.scrollBottom - 16);

  await button.click();
  await expect(page.getByTestId('credential-error')).toBeVisible();
  await context.close();
});