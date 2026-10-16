import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, mobileRoot), 'utf8');

const screens = [
  ['person/[id].tsx', 'person'],
  ['complaint-form.tsx', 'complaint'],
  ['task-form.tsx', 'task'],
] as const;

test('staff record forms show a safe inline save error with a retry action', () => {
  for (const [path, testIDPrefix] of screens) {
    const screen = source(`app/${path}`);

    assert.match(screen, /getMutationErrorMessage/);
    assert.match(screen, /setSaveError\(getMutationErrorMessage\(error\)\)/);
    assert.match(screen, new RegExp(`testID="${testIDPrefix}-save-error"`));
    assert.match(screen, new RegExp(`testID="${testIDPrefix}-save-error-message"`));
    assert.match(screen, new RegExp(`testID="${testIDPrefix}-save-error-retry"`));
    assert.match(screen, /label="إعادة المحاولة"/);
    assert.match(screen, /accessibilityRole="alert"/);
  }
});

test('task result submission and approval show separate inline errors with retries', () => {
  const screen = source('app/task-form.tsx');

  for (const [action, testIDPrefix] of [
    ['result', 'task-result'],
    ['approval', 'task-approval'],
  ] as const) {
    assert.match(
      screen,
      new RegExp(`handleTaskActionFailure\\(error, '${action}', expectedVersion\\)`),
    );
    assert.match(screen, new RegExp(`renderTaskActionError\\('${action}', '${testIDPrefix}'`));
    assert.match(screen, /testID=\{`\$\{testIDPrefix\}-error-retry`\}/);
    assert.match(screen, /review-update/);
    assert.match(screen, /refresh-current/);
  }
  assert.match(screen, /setResultText\(value\)/);
  assert.match(screen, /setApprovalNote\(value\)/);
  assert.match(screen, /taskActionError\?\.conflict/);
});

test('inline save errors stay safe and readable in narrow mobile layouts', () => {
  for (const [path] of screens) {
    const screen = source(`app/${path}`);

    assert.match(screen, /saveErrorMessage: \{[^}]*textAlign: 'right'[^}]*flexShrink: 1/);
    assert.match(screen, /saveError: \{[^}]*borderWidth: 1[^}]*padding: 12[^}]*gap: 10/);
    assert.doesNotMatch(screen, /error(?:\?|)\.(?:message|response|body)/);
  }
});

test('mutation error messages never expose a raw server response', () => {
  const mutationErrors = source('lib/mutationErrors.ts');

  assert.match(mutationErrors, /return genericMutationMessage/);
  assert.doesNotMatch(mutationErrors, /error\.message/);
  assert.doesNotMatch(mutationErrors, /JSON\.stringify/);
});

test('family archive explains an already archived response and refreshes family state', () => {
  const familyScreen = source('app/family/[id].tsx');

  assert.match(familyScreen, /payload\.code === 'FAMILY_ALREADY_ARCHIVED'/);
  assert.match(familyScreen, /هذه الأسرة مؤرشفة بالفعل، ولا حاجة إلى أرشفتها مرة أخرى/);
  assert.match(familyScreen, /const alreadyArchived = isFamilyAlreadyArchived\(error\)/);
  assert.match(familyScreen, /if \(alreadyArchived \|\| getErrorStatus\(error\) === 409\)/);
  assert.match(familyScreen, /await refreshFamilyData\(\)/);
  assert.match(familyScreen, /alreadyArchived\s*\?\s*'الأسرة مؤرشفة بالفعل'/);
  assert.match(familyScreen, /: getErrorStatus\(error\) === 409\s*\?\s*'تعارض في تحديث العائلة'/);
});

test('offline task conflicts require a latest-state review instead of a stale retry', () => {
  const appContext = source('context/AppContext.tsx');
  const accountScreen = source('app/(tabs)/account.tsx');

  assert.match(appContext, /isConflict: \(item, error\) => item\.kind === 'task' && isVersionConflict\(error\)/);
  assert.match(appContext, /isBlocked: \(item\) => item\.kind === 'task' && !!item\.conflict/);
  assert.match(appContext, /status === 401 \|\| status === 403/);
  assert.match(appContext, /status === undefined\) setManualError\('تعذر الاتصال بالخادم/);
  assert.match(accountScreen, /أحدث حالة:/);
  assert.match(accountScreen, /testID=\{`review-pending-task-\$\{item\.id\}`\}/);
  assert.match(accountScreen, /لم يُعَد إرسال التغيير القديم/);
});