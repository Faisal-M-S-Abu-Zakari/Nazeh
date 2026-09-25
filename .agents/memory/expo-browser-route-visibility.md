---
name: Expo browser route visibility
description: Why mobile browser navigation tests can find duplicate labels and miss router.back transitions.
---

Expo Router's web stack can retain off-screen routes in the DOM. A matching text node or test ID is not necessarily the active route, even after navigation.

**Why:** Browser tests repeatedly targeted hidden copies of home actions; direct browser navigation into a form also left `router.back()` without the intended in-app parent screen.

**How to apply:** Scope ambiguous selectors with Playwright's visible filter, and enter forms via the app's own navigation when the success path uses `router.back()`. Direct URLs are useful for independent read-only access checks, not for testing back-stack behavior.