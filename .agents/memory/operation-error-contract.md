---
name: Safe operation error contract
description: Public reason codes keep staff-facing mutation failures useful without exposing server details.
---

Staff-facing mutation failures should return a stable public reason code and let each client map known codes to localized guidance, with a generic retry-safe fallback for unknown responses. Do not expose full records or raw server error text in the UI.

**Why:** Operation failures need to distinguish conflicts, authorization, stock, and state conditions, while raw API messages can contain technical or sensitive details and are not a stable interface.

**How to apply:** Add new rejection codes to the shared API contract first, return them from the relevant route, and update every employee-facing client to preserve form state and show a safe localized message.