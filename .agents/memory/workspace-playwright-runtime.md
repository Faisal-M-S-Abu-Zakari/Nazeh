---
name: Workspace Playwright runtime
description: Environment-specific browser executable handling for workspace end-to-end tests.
---

Workspace Playwright tests should configure an explicit Chromium executable path with an environment override and the Replit-provided fallback, rather than relying on Playwright's local browser cache.

**Why:** The installed Playwright package and the preloaded browser can use different revisions, so the default cache lookup may fail even though Chromium is available.

**How to apply:** Keep `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` as the first override, then use `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` or `/repl/tools/bin/chromium` for local workspace runs.