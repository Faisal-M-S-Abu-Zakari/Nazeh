---
name: Single-control mutation locks
description: Preventing same-tick duplicate mutations from one mobile or web control.
---

For a single save control, a mutation library's pending state is useful for rendering but is not by itself a synchronous duplicate-request lock. Pair it with a ref guard that is set before awaiting the mutation, and a local loading state for immediate disabled feedback.

**Why:** Rapid pointer events can arrive before the pending mutation state has rerendered. Without the synchronous guard, two clicks can start two requests with the same optimistic version.

**How to apply:** Set the ref and local loading state at the start of the action, return immediately when either the ref or mutation is pending, and clear both in `finally`. Cover the behavior with a delayed-request browser test that clicks the control repeatedly.