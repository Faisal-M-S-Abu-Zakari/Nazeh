---
name: Workspace browser URL
description: Environment-specific base URL required by workspace Playwright suites.
---

Workspace Playwright suites do not infer the application base URL from the artifact workflow; provide `WEB_E2E_URL` explicitly using the current Replit development domain.

**Why:** Without the variable, the shared login helper constructs an invalid `undefined/auth/login` URL and the suite exits before exercising the app.

**How to apply:** For local Replit verification, set `WEB_E2E_URL` to the current `$REPLIT_DEV_DOMAIN` URL while retaining the configured Chromium fallback.