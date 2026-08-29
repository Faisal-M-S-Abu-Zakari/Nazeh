---
name: Legacy and staff auth schemas
description: How to avoid collisions between the numeric legacy login API and UUID staff authentication API.
---

The legacy role-based login and the modern staff login must use distinct request and response validation schemas, even though both expose an `/auth/login` route through the shared router.

**Why:** Generated API exports can resolve `LoginBody` and `LoginResponse` to the UUID staff contract. Reusing those validators in the numeric legacy route strips the role field and rejects its numeric user response, causing valid legacy credentials to fail or return HTTP 500.

**How to apply:** When regenerating API validators or changing authentication contracts, explicitly verify both login variants and test the legacy role field plus numeric-user response independently.