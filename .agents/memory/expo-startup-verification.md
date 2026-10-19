---
name: Expo startup verification
description: A running Metro process and passing TypeScript check do not prove the mobile preview renders.
---

Verify the rendered preview before declaring Expo startup healthy. Metro can advertise a QR code and JavaScript can boot while the preview remains blank.

**Why:** A blank preview persisted with a healthy workflow and passing TypeScript check. Expo Doctor identified SDK patch mismatches; aligning the recommended patches and restarting restored rendering. The Linux DevTools GTK warning remained, so it was not the app's blocking failure.

**How to apply:** Run Expo compatibility checks from the mobile package directory, then verify the rendered preview after the coherent fix. Keep optional desktop-debugger warnings separate from app launch errors.
