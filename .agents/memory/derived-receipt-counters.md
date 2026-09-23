---
name: Derived receipt counters
description: How staff aid receipt mutations keep derived received counts accurate across list and detail views.
---

When a distribution changes from assigned to received, update every matching aid-list cache immediately and invalidate the distribution and aid queries afterward. Only increment when the cached distribution was not already received.

**Why:** The receipt response contains the distribution, not the aggregate aid count. Waiting only for refetch leaves cards and operations summaries stale, while unconditional increments can double-count when a concurrent refetch already applied the transition.

**How to apply:** Treat the status transition as the source of truth for the optimistic increment, scope the update by aid ID, and leave caches unchanged on mutation errors or pending requests.