import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatTaskDueAt } from './formatTaskDueAt';

const tasksSection = readFileSync(new URL('../components/actors/workspace/sections/tasks-section.tsx', import.meta.url), 'utf8');

test('task deadlines display the same instant in local date and time across time zones', () => {
  const instant = '2026-08-28T00:30:00.000Z';
  const losAngeles = formatTaskDueAt(instant, 'America/Los_Angeles');
  const tokyo = formatTaskDueAt(instant, 'Asia/Tokyo');

  assert.notEqual(losAngeles, tokyo);
  assert.equal(
    losAngeles,
    new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
      timeZone: 'America/Los_Angeles',
    }).format(new Date(instant)),
  );
  assert.equal(
    tokyo,
    new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
      timeZone: 'Asia/Tokyo',
    }).format(new Date(instant)),
  );
});

test('the web task list and detail both format the API dueAt as local date and time', () => {
  assert.equal((tasksSection.match(/formatTaskDueAt\(task\.dueAt\)/g) ?? []).length, 2);
  assert.match(tasksSection, /import \{ formatTaskDueAt \} from '@\/utils\/formatTaskDueAt'/);
});
