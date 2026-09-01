import { sql, type SQL } from "drizzle-orm";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

export type LoginRateLimit = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * The limiter only stores a normalized counter key and timestamps. It never
 * stores passwords, bearer tokens, or session cookies.
 */
export interface LoginRateLimitStore {
  check(keys: string[], now: number): Promise<LoginRateLimit>;
  failure(keys: string[], now: number): Promise<void>;
  success(keys: string[]): Promise<void>;
}

type AttemptBucket = {
  failures: number;
  blockedUntil: number;
  lastAttemptAt: number;
};

/**
 * A small in-memory store for unit tests and single-process consumers. The
 * production routes use the PostgreSQL store below so separate API processes
 * share the same counters.
 */
export class MemoryLoginRateLimitStore implements LoginRateLimitStore {
  private readonly buckets = new Map<string, AttemptBucket>();

  async check(keys: string[], now: number): Promise<LoginRateLimit> {
    this.prune(now);
    const blockedUntil = Math.max(...keys.map((key) => this.buckets.get(key)?.blockedUntil ?? 0));
    return blockedUntil > now
      ? {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      }
      : { allowed: true, retryAfterSeconds: 0 };
  }

  async failure(keys: string[], now: number): Promise<void> {
    this.prune(now);
    for (const key of new Set(keys)) {
      const current = this.buckets.get(key);
      const withinWindow = current && now - current.lastAttemptAt <= WINDOW_MS;
      const failures = (withinWindow ? current.failures : 0) + 1;
      this.buckets.set(key, {
        failures,
        blockedUntil: failures >= MAX_FAILURES ? now + WINDOW_MS : 0,
        lastAttemptAt: now,
      });
    }
  }

  async success(keys: string[]): Promise<void> {
    for (const key of new Set(keys)) this.buckets.delete(key);
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastAttemptAt > WINDOW_MS && bucket.blockedUntil <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

export const createLoginRateLimit = (store: LoginRateLimitStore) => ({
  check(keys: string[], now = Date.now()) {
    return store.check([...new Set(keys)], now);
  },
  failure(keys: string[], now = Date.now()) {
    return store.failure([...new Set(keys)], now);
  },
  success(keys: string[]) {
    return store.success([...new Set(keys)]);
  },
});

type SqlExecutor = {
  execute(query: SQL): Promise<{ rows: unknown[] }>;
};

const asTimestamp = (value: unknown, field: string) => {
  const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ${field} returned by login rate-limit store`);
  }
  return timestamp;
};

/**
 * PostgreSQL-backed store. Failure increments are atomic per key, which means
 * two API processes cannot both read the same counter and overwrite each
 * other's increment.
 */
export const createPostgresLoginRateLimitStore = (executor: SqlExecutor): LoginRateLimitStore => {
  const keyList = (keys: string[]) => sql.join(keys.map((key) => sql`${key}`), sql`, `);

  return {
    async check(keys, now) {
      if (keys.length === 0) return { allowed: true, retryAfterSeconds: 0 };
      const nowDate = new Date(now);
      const keysSql = keyList(keys);
      await executor.execute(sql`
        DELETE FROM "login_rate_limit_counters"
        WHERE "expires_at" <= ${nowDate}
          AND "key" IN (${keysSql})
      `);
      const result = await executor.execute(sql`
        SELECT "blocked_until" AS "blockedUntil"
        FROM "login_rate_limit_counters"
        WHERE "expires_at" > ${nowDate}
          AND "key" IN (${keysSql})
      `);
      const blockedUntil = Math.max(
        0,
        ...(result.rows as Array<{ blockedUntil: unknown | null }>)
          .map((row) => row.blockedUntil == null ? 0 : asTimestamp(row.blockedUntil, "blocked_until")),
      );
      return blockedUntil > now
        ? {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
        }
        : { allowed: true, retryAfterSeconds: 0 };
    },

    async failure(keys, now) {
      const nowDate = new Date(now);
      const expiresDate = new Date(now + WINDOW_MS);
      for (const key of keys) {
        await executor.execute(sql`
          INSERT INTO "login_rate_limit_counters"
            ("key", "failures", "blocked_until", "last_attempt_at", "expires_at")
          VALUES (${key}, 1, NULL, ${nowDate}, ${expiresDate})
          ON CONFLICT ("key") DO UPDATE
          SET
            "failures" = CASE
              WHEN "login_rate_limit_counters"."expires_at" <= EXCLUDED."last_attempt_at"
                THEN 1
              ELSE "login_rate_limit_counters"."failures" + 1
            END,
            "blocked_until" = CASE
              WHEN "login_rate_limit_counters"."expires_at" <= EXCLUDED."last_attempt_at"
                THEN NULL
              WHEN "login_rate_limit_counters"."failures" + 1 >= ${MAX_FAILURES}
                THEN GREATEST(
                  COALESCE("login_rate_limit_counters"."blocked_until", to_timestamp(0)),
                  EXCLUDED."last_attempt_at" + ${WINDOW_MS} * interval '1 millisecond'
                )
              ELSE "login_rate_limit_counters"."blocked_until"
            END,
            "last_attempt_at" = EXCLUDED."last_attempt_at",
            "expires_at" = EXCLUDED."expires_at"
        `);
      }
    },

    async success(keys) {
      if (keys.length === 0) return;
      await executor.execute(sql`
        DELETE FROM "login_rate_limit_counters"
        WHERE "key" IN (${keyList(keys)})
      `);
    },
  };
};

export const loginAttemptKeys = (ip: string | undefined, email: string) => {
  const normalizedIp = ip?.trim() || "unknown";
  const normalizedEmail = email.trim().toLowerCase();
  return [`login:ip:${normalizedIp}`, `login:account:${normalizedEmail}`];
};