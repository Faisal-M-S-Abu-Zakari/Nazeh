import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);

test('task result and approval screens keep native font scaling and vertical reachability', () => {
  const screen = readFileSync(new URL('app/task-form.tsx', mobileRoot), 'utf8');
  const textNodes = [...screen.matchAll(/<Text\b[^>]*>/g)].map(([openingTag]) => openingTag);

  assert.ok(textNodes.length > 0);
  for (const openingTag of textNodes) {
    assert.match(openingTag, /\ballowFontScaling\b/, `Text node does not explicitly support system scaling: ${openingTag}`);
  }

  assert.match(screen, /<KeyboardAwareScrollViewCompat testID="task-form-scroll"/);
  assert.match(screen, /<Field testID="task-result-input" label="النتيجة"/);
  assert.match(screen, /<Field testID="task-approval-note" label="ملاحظة الاعتماد \(اختياري\)"/);
  assert.match(screen, /<PrimaryButton\s+testID="submit-task-result"/);
  assert.match(screen, /<PrimaryButton\s+testID="approve-task-result"/);
  assert.match(screen, /options: \{ flexDirection: 'row-reverse', flexWrap: 'wrap'/);
});