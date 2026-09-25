---
name: Family aid offline retention
description: Security tradeoff for family aid history on shared devices after logout
---

Keep the last successfully synchronized family aid history and its sync time after logout. Do not retain the family profile, queued writes, or unrelated family/staff data as part of this exception. The aid card must be usable without a cached profile. Never display this snapshot until the same family account authenticates and owner-scoped hydration completes.

**Why:** Clearing the entire cache at logout prevents the requested offline return to a previously synchronized family history. The profile includes family member identifiers and critical notes, so even retaining it just to open the family page would leave sensitive data on a shared device.

**How to apply:** When changing logout, account switching, or offline cache behavior, maintain the narrow snapshot exception and test both a populated and an empty saved history across a different family's login.