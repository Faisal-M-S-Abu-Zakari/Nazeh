---
name: Safe development schema startup
description: Why API startup must not run interactive Drizzle schema pushes.
---

Keep the API development startup path read-only with respect to schema changes: verify required tables, columns, and security-critical indexes/invariants, then seed idempotently. Apply schema changes separately as reviewed, data-preserving migrations.

**Why:** An interactive `drizzle-kit push` encountered populated tables that needed new non-null columns and paused the API workflow at a truncation prompt, causing HTTP 502 responses. Automatically forcing the push would have deleted camp records.

**How to apply:** Backfill populated rows in a reviewed SQL migration before enforcing constraints, then update the read-only verifier for startup-critical columns and indexes. Never add a forced or interactive schema push to API startup.