---
name: Unified manager compatibility
description: Why the platform keeps two historical manager role values while presenting one manager role.
---

Treat `ADMIN` and `MANAGER` as internal aliases for the single user-facing role «مدير». Exactly one row across both aliases may be active; historical rows remain inactive and cannot be invited or reactivated.

**Why:** Existing data may contain either historical role value, but the product requirement is one person who manages the complete platform. Keeping inactive rows preserves historical references without leaving a path to a second privileged account.

**How to apply:** Manager-only permissions must include both aliases and display «مدير». Enforce the singleton invariant in the database and every account-lifecycle path; keep staff invitations limited to non-manager roles.