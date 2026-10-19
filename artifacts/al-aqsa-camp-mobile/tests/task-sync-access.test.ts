import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canReadTeamTasks } from '../lib/taskSyncAccess';

const appContextSource = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');

test('only roles authorized by the API request team tasks during sync', () => {
  for (const role of ['ADMIN', 'MANAGER', 'SECURITY_OFFICER', 'SECURITY_MEMBER']) {
    assert.equal(canReadTeamTasks(role), true, `${role} should be able to read team tasks`);
  }

  for (const role of ['DELEGATE', 'DISPLACED', 'unknown', null, undefined]) {
    assert.equal(canReadTeamTasks(role), false, `${String(role)} should not request team tasks`);
  }
});

test('unauthorized task requests are excluded from manual and aggregate sync state', () => {
  assert.match(appContextSource, /enabled: taskSyncEnabled/);
  assert.match(appContextSource, /\.\.\.\(taskSyncEnabled \? \[tasksQuery\.refetch\(\)\] : \[\]\)/);
  assert.match(appContextSource, /\.\.\.\(taskSyncEnabled \? \[tasksQuery\] : \[\]\)/);
});
