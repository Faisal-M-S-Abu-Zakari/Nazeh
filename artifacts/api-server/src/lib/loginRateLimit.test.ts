import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoginRateLimit,
  MAX_FAILURES,
  MemoryLoginRateLimitStore,
  WINDOW_MS,
} from "./loginRateLimit";

test("blocks repeated failures and resets after a successful login", async () => {
  const loginRateLimit = createLoginRateLimit(new MemoryLoginRateLimitStore());
  const keys = ["test-ip", "test-account"];
  const start = 1_000_000;
  for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
    await loginRateLimit.failure(keys, start + i);
    assert.equal((await loginRateLimit.check(keys, start + i)).allowed, true);
  }
  await loginRateLimit.failure(keys, start + MAX_FAILURES - 1);
  const blocked = await loginRateLimit.check(keys, start + MAX_FAILURES);
  assert.equal(blocked.allowed, false);
  assert(blocked.retryAfterSeconds > 0);

  await loginRateLimit.success(keys);
  assert.equal((await loginRateLimit.check(keys, start + 6)).allowed, true);
});

test("a blocked account remains blocked when failures move between service instances", async () => {
  const sharedStore = new MemoryLoginRateLimitStore();
  const serviceA = createLoginRateLimit(sharedStore);
  const serviceB = createLoginRateLimit(sharedStore);
  const keys = ["login:ip:203.0.113.10", "login:account:family@example.test"];
  const start = 2_000_000;

  for (let i = 0; i < MAX_FAILURES; i += 1) {
    const service = i % 2 === 0 ? serviceA : serviceB;
    await service.failure(keys, start + i);
  }

  const blocked = await serviceA.check(keys, start + MAX_FAILURES);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, Math.ceil((WINDOW_MS - MAX_FAILURES) / 1000));
});

test("expired counters are automatically allowed and start a fresh window", async () => {
  const loginRateLimit = createLoginRateLimit(new MemoryLoginRateLimitStore());
  const keys = ["test-ip-expiry", "test-account-expiry"];
  const start = 3_000_000;

  for (let i = 0; i < MAX_FAILURES; i += 1) {
    await loginRateLimit.failure(keys, start + i);
  }
  const afterExpiry = start + WINDOW_MS + MAX_FAILURES + 1;
  assert.equal((await loginRateLimit.check(keys, afterExpiry)).allowed, true);
  await loginRateLimit.failure(keys, afterExpiry);
  assert.equal((await loginRateLimit.check(keys, afterExpiry)).allowed, true);
});