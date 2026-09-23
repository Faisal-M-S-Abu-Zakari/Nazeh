---
name: Expo mobile browser URL
description: Local environment requirement for running Playwright suites against the Expo web artifact
---

Set `EXPO_E2E_URL` explicitly to the current `https://$REPLIT_EXPO_DEV_DOMAIN` before running an Expo mobile browser suite.

**Why:** The configured Expo workflow exposes its dev domain, but that URL is not automatically inherited as `EXPO_E2E_URL` by one-off shell commands. Without the variable, the suite exits in `beforeAll` before testing the app.

**How to apply:** Restart the managed API and Expo workflows when needed, then prefix the Playwright command with the current Expo dev URL rather than committing a fixed hostname.