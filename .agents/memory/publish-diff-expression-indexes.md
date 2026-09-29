---
name: Publish diff and expression indexes
description: A valid PostgreSQL expression index can still produce malformed SQL in the managed development-to-production schema diff.
---

Inspect the managed Publish schema diff before releasing a security-critical expression index. An index key containing a nested SQL function with comma-separated arguments produced a truncated, invalid `CREATE INDEX` statement in the diff even though PostgreSQL accepted the development index.

**Why:** A successful local migration and schema check did not guarantee that the managed production diff could recreate the index. Publishing that diff could fail or leave production without the required uniqueness guard.

**How to apply:** Review the actual diff statements, not just its non-destructive flag. If simplifying the expression to avoid commas, first confirm existing development and production records are canonical under both expressions, retain canonicalization on every write, and align the schema, migration, and startup verifier. Recheck the generated diff. Do not add production startup DDL; managed Publish applies production schema changes.