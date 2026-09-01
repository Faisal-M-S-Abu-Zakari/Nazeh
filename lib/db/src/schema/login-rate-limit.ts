import { integer, text, timestamp, pgTable } from "drizzle-orm/pg-core";

/**
 * Shared, expiring login-failure counters. No credential or session material
 * belongs in this table.
 */
export const loginRateLimitCounters = pgTable("login_rate_limit_counters", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});