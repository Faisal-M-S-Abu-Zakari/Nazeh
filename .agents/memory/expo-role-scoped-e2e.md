---
name: Expo role-scoped e2e checks
description: How browser tests should handle the mobile app's aggregate sync state when test roles have limited permissions.
---

Mobile staff accounts can receive a successful response for the feature under test while another enabled query returns 403 because that role lacks an unrelated permission. The shared sync banner then reports an error even though the target screen is usable.

**Why:** A recipient-count test using a delegate account initially failed by waiting for the global “synced” banner; the aid query was successful, but the tasks query was correctly forbidden.

**How to apply:** In role-scoped Expo browser tests, wait for the authenticated screen or target feature controls, then assert the relevant request and UI state directly. Reserve global sync-banner assertions for accounts whose role is authorized for every enabled query.