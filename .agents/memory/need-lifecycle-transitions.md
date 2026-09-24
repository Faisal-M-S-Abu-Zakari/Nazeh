---
name: Need lifecycle transitions
description: Why the need workflow uses a server-enforced progression rather than arbitrary status changes
---

Need status changes should follow REQUIRED → APPROVED → IN_PROGRESS → FULFILLED, with cancellation allowed only before fulfillment. Treat a change to this progression as a domain-policy decision, not a UI-only convenience.

**Why:** The mobile workflow previously offered direct completion before approval and reopening after fulfillment. The API accepted those changes, making the approval and receipt states unreliable even if one client hid the controls.

**How to apply:** When adding other clients, bulk actions, or automated need updates, preserve server validation and mirror its permitted actions in the UI. Receipt of an aid distribution may fulfill its linked need as the server-side operational result.