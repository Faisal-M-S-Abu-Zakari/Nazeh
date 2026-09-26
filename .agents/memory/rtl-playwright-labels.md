---
name: RTL Playwright locator matching
description: Avoid ambiguous substring matches when Arabic accessible names share phrases.
---

When two visible controls share part of an Arabic accessible name, use exact label matching for assertions that target the shorter name. For direct interaction, prefer the existing test ID and separately assert the full accessible name.

**Why:** A password-recovery button's name contains the password field label, so Playwright's default partial `getByLabel` lookup can match both controls.

**How to apply:** In RTL form tests, use `{ exact: true }` when a field or action label might be a phrase within another control's accessible name.