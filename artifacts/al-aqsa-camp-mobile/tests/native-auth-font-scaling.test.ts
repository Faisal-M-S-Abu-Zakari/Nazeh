import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, mobileRoot), 'utf8');

test('recovery and credential screens preserve native font scaling and vertical scrolling', () => {
  const forgot = source('app/auth/forgot.tsx');
  const otp = source('app/auth/otp.tsx');

  for (const screen of [forgot, otp]) {
    const scrollView = screen.match(/<KeyboardAwareScrollViewCompat\b[^>]*>/s)?.[0];
    assert.ok(scrollView, 'expected the screen to use the keyboard-aware scroll view');
    assert.match(scrollView, /contentContainerStyle=\{/);
    assert.match(scrollView, /styles\.content/);
    assert.match(screen, /<Text allowFontScaling style=\{\[styles\.title/);
  }

  assert.match(forgot, /<Text allowFontScaling style=\{\[styles\.copy/);
  assert.match(otp, /<Text allowFontScaling style=\{\[styles\.copy/);
  assert.match(
    otp,
    /testID="credential-password-requirements"[\s\S]*?allowFontScaling[\s\S]*?style=\{\[styles\.hint/,
  );
  assert.match(otp, /<Text allowFontScaling accessibilityRole="alert"/);
  assert.match(otp, /testID="credential-password-requirements"/);
  assert.match(otp, /accessibilityRole="text"/);
  assert.match(otp, /accessibilityLabel="12 حرفاً على الأقل، مع حرف كبير وصغير ورقم ورمز\."/);

  const ui = source('components/ui.tsx');

  const login = source('app/auth/login.tsx');

  assert.match(login, /<KeyboardAwareScrollViewCompat contentContainerStyle=\{styles\.content\}/);
  assert.match(login, /<Text allowFontScaling style=\{\[styles\.title/);
  assert.match(login, /<Text allowFontScaling style=\{\[styles\.copy/);
  assert.match(login, /login-account-family" accessibilityRole="button" accessibilityLabel="رب الأسرة" accessibilityState=\{\{ selected: accountType === 'family' \}\}/);
  assert.match(login, /login-account-staff" accessibilityRole="button" accessibilityLabel="فريق المخيم" accessibilityState=\{\{ selected: accountType === 'staff' \}\}/);
  assert.match(login, /<Field testID="login-email" label="البريد الإلكتروني"/);
  assert.match(login, /<Field testID="login-password" label="كلمة المرور"/);
  assert.match(login, /testID="login-error" allowFontScaling accessibilityRole="alert" accessibilityLiveRegion="assertive"/);
  assert.match(login, /AccessibilityInfo\.announceForAccessibility\(error\)/);
  assert.match(login, /Platform\.OS === 'ios'/);
  assert.match(login, /getErrorStatus\(cause\) === 401 \? 'البريد الإلكتروني أو كلمة المرور غير صحيحة\.'/);
  assert.match(login, /: CONNECTION_LOGIN_ERROR/);
  assert.doesNotMatch(login, /cause\.message/);
  assert.match(login, /testID="forgot-password-link" accessibilityRole="button" accessibilityLabel="نسيت كلمة المرور؟"/);
  assert.match(login, /testID="complete-invite-link" accessibilityRole="button" accessibilityLabel="لديّ رمز دعوة أو استعادة"/);
  assert.match(ui, /accessibilityLabel=\{label\}/);
  assert.match(ui, /<Text allowFontScaling style=\{\[styles\.buttonText/);
  assert.match(ui, /allowFontScaling\s+accessibilityLabel=\{props\.accessibilityLabel \?\? label\}/);
});

test('native large-text flow covers rejected sign-in feedback and recovery actions', () => {
  const flow = source('../api-server/e2e/mobile-native-auth-large-text.yaml');

  const login = source('app/auth/login.tsx');

  for (const testId of [
    'login-account-family',
    'login-account-staff',
    'login-email',
    'login-password',
    'login-submit',
    'forgot-password-link',
    'complete-invite-link',
  ]) {
    assert.ok(flow.includes(testId), `native sign-in flow is missing ${testId}`);
  }

  for (const label of [
    'رب الأسرة',
    'فريق المخيم',
    'البريد الإلكتروني',
    'كلمة المرور',
    'دخول',
    'نسيت كلمة المرور؟',
    'لديّ رمز دعوة أو استعادة',
  ]) {
    assert.ok(flow.includes(label), `native sign-in flow is missing the label ${label}`);
  }

  assert.match(flow, /selected: true/);
  assert.match(flow, /focused: true/);
  assert.match(flow, /استعادة الوصول/);
  assert.match(flow, /تعيين كلمة المرور/);
  assert.match(flow, /id: login-error/);
  assert.match(flow, /تحقق من البريد وكلمة المرور \(8 أحرف على الأقل\)\./);
  assert.match(flow, /البريد الإلكتروني أو كلمة المرور غير صحيحة\./);
  assert.match(flow, /example\.invalid/);
  assert.match(flow, /assertNotVisible: "Invalid credentials"/);
  assert.match(flow, /assertNotVisible: "Invalid email or password"/);
  assert.match(flow, /assertNotVisible: "401"/);

  const emptyCredentialGuard = login.indexOf("if (!email.includes('@') || password.length < 8) return setError");
  const signInRequest = login.indexOf('await signIn(');
  assert.ok(emptyCredentialGuard !== -1 && emptyCredentialGuard < signInRequest, 'empty credentials must be rejected before the sign-in request');
});

test('native large-text flow checks reset fields, labels, focus, and save access without submitting', () => {
  const flow = source('../api-server/e2e/mobile-native-auth-large-text.yaml');

  for (const [testId, label] of [
    ['credential-token', 'الرمز الآمن'],
    ['credential-password', 'كلمة المرور الجديدة'],
    ['credential-password-requirements', '12 حرفاً على الأقل، مع حرف كبير وصغير ورقم ورمز.'],
    ['credential-confirmation', 'تأكيد كلمة المرور'],
    ['credential-submit', 'حفظ كلمة المرور'],
  ]) {
    assert.ok(
      flow.includes(`id: ${testId}\n    text: "${label}"`),
      `native flow must match ${testId} with the accessible label ${label}`,
    );
  }

  for (const [testId, label] of [
    ['credential-token', 'الرمز الآمن'],
    ['credential-password', 'كلمة المرور الجديدة'],
    ['credential-confirmation', 'تأكيد كلمة المرور'],
  ]) {
    assert.ok(
      flow.includes(`id: ${testId}\n    text: "${label}"\n    focused: true`),
      `native flow must verify focus for ${testId}`,
    );
  }

  assert.match(flow, /id: credential-submit[\s\S]*?enabled: true/);
  assert.doesNotMatch(flow, /tapOn:\s*\n\s+id: credential-submit/);
});

test('native connection failures are announced safely and leave sign-in retryable', () => {
  const login = source('app/auth/login.tsx');
  const flow = source('../api-server/e2e/mobile-native-auth-connection-failure.yaml');
  const connectionMessage = 'تعذر تسجيل الدخول. تحقق من الاتصال وحاول مجدداً.';
  const failureHandler = login.match(/catch \(cause\) \{([\s\S]*?)\n    \} finally/)?.[1];

  assert.ok(failureHandler, 'expected sign-in failures to have a dedicated catch path');
  assert.ok(login.includes(`const CONNECTION_LOGIN_ERROR = '${connectionMessage}'`));
  assert.match(failureHandler, /CONNECTION_LOGIN_ERROR/);
  assert.doesNotMatch(failureHandler, /setError\((?:cause|error)(?:\.message)?\)|setError\(\$\{/);
  assert.match(login, /if \(error && Platform\.OS === 'ios'\) AccessibilityInfo\.announceForAccessibility\(error\)/);
  assert.match(login, /testID="login-error" allowFontScaling accessibilityRole="alert" accessibilityLiveRegion="assertive"/);
  assert.match(login, /finally \{ setSubmitting\(false\); \}/);
  assert.match(login, /<PrimaryButton testID="login-submit" label=\{submitting \? 'جارٍ الدخول…' : 'دخول'\} icon="arrow-back" disabled=\{submitting\}/);

  assert.ok(flow.includes(connectionMessage), 'native flow must check the connection-failure message');
  assert.match(flow, /id: login-submit\n    text: "دخول"\n    enabled: true/);
  assert.match(flow, /assertNotVisible: "Network request failed"/);
  assert.match(flow, /assertNotVisible: "ECONNREFUSED"/);
  assert.match(flow, /assertNotVisible: "TypeError"/);
  assert.match(flow, /assertNotVisible: "fetch failed"/);
});
