---
name: Expo browser route visibility
description: Why mobile browser navigation tests can find duplicate labels and miss router.back transitions.
---

Expo Router's web stack can retain off-screen routes in the DOM. A matching text node or test ID is not necessarily the active route, even after navigation. Directly opening an edit route before its query returns can also initialize controlled fields without the record data.

**Why:** Browser tests repeatedly targeted hidden copies of home actions; direct navigation into a form can both skip the intended in-app parent screen and mount before the cached record is available.

**How to apply:** Scope ambiguous selectors with Playwright's visible filter, and enter edit forms from a visible list after the target record appears. Use in-app navigation when the success path uses `router.back()`; reserve direct URLs for independent read-only access checks, not back-stack or edit-prefill tests.