---
name: Concurrent mutation callbacks
description: TanStack Query mutation handling for independent row actions that may overlap.
---

When multiple rows can trigger the same mutation at once, handle each request through its own promise rather than relying on per-call callbacks passed to `mutate`.

**Why:** Consecutive `mutate` calls share one mutation observer, so per-call callbacks can be associated with only the latest observer state when responses arrive out of order.

**How to apply:** Keep row-specific loading and error state keyed by the row identifier, use `mutateAsync` (or a mutation instance per row), and test delayed responses that resolve in the opposite order from the clicks.