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
  assert.match(ui, /accessibilityRole="button"/);
  assert.match(ui, /<Text allowFontScaling style=\{\[styles\.buttonText/);
  assert.match(ui, /<Text allowFontScaling style=\{\[styles\.label/);
  assert.match(ui, /allowFontScaling\s+accessibilityLabel=\{props\.accessibilityLabel \?\? label\}/);
});