---
name: Native large-text validation
description: The limits of Expo web large-text tests for platform accessibility settings.
---

Use Expo web tests at narrow widths and enlarged text to catch layout regressions, but do not treat them as evidence that native Dynamic Type, Android font sizing, VoiceOver, or TalkBack work. CSS font enlargement does not reproduce native `fontScale`, platform tab controls, or screen-reader focus behavior.

**Why:** A browser simulation can reveal real layout problems while still passing or failing differently from the corresponding iOS and Android controls; this workspace may not have native devices or emulators attached.

**How to apply:** For mobile accessibility changes, pair the browser regression with a separate iOS and Android device/emulator checklist, and record native checks as unverified until actually performed.