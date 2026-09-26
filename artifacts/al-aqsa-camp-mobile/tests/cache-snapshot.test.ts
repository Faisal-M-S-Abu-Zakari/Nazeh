import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { preserveSnapshotIdentity } from '../context/cacheSnapshot';

const appContextSource = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
const taskFormSource = readFileSync(new URL('../app/task-form.tsx', import.meta.url), 'utf8');

test('a successfully synchronized team snapshot keeps the same state reference on repeated saves', () => {
  const emptySnapshot = { people: [], tasks: [], lastPeopleSyncAt: null };
  const localSnapshot = {
    people: [{ id: 'person-1', fullName: 'أسرة الفريق', version: 2 }],
    tasks: [{ id: 'task-1', title: 'تفقد البوابة', version: 3 }],
    lastPeopleSyncAt: '2026-09-26T10:00:00.000Z',
  };
  const serverSnapshot = JSON.parse(JSON.stringify(localSnapshot)) as typeof localSnapshot;
  const updatedSnapshot = { ...localSnapshot, tasks: [{ ...localSnapshot.tasks[0], version: 4 }] };

  const firstServerLoad = preserveSnapshotIdentity(emptySnapshot, serverSnapshot);
  assert.notStrictEqual(firstServerLoad, emptySnapshot);
  const repeatedServerSnapshot = JSON.parse(JSON.stringify(serverSnapshot)) as typeof localSnapshot;
  assert.strictEqual(preserveSnapshotIdentity(firstServerLoad, repeatedServerSnapshot), firstServerLoad);
  assert.notStrictEqual(preserveSnapshotIdentity(firstServerLoad, updatedSnapshot), firstServerLoad);
});

test('the AppContext sync effect avoids unchanged state updates and remains owner-scoped', () => {
  assert.ok(appContextSource.includes(
    'setCache((current) => preserveSnapshotIdentity(current, { ...next, lastPeopleSyncAt }));',
  ));
  assert.ok(appContextSource.includes(
    'if (!user || ownerUserId !== user.id || activeOwner.current !== user.id || !protectedHydrated',
  ));
  assert.ok(appContextSource.includes('AsyncStorage.setItem(cacheStorageKey(user.id),'));
  assert.ok(appContextSource.includes('tasksQuery.data, user?.id]'));
  assert.ok(taskFormSource.includes('const task = tasks.find((item) => item.id === id) ?? tasksQuery.data?.find((item) => item.id === id);'));
});