# Native tab bar large-text check

This device check covers the native `NativeTabs` bar. The Playwright cases in
`mobile-home-roles.spec.ts` exercise the web fallback and do not verify native
tab-bar sizing or safe-area behavior.

## Devices and settings

Run once on each platform using a build or Expo Go version that includes the
current mobile app:

- **iOS 26 or later:** Open **Settings → Accessibility → Display & Text Size →
  Larger Text**, enable **Larger Accessibility Sizes**, and move the slider to
  its largest setting. This is the iOS version range where the app selects
  `NativeTabs`.
- **Android:** Open **Settings → Display → Display size and text** and set
  **Font size** to its largest setting. Keep display size at its default.

Use a narrow supported phone and restart the app after changing the setting.
Do not use the browser preview for this check.

## Steps

1. Sign in with an account that can open the five main tabs.
2. Confirm these five labels are all visible in full: **الرئيسية**,
   **المساعدات**, **السجل**, **التنبيهات**, and **الحساب**.
3. Confirm the labels and icons remain inside the tab bar and above the iOS
   home indicator or Android system navigation area.
4. Tap each tab label in turn. Confirm each tab becomes selected and its screen
   opens; verify no neighboring tab is activated by the same tap.
5. Repeat with the system screen reader enabled. Confirm each tab announces
   the matching Arabic accessibility label and selected state.

## Pass criteria

- All five labels are complete, readable, and not covered by the system safe
  area.
- Each label and its corresponding touch target are separate and actionable.
- Each tap selects only its matching tab.
- Screen readers announce the full Arabic label and selected state.

Record the OS version, device model, maximum text setting, and pass/fail result
for each platform. Any clipping, overlap, missing label, or incorrect tab
selection is a failure.