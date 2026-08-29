export type OwnerScopedWrite = { id: string; ownerUserId: string };
export type AsyncTokenStore = {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
  remove: () => Promise<void>;
};

export const cacheStorageKey = (ownerUserId: string) => `al-aqsa-read-cache-v2:${ownerUserId}`;
export const queueStorageKey = (ownerUserId: string) => `al-aqsa-write-queue-v2:${ownerUserId}`;

/** Testable lifecycle shared by native SecureStore and Expo web sessionStorage. */
export function createMobileAuthLifecycle(store: AsyncTokenStore) {
  let currentToken: string | null = null;
  return {
    restore: async () => {
      currentToken = await store.get();
      return currentToken;
    },
    login: async (token: string) => {
      await store.set(token);
      currentToken = token;
    },
    logout: async () => {
      await store.remove();
      currentToken = null;
    },
    synchronizedRefresh: async (refresh: () => Promise<void>) => {
      if (!currentToken) return false;
      await refresh();
      return true;
    },
  };
}

export function readOwnerQueue<T extends OwnerScopedWrite>(
  serialized: string | null,
  ownerUserId: string,
): T[] {
  if (!serialized) return [];
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) throw new Error('Invalid offline queue');
  return parsed.filter(
    (item): item is T =>
      typeof item === 'object' &&
      item !== null &&
      'ownerUserId' in item &&
      item.ownerUserId === ownerUserId,
  );
}

export async function loadOwnerStorage<C, T extends OwnerScopedWrite>(
  ownerUserId: string,
  getItem: (key: string) => Promise<string | null>,
): Promise<{ cache: C | null; queue: T[] }> {
  const [serializedCache, serializedQueue] = await Promise.all([
    getItem(cacheStorageKey(ownerUserId)),
    getItem(queueStorageKey(ownerUserId)),
  ]);
  return {
    cache: serializedCache ? JSON.parse(serializedCache) as C : null,
    queue: readOwnerQueue<T>(serializedQueue, ownerUserId),
  };
}

type ReplayOptions<T extends OwnerScopedWrite> = {
  ownerUserId: string;
  items: readonly T[];
  signal: AbortSignal;
  isCurrent: () => boolean;
  execute: (item: T, signal: AbortSignal) => Promise<void>;
  persist: (ownerUserId: string, remaining: T[]) => Promise<void>;
};

/**
 * Replays only one owner's writes. Every continuation rechecks identity so an
 * account switch while a request is in flight cannot remove or replay writes
 * in the newly active account's queue.
 */
export async function replayOwnerQueue<T extends OwnerScopedWrite>({
  ownerUserId,
  items,
  signal,
  isCurrent,
  execute,
  persist,
}: ReplayOptions<T>): Promise<T[]> {
  const remaining = items.filter((item) => item.ownerUserId === ownerUserId);
  for (const item of [...remaining]) {
    if (signal.aborted || !isCurrent()) break;
    await execute(item, signal);
    if (signal.aborted || !isCurrent()) break;
    const index = remaining.findIndex((entry) => entry.id === item.id);
    if (index >= 0) remaining.splice(index, 1);
    await persist(ownerUserId, [...remaining]);
  }
  return remaining;
}