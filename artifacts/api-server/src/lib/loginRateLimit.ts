type AttemptBucket = {
  failures: number;
  blockedUntil: number;
  lastAttemptAt: number;
};

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const buckets = new Map<string, AttemptBucket>();

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastAttemptAt > WINDOW_MS && bucket.blockedUntil <= now) {
      buckets.delete(key);
    }
  }
}

export type LoginRateLimit = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * This is deliberately a small process-local limiter. It protects a single
 * API process from credential spraying without persisting passwords or
 * session tokens. A shared store can replace it when the service is scaled
 * horizontally.
 */
export const loginRateLimit = {
  check(keys: string[], now = Date.now()): LoginRateLimit {
    prune(now);
    const blockedUntil = Math.max(...keys.map((key) => buckets.get(key)?.blockedUntil ?? 0));
    return blockedUntil > now
      ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)) }
      : { allowed: true, retryAfterSeconds: 0 };
  },

  failure(keys: string[], now = Date.now()) {
    prune(now);
    for (const key of new Set(keys)) {
      const current = buckets.get(key);
      const withinWindow = current && now - current.lastAttemptAt <= WINDOW_MS;
      const failures = (withinWindow ? current.failures : 0) + 1;
      buckets.set(key, {
        failures,
        blockedUntil: failures >= MAX_FAILURES ? now + WINDOW_MS : 0,
        lastAttemptAt: now,
      });
    }
  },

  success(keys: string[]) {
    for (const key of new Set(keys)) buckets.delete(key);
  },
};

export const loginAttemptKeys = (ip: string | undefined, email: string) => {
  const normalizedIp = ip?.trim() || "unknown";
  const normalizedEmail = email.trim().toLowerCase();
  return [`login:ip:${normalizedIp}`, `login:account:${normalizedEmail}`];
};