---
name: Unified manager compatibility
description: Why the platform keeps two historical manager role values while presenting one manager role.
---

Treat `ADMIN` and `MANAGER` as internal aliases for the single user-facing role «مدير». Both receive the same platform-wide permissions, while new staff invitations must not create another manager.

**Why:** Existing data may contain either historical role value, but the product requirement is one person who manages the complete platform. Removing an enum value directly would risk breaking existing accounts.

**How to apply:** Any manager-only route, permission, label, or navigation item must include both internal values and display «مدير». Keep the staff invitation UI limited to non-manager employee roles.