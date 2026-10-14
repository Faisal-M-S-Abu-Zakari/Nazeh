---
name: Shelter write lock order
description: Expected import-versus-family-archive outcomes when both transactions contend on the same shelter row.
---

When a family import and a family archive contend for one shelter, the lock winner determines the valid outcome. If the archive commits first, the import may use the newly freed place. If the import checks capacity first, it may be rejected and the archive can then commit; the rejection must leave no family, members, audit event, or idempotency claim.

**Why:** Capacity-changing transactions serialize on the shelter row, so a valid request can still be rejected when it reaches the lock before the operation that frees capacity. A test that assumes both requests always succeed would misrepresent the transaction order.

**How to apply:** PostgreSQL concurrency coverage should exercise both queue orders with real API requests, verify both wait on the same shelter-row lock, and assert capacity and transactional side effects for each outcome.
