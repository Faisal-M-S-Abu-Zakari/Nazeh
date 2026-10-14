---
name: PostgreSQL lock-race tests
description: Deterministic integration tests for competing API writes using real PostgreSQL locks.
---

For concurrency regressions, hold the shared database row lock, start each request in a known order, and verify through `pg_stat_activity` that every API transaction is blocked before releasing the lock. Then assert committed state and audit side effects, not just HTTP status.

**Why:** Starting promises together does not prove the transactions overlapped at the contested write; scheduler timing can let one operation finish before the other begins.

**How to apply:** Use the isolated PostgreSQL test schema and the existing blocked-write helper for endpoints that serialize on shelter/family state. Queue requests in the intended order and check both persisted rows and audit records afterward.
