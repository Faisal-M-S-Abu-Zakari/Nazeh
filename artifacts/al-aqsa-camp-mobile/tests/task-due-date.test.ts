import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseTaskDueDate } from '../lib/taskDueDate';

const taskFormSource = readFileSync(new URL('../app/task-form.tsx', import.meta.url), 'utf8');

test('an empty optional task due date is sent as null', () => {
  assert.deepEqual(parseTaskDueDate(''), { valid: true, value: null });
  assert.deepEqual(parseTaskDueDate('   '), { valid: true, value: null });
});

test('a valid date-only task due date is normalized to ISO UTC', () => {
  assert.deepEqual(parseTaskDueDate('2026-08-28'), {
    valid: true,
    value: '2026-08-28T00:00:00.000Z',
  });
  assert.equal(parseTaskDueDate('2024-02-29').valid, true);
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
});
