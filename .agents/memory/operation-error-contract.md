---
name: Safe operation error contract
description: Public reason codes keep staff-facing mutation failures useful without exposing server details.
---

Staff-facing mutation failures should return a stable public reason code and let each client map known codes to localized guidance, with a generic retry-safe fallback for unknown responses. Do not expose full records or raw server error text in the UI.

**Why:** Operation failures need to distinguish conflicts, authorization, stock, and state conditions, while raw API messages can contain technical or sensitive details and are not a stable interface. A conditional write can fail because a record is missing, inaccessible, or merely stale; collapsing a stale update into 404 hides concurrent edits and prevents safe review.

**How to apply:** Add new rejection codes to the shared API contract first. After a conditional write returns no row, do an authorization-scoped lookup; return `VERSION_CONFLICT` only when a visible current record has a different version, and keep 404 for missing or out-of-scope records. Update employee-facing clients to preserve form state and show safe localized guidance.