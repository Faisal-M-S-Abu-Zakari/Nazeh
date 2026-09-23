---
name: React Native Web disabled selectors
description: How browser tests should verify disabled React Native Web Pressable controls.
---

React Native Web renders disabled `Pressable` controls as accessible elements with `aria-disabled="true"` rather than native disabled form controls.

**Why:** Playwright's `toBeDisabled()` does not recognize the rendered `div` as disabled even when the accessibility state is correctly disabled.

**How to apply:** Assert `aria-disabled="true"` for mobile browser tests and use the control's bounding box or pointer interaction only when the test needs to verify that repeated input does not start another request.