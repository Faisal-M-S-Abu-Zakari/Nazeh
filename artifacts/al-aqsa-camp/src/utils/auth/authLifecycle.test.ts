import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthLifecycle } from './authLifecycle';

test('web login, reload, synchronized refresh, 401 and logout share one lifecycle', async () => {
  let storedToken: string | null = null;
  let cacheEntries = ['previous-account'];
  const navigations: string[] = [];
  const lifecycle = createAuthLifecycle({
    getToken: () => storedToken,
    setToken: (token) => { storedToken = token; },
    clearToken: () => { storedToken = null; },
    clearQueries: () => { cacheEntries = []; },
    navigate: (path) => { navigations.push(path); },
  });

  lifecycle.login('token-a', '/manager');
  assert.equal(storedToken, 'token-a');
  assert.deepEqual(cacheEntries, []);
  assert.equal(lifecycle.restore(), 'token-a', 'reload restores the tab-scoped token');

  let refreshes = 0;
  assert.equal(await lifecycle.synchronizedRefresh(async () => { refreshes += 1; }), true);
  assert.equal(refreshes, 1);

  cacheEntries = ['private-a'];
  lifecycle.unauthorized('/manager', '/auth/login');
  assert.equal(storedToken, null);
  assert.deepEqual(cacheEntries, [], '/auth/me 401 clears private React Query data');
  assert.equal(navigations.at(-1), '/auth/login');
  assert.equal(await lifecycle.synchronizedRefresh(async () => { refreshes += 1; }), false);

  storedToken = 'token-b';
  cacheEntries = ['private-b'];
  lifecycle.logout('/auth/login');
  assert.equal(storedToken, null);
  assert.deepEqual(cacheEntries, []);
  assert.equal(navigations.at(-1), '/auth/login');
});