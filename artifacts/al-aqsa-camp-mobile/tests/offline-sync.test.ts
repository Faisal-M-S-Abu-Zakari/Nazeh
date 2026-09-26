import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cacheStorageKey,
  createMobileAuthLifecycle,
  loadOwnerStorage,
  queueStorageKey,
  readOwnerQueue,
  replayOwnerQueue,
} from '../context/offlineSync';

type Write = { id: string; ownerUserId: string; value: string };

test('cached records and queued writes are isolated by stable owner keys', () => {
  assert.notEqual(cacheStorageKey('account-a'), cacheStorageKey('account-b'));
  assert.notEqual(queueStorageKey('account-a'), queueStorageKey('account-b'));
  const mixed = JSON.stringify([
    { id: 'a-write', ownerUserId: 'account-a', value: 'private-a' },
    { id: 'b-write', ownerUserId: 'account-b', value: 'private-b' },
  ]);
  assert.deepEqual(readOwnerQueue<Write>(mixed, 'account-a').map((item) => item.value), ['private-a']);
  assert.deepEqual(readOwnerQueue<Write>(mixed, 'account-b').map((item) => item.value), ['private-b']);
});

test('account hydration reads only that account cache and queued writes', async () => {
  const storage = new Map<string, string>([
    [cacheStorageKey('account-a'), JSON.stringify({ people: ['private-a'] })],
    [cacheStorageKey('account-b'), JSON.stringify({ people: ['private-b'] })],
    [queueStorageKey('account-a'), JSON.stringify([
      { id: 'a-write', ownerUserId: 'account-a', value: 'private-a' },
      { id: 'foreign-write', ownerUserId: 'account-b', value: 'must-not-cross' },
    ])],
    [queueStorageKey('account-b'), JSON.stringify([
      { id: 'b-write', ownerUserId: 'account-b', value: 'private-b' },
    ])],
  ]);
  const getItem = async (key: string) => storage.get(key) ?? null;

  const accountA = await loadOwnerStorage<{ people: string[] }, Write>('account-a', getItem);
  const accountB = await loadOwnerStorage<{ people: string[] }, Write>('account-b', getItem);

  assert.deepEqual(accountA.cache?.people, ['private-a']);
  assert.deepEqual(accountA.queue.map((item) => item.id), ['a-write']);
  assert.deepEqual(accountB.cache?.people, ['private-b']);
  assert.deepEqual(accountB.queue.map((item) => item.id), ['b-write']);
});

test('last successful aid sync time survives reload without crossing account caches', async () => {
  const accountATime = '2026-09-23T08:15:00.000Z';
  const accountBTime = '2026-09-23T09:45:00.000Z';
  const storage = new Map<string, string>([
    [cacheStorageKey('account-a'), JSON.stringify({ aids: ['private-a'], lastAidsSyncAt: accountATime })],
    [cacheStorageKey('account-b'), JSON.stringify({ aids: ['private-b'], lastAidsSyncAt: accountBTime })],
  ]);
  const getItem = async (key: string) => storage.get(key) ?? null;

  const accountAAfterReload = await loadOwnerStorage<{ aids: string[]; lastAidsSyncAt?: string | null }, Write>('account-a', getItem);
  const accountBAfterReload = await loadOwnerStorage<{ aids: string[]; lastAidsSyncAt?: string | null }, Write>('account-b', getItem);

  assert.equal(accountAAfterReload.cache?.lastAidsSyncAt, accountATime);
  assert.equal(accountBAfterReload.cache?.lastAidsSyncAt, accountBTime);
  assert.notEqual(accountAAfterReload.cache?.lastAidsSyncAt, accountBAfterReload.cache?.lastAidsSyncAt);
});

test('received family aid snapshots, including an empty history, stay with their owner after reload', async () => {
  const updatedAt = '2026-09-24T08:15:00.000Z';
  type Snapshot = { receivedAids: Array<{ id: string; title: string }>; lastReceivedAidsSyncAt: string };
  const storage = new Map<string, string>([
    [cacheStorageKey('family-a'), JSON.stringify({ receivedAids: [{ id: 'aid-a', title: 'طرد غذائي' }], lastReceivedAidsSyncAt: updatedAt })],
    [cacheStorageKey('family-b'), JSON.stringify({ receivedAids: [], lastReceivedAidsSyncAt: updatedAt })],
  ]);
  const getItem = async (key: string) => storage.get(key) ?? null;

  const accountA = await loadOwnerStorage<Snapshot, Write>('family-a', getItem);
  const accountB = await loadOwnerStorage<Snapshot, Write>('family-b', getItem);
  assert.deepEqual(accountA.cache?.receivedAids.map((aid) => aid.id), ['aid-a']);
  assert.deepEqual(accountB.cache?.receivedAids, []);
  assert.equal(accountA.cache?.lastReceivedAidsSyncAt, updatedAt);
  assert.equal(accountB.cache?.lastReceivedAidsSyncAt, updatedAt);
});

test('an in-flight replay is cancelled without touching the next account queue', async () => {
  const controller = new AbortController();
  let activeOwner = 'account-a';
  let releaseRequest!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  let unblock!: () => void;
  const blocked = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const persisted: Array<{ owner: string; ids: string[] }> = [];

  const replay = replayOwnerQueue<Write>({
    ownerUserId: 'account-a',
    items: [
      { id: 'a-write', ownerUserId: 'account-a', value: 'private-a' },
      { id: 'b-write', ownerUserId: 'account-b', value: 'private-b' },
    ],
    signal: controller.signal,
    isCurrent: () => activeOwner === 'account-a',
    execute: async () => {
      releaseRequest();
      await blocked;
    },
    persist: async (owner, remaining) => {
      persisted.push({ owner, ids: remaining.map((item) => item.id) });
    },
  });

  await requestStarted;
  activeOwner = 'account-b';
  controller.abort();
  unblock();
  const remaining = await replay;

  assert.deepEqual(remaining.map((item) => item.id), ['a-write']);
  assert.deepEqual(persisted, []);
  assert.deepEqual(
    readOwnerQueue<Write>(
      JSON.stringify([{ id: 'b-write', ownerUserId: 'account-b', value: 'private-b' }]),
      activeOwner,
    ).map((item) => item.id),
    ['b-write'],
  );
});

test('a task changed by another account after reconnection is shown for review and never replayed again', async () => {
  type TaskWrite = {
    id: string;
    ownerUserId: string;
    kind: 'task';
    targetId: string;
    status: 'IN_PROGRESS';
    expectedVersion: number;
    conflict?: { refreshed: boolean; title: string | null; status: string | null; version: number | null };
  };
  const queued: TaskWrite = {
    id: 'offline-task-update',
    ownerUserId: 'staff-a',
    kind: 'task',
    targetId: 'task-1',
    status: 'IN_PROGRESS',
    expectedVersion: 1,
  };
  let serverTask = { title: 'تفقد البوابة', status: 'PENDING', version: 1 };
  let replayAttempts = 0;
  let latestTaskRefreshes = 0;
  let persisted: TaskWrite[] = [queued];
  const updateFromAnotherAccount = (ownerUserId: string) => {
    assert.equal(ownerUserId, 'staff-b');
    serverTask = { ...serverTask, status: 'COMPLETED', version: 2 };
  };
  const replay = (items: TaskWrite[]) => replayOwnerQueue<TaskWrite>({
    ownerUserId: 'staff-a',
    items,
    signal: new AbortController().signal,
    isCurrent: () => true,
    execute: async (item) => {
      replayAttempts += 1;
      if (item.expectedVersion !== serverTask.version) {
        throw Object.assign(new Error('conflict'), {
          status: 409,
          data: { code: 'VERSION_CONFLICT' },
        });
      }
      serverTask = { ...serverTask, status: item.status, version: serverTask.version + 1 };
    },
    isConflict: (item, error) => item.kind === 'task' &&
      typeof error === 'object' && error !== null &&
      'status' in error && error.status === 409 &&
      'data' in error && typeof error.data === 'object' && error.data !== null &&
      'code' in error.data && error.data.code === 'VERSION_CONFLICT',
    markConflict: async (item) => {
      latestTaskRefreshes += 1;
      return {
        ...item,
        conflict: {
          refreshed: true,
          title: serverTask.title,
          status: serverTask.status,
          version: serverTask.version,
        },
      };
    },
    isBlocked: (item) => !!item.conflict,
    persist: async (_owner, remaining) => { persisted = remaining; },
  });

  updateFromAnotherAccount('staff-b');
  const firstReplay = await replay([queued]);
  assert.equal(serverTask.status, 'COMPLETED');
  assert.equal(serverTask.version, 2);
  assert.equal(firstReplay[0]?.conflict?.title, 'تفقد البوابة');
  assert.equal(firstReplay[0]?.conflict?.status, 'COMPLETED');
  assert.equal(firstReplay[0]?.conflict?.version, 2);
  assert.deepEqual(persisted.map((item) => item.id), ['offline-task-update']);

  const restoredQueue = readOwnerQueue<TaskWrite>(JSON.stringify(persisted), 'staff-a');
  await replay(restoredQueue);
  assert.equal(replayAttempts, 1);
  assert.equal(latestTaskRefreshes, 1);
  assert.equal(serverTask.status, 'COMPLETED');
});

test('permission and connection failures stay queued without being labeled as version conflicts', async () => {
  const queued: Write = { id: 'pending', ownerUserId: 'staff-a', value: 'task update' };
  for (const failure of [
    Object.assign(new Error('forbidden'), { status: 403 }),
    new TypeError('network unavailable'),
  ]) {
    let conflictMarked = false;
    let persisted: Write[] = [queued];
    await assert.rejects(
      replayOwnerQueue<Write>({
        ownerUserId: 'staff-a',
        items: [queued],
        signal: new AbortController().signal,
        isCurrent: () => true,
        execute: async () => { throw failure; },
        isConflict: (_item, error) =>
          typeof error === 'object' && error !== null &&
          'status' in error && error.status === 409,
        markConflict: async (item) => {
          conflictMarked = true;
          return item;
        },
        persist: async (_owner, remaining) => { persisted = remaining; },
      }),
      failure,
    );
    assert.equal(conflictMarked, false);
    assert.deepEqual(persisted, [queued]);
  }
});

test('Expo login, reload, synchronized refresh and logout use the same token store', async () => {
  let persisted: string | null = null;
  const makeLifecycle = () => createMobileAuthLifecycle({
    get: async () => persisted,
    set: async (token) => { persisted = token; },
    remove: async () => { persisted = null; },
  });
  const firstLaunch = makeLifecycle();
  await firstLaunch.login('expo-token');
  assert.equal(persisted, 'expo-token');

  const reloaded = makeLifecycle();
  assert.equal(await reloaded.restore(), 'expo-token');
  let refreshes = 0;
  assert.equal(await reloaded.synchronizedRefresh(async () => { refreshes += 1; }), true);
  assert.equal(refreshes, 1);

  await reloaded.logout();
  assert.equal(persisted, null);
  assert.equal(await reloaded.synchronizedRefresh(async () => { refreshes += 1; }), false);
  assert.equal(refreshes, 1);
});