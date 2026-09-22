---
name: Workspace detail history cache isolation
description: Browser history can restore detail views with stale shared-list data unless each record detail owns an ID-scoped query cache.
---

Detail screens that derive a record from a shared list must use an ID-scoped query key and render query errors explicitly.

**Why:** Browser back/forward restoration can reuse a previous list snapshot, causing a missing or failed current record to display another record's data.

**How to apply:** When adding record-detail queries in the staff workspace, include the record ID in the detail query key while keeping broad list invalidation as the prefix.