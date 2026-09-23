---
name: Expo web mutation errors
description: How to expose important mutation failures consistently in Expo native and web test environments.
---

Critical mutation failures should render an inline, accessible message with a retry action in addition to any native alert.

**Why:** On Expo Web, React Native `Alert.alert` does not become a Playwright browser dialog, so an alert-only failure can be invisible to browser users and impossible to verify in narrow-screen tests.

**How to apply:** Keep the error text safe and localized, render it inside the affected screen with a retry control, and measure both message and retry layouts at narrow mobile widths.