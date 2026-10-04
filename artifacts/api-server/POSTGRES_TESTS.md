# Family-write concurrency tests

Run against the workspace's **development PostgreSQL database only**:

```sh
NODE_ENV=test pnpm --filter @workspace/api-server run test:family-import-postgres
```

The suite is opt-in, so the normal `test` command reports it as skipped.
It refuses `NODE_ENV=production` and published Replit processes
(`REPLIT_DEPLOYMENT=1`).

The suite creates a randomly named `family_import_test_*` schema, copies only
the relevant table definitions and indexes (no records), and creates its own
synthetic manager, session, camp, sector, families, and shelter. Every pool
connection uses only that schema in its search path. Development seeding is
disabled, and no existing family records are read or written.

Requests go through the real Express app, staff authentication, transactions,
and PostgreSQL constraints. Real database locks hold both independent API
transactions at the contention point; `pg_stat_activity` confirms both are
waiting before the blocker is released. Distinct idempotency keys avoid
mistaking replay serialization for family-write protection.

- Two imports of the same normalized ID: exactly one 201 and one safe 409,
  with no partial family, member, audit, or idempotency record from the loser.
- Import versus manual creation at the last shelter place: exactly one 201
  and one explicit capacity-validation 400, with no excess assignment or
  partial rejected family.
- Two imports targeting the same shelters in reverse file order: PostgreSQL
  confirms both transactions are waiting on the real shelter-row lock before
  release; both then finish and persist the expected families and members.
- Two family updates moving families between the same shelters in opposite
  directions: PostgreSQL confirms both real PATCH transactions are waiting on
  the shelter-row lock before release; both then finish with consistent family
  assignments, unchanged members, matching assignment history, and valid capacity.
- Family reassignment versus import for the last shelter place: exactly one
  succeeds, with a clear capacity rejection and no partial family move/import.
- Shelter capacity reduction versus import: exactly one succeeds; the final
  assignments never exceed the committed capacity and rejected imports leave
  no partial family or members.

Teardown runs on success and assertion/setup failure, drops only the suite's
allowlisted synthetic schema, checks that it is gone, and closes the server
and pool. A forcibly terminated process cannot run teardown; any leftover
schema is recognizable by the above prefix and contains synthetic data only.
