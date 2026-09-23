---
name: Generated API declarations
description: How the API server consumes generated declarations from the shared Zod package during TypeScript project-reference checks.
---

The shared API package's declaration output is ignored build output, but the API server's TypeScript project reference resolves against it. Rebuild the package from its source before diagnosing server errors that say a current schema export is missing.

**Why:** A schema can already be present and exported in the tracked source while the stale ignored declaration output makes downstream imports appear missing, masking later server diagnostics.

**How to apply:** Run the shared package TypeScript build with a forced refresh, then rerun the API server typecheck; treat unrelated workspace-package failures separately.