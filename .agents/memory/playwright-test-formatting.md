---
name: Playwright test formatting
description: Formatting convention for browser specs in this workspace.
---

Browser test files in this workspace should be checked with Prettier's single-quote setting.

**Why:** The repository has no active root Prettier configuration, while existing Playwright specs consistently use single quotes; the default formatter otherwise reports valid project style as changed.

**How to apply:** Run `pnpm exec prettier --single-quote --check <spec>` for these tests and preserve the surrounding file's existing style.