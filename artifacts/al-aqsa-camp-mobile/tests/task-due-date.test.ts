import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatTaskDueAt } from '../lib/formatTaskDueAt';
import {
  getTaskDueAtForUpdate,
  getTaskDueDateInputValue,
  parseTaskDueDate,
} from '../lib/taskDueDate';

const taskFormSource = readFileSync(new URL('../app/task-form.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('../app/(tabs)/alerts.tsx', import.meta.url), 'utf8');

test('an empty optional task due date is sent as null', () => {
  assert.deepEqual(parseTaskDueDate(''), { valid: true, value: null });
  assert.deepEqual(parseTaskDueDate('   '), { valid: true, value: null });
});

test('editing a task sends a cleared due date and displays it as empty after reload', () => {
  assert.match(taskFormSource, /dueAt: due/);
  assert.match(taskFormSource, /useState\(getTaskDueDateInputValue\(task\?\.dueAt\)\)/);
  assert.match(taskFormSource, /testID="task-due-date"[^>]*value=\{dueAt\}/);
  assert.deepEqual(getTaskDueAtForUpdate('', '2026-08-28T00:30:00.000Z'), {
    valid: true,
    value: null,
  });
});

test('a valid date-only task due date is normalized to ISO UTC', () => {
  assert.deepEqual(parseTaskDueDate('2026-08-28'), {
    valid: true,
    value: '2026-08-28T00:00:00.000Z',
  });
  assert.equal(parseTaskDueDate('2024-02-29').valid, true);
});

test('a mobile-entered deadline stays on the selected local calendar day', () => {
  const originalTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const parsed = parseTaskDueDate('2026-08-28');
    assert.deepEqual(parsed, {
      valid: true,
      value: '2026-08-28T07:00:00.000Z',
    });
    if (parsed.valid) {
      const localDate = new Date(parsed.value);
      assert.equal(localDate.getFullYear(), 2026);
      assert.equal(localDate.getMonth(), 7);
      assert.equal(localDate.getDate(), 28);
      assert.equal(localDate.getHours(), 0);
      assert.notEqual(
        formatTaskDueAt(parsed.value, 'America/Los_Angeles'),
        formatTaskDueAt(parsed.value, 'Asia/Tokyo'),
      );
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('task deadlines display the same instant in local date and time across time zones', () => {
  const instant = '2026-08-28T00:30:00.000Z';
  const losAngeles = formatTaskDueAt(instant, 'America/Los_Angeles');
  const tokyo = formatTaskDueAt(instant, 'Asia/Tokyo');

  assert.notEqual(losAngeles, tokyo);
  assert.match(losAngeles, /٢٧/);
  assert.match(tokyo, /٢٨/);
  assert.match(losAngeles, /٠٥:٣٠|١٧:٣٠/);
  assert.match(tokyo, /٠٩:٣٠/);
});

test('editing other task fields preserves the original dueAt instant', () => {
  const dueAt = '2026-08-28T00:30:00.000Z';
  const originalTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const localDate = getTaskDueDateInputValue(dueAt);
    assert.equal(localDate, '2026-08-27');
    assert.deepEqual(getTaskDueAtForUpdate(localDate, dueAt), {
      valid: true,
      value: dueAt,
    });
    assert.deepEqual(getTaskDueAtForUpdate('2026-08-28', dueAt), {
      valid: true,
      value: '2026-08-28T07:00:00.000Z',
    });
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('invalid, impossible, and localized task due dates are rejected before sending', () => {
  for (const value of ['2026-02-29', '2026-13-01', '28/08/2026', 'today', '2026-8-2']) {
    assert.deepEqual(parseTaskDueDate(value), { valid: false }, value);
  }
});

test('task creation uses the strict date parser and displays a clear validation message', () => {
  assert.match(taskFormSource, /const parsedDueAt = parseTaskDueDate\(dueAt\)/);
  assert.match(taskFormSource, /dueAt: due/);
  assert.match(taskFormSource, /task-due-date-error/);
  assert.doesNotMatch(taskFormSource, /new Date\(dueAt\)\.toISOString\(\)/);
  assert.match(taskFormSource, /getTaskDueAtForUpdate\(dueAt, task\.dueAt\)/);
});

test('mobile task list and details show the local deadline date and time', () => {
  assert.match(alertsSource, /formatTaskDueAt\(task\.dueAt\)/);
  assert.match(alertsSource, /testID=\{`task-due-at-\$\{task\.id\}`\}/);
  assert.match(taskFormSource, /formatTaskDueAt\(task\.dueAt\)/);
  assert.match(taskFormSource, /testID="task-due-at"/);
});

test('a synchronized task creation announces success in the native app', () => {
  assert.match(
    taskFormSource,
    /Alert\.alert\(result\.queued \? 'بانتظار المزامنة' : 'تم إنشاء المهمة', result\.queued \? 'حُفظت المهمة على الجهاز وستُرسل عند عودة الاتصال\.' : 'تمت مزامنة المهمة مع الفريق\.'\)/,
  );
});
