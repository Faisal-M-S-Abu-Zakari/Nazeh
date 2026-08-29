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