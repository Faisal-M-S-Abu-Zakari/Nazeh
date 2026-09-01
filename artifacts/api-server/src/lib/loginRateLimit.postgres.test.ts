import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db, loginRateLimitCounters } from "@workspace/db";
import {
  createLoginRateLimit,
  createPostgresLoginRateLimitStore,
  MAX_FAILURES,
} from "./loginRateLimit";

test("PostgreSQL counters remain shared across independent service instances", async () => {
  const suffix = randomUUID();
  const keys = [`task28:ip:${suffix}`, `task28:account:${suffix}`];
  const serviceA = createLoginRateLimit(createPostgresLoginRateLimitStore(db));
  const serviceB = createLoginRateLimit(createPostgresLoginRateLimitStore(db));
  const now = Date.now();

  try {
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      const service = i % 2 === 0 ? serviceA : serviceB;
      await service.failure(keys, now + i);
    }

    const blocked = await serviceA.check(keys, now + MAX_FAILURES);
    assert.equal(blocked.allowed, false);

    const counters = await db
      .select({
        key: loginRateLimitCounters.key,
        failures: loginRateLimitCounters.failures,
      })
      .from(loginRateLimitCounters)
      .where(inArray(loginRateLimitCounters.key, keys));
    assert.deepEqual(
      counters.sort((a, b) => a.key.localeCompare(b.key)).map((counter) => counter.failures),
      [MAX_FAILURES, MAX_FAILURES],
    );
  } finally {
    await db.delete(loginRateLimitCounters).where(inArray(loginRateLimitCounters.key, keys));
  }
});

test("PostgreSQL success clears only the requested login counters", async () => {
  const suffix = randomUUID();
  const keys = [`task28:ip:${suffix}`, `task28:account:${suffix}`];
  const otherKey = `task28:other:${suffix}`;
  const limiter = createLoginRateLimit(createPostgresLoginRateLimitStore(db));

  try {
    await limiter.failure([...keys, otherKey], Date.now());
    await limiter.success(keys);

    const remaining = await db
      .select({ key: loginRateLimitCounters.key })
      .from(loginRateLimitCounters)
      .where(inArray(loginRateLimitCounters.key, [...keys, otherKey]));
    assert.deepEqual(remaining.map((counter) => counter.key), [otherKey]);
  } finally {
    await db.delete(loginRateLimitCounters).where(eq(loginRateLimitCounters.key, otherKey));
    await db.delete(loginRateLimitCounters).where(inArray(loginRateLimitCounters.key, keys));
  }
});