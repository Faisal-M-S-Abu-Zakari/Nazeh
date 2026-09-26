import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, mobileRoot), 'utf8');

test('dashboard and operations text support system scaling without fixed-height line clipping', () => {
  const dashboard = source('components/HomeDashboard.tsx');
  const operations = source('app/(tabs)/operations.tsx');
  const sharedUi = source('components/ui.tsx');
  const tabLayout = source('app/(tabs)/_layout.tsx');

  for (const [name, screen] of [['dashboard', dashboard], ['operations', operations], ['shared operation UI', sharedUi], ['tab navigation', tabLayout]] as const) {
    const textNodes = [...screen.matchAll(/<Text\b[^>]*>/g)].map(([openingTag]) => openingTag);
    assert.ok(textNodes.length > 0, `${name} should render text`);
    for (const openingTag of textNodes) {
      assert.match(openingTag, /\ballowFontScaling\b/, `${name} text must scale with system settings: ${openingTag}`);
    }
  }

  assert.doesNotMatch(dashboard, /lineHeight:/, 'dashboard text should use natural line height at large accessibility sizes');
  assert.doesNotMatch(operations, /lineHeight:/, 'campaign rows should grow with enlarged text');
  assert.doesNotMatch(dashboard, /numberOfLines=\{4\}/, 'announcement copy should not be silently truncated on the dashboard');
  assert.match(sharedUi, /const \{ width, fontScale \} = useWindowDimensions\(\)/);
  assert.match(sharedUi, /const expanded = width <= 340 \|\| fontScale >= 1\.5/);
  assert.match(sharedUi, /const expanded = width <= 340 \|\| fontScale >= 1\.5/);
  assert.match(sharedUi, /<View style=\{styles\.expandedHeaderTop\}>/);
  assert.match(sharedUi, /styles\.expandedHeaderText/);
  assert.match(tabLayout, /numberOfLines=\{expandedLabels \? 2 : 1\}/);
  assert.doesNotMatch(tabLayout, /label: \{[^}]*lineHeight:/);
});

test('dashboard and operations primary actions expose useful screen-reader names and button roles', () => {
  const dashboard = source('components/HomeDashboard.tsx');
  const operations = source('app/(tabs)/operations.tsx');
  const sharedUi = source('components/ui.tsx');

  assert.match(dashboard, /accessibilityRole="button" accessibilityLabel="دخول الفريق أو رب الأسرة"/);
  assert.match(dashboard, /testID="home-queue-notice" accessibilityRole="button" accessibilityLabel=\{/);
  assert.match(dashboard, /testID="home-staff-alert" accessibilityRole="button" accessibilityLabel=\{/);
  assert.match(dashboard, /accessibilityRole="text"[\s\S]*?accessibilityLabel=\{`\$\{value\.toLocaleString\('ar'\)\}/);
  assert.match(operations, /testID="add-aid"[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel="إضافة مساعدة"/);
  assert.match(operations, /testID=\{`open-aid-\$\{aid\.id\}`\}[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel=\{`\$\{aid\.title\}/);
  assert.match(sharedUi, /accessibilityRole="header"/);
});