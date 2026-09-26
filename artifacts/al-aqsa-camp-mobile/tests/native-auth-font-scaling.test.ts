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
  assert.match(otp, /<Text allowFontScaling style=\{\[styles\.hint/);
  assert.match(otp, /<Text allowFontScaling accessibilityRole="alert"/);

  const ui = source('components/ui.tsx');

  const login = source('app/auth/login.tsx');

  assert.match(login, /<KeyboardAwareScrollViewCompat contentContainerStyle=\{styles\.content\}/);
  assert.match(login, /<Text allowFontScaling style=\{\[styles\.title/);
  assert.match(login, /<Text allowFontScaling style=\{\[styles\.copy/);
  assert.match(login, /login-account-family" accessibilityRole="button" accessibilityLabel="رب الأسرة" accessibilityState=\{\{ selected: accountType === 'family' \}\}/);
  assert.match(login, /login-account-staff" accessibilityRole="button" accessibilityLabel="فريق المخيم" accessibilityState=\{\{ selected: accountType === 'staff' \}\}/);
  assert.match(login, /<Field testID="login-email" label="البريد الإلكتروني"/);
  assert.match(login, /<Field testID="login-password" label="كلمة المرور"/);
  assert.match(login, /testID="forgot-password-link" accessibilityRole="button" accessibilityLabel="نسيت كلمة المرور؟"/);
  assert.match(login, /testID="complete-invite-link" accessibilityRole="button" accessibilityLabel="لديّ رمز دعوة أو استعادة"/);
  assert.match(ui, /accessibilityLabel=\{label\}/);
  assert.match(ui, /<Text allowFontScaling style=\{\[styles\.buttonText/);
  assert.match(ui, /allowFontScaling\s+accessibilityLabel=\{props\.accessibilityLabel \?\? label\}/);
});
