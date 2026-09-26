# Native dashboard and aid operations large-text check

The Playwright case in `mobile-role-journeys.spec.ts` exercises the Expo web
fallback at 320 CSS pixels and 200% text. It checks screen-reader roles and
accessible names, layout bounds, and whether the main controls can receive a
trial tap. It does **not** emulate iOS Dynamic Type, Android system font sizing,
VoiceOver, or TalkBack. Complete this checklist on narrow native phones.

## Device setup

Run once on iOS and once on Android with a current build or Expo Go:

- **iOS:** Open **Settings → Accessibility → Display & Text Size → Larger
  Text**, enable **Larger Accessibility Sizes**, and move the slider to the
  largest setting.
- **Android:** Open **Settings → Display → Display size and text**, set
  **Font size** to its largest setting, and leave display size at its default.

Use portrait orientation on the narrowest supported phone. Restart the app
after changing the setting. Sign in as a manager with at least one aid campaign
whose title is long enough to wrap.

## Automated findings

The Playwright check uses a 320 CSS-pixel viewport and 200% web text. It exposed
crowding in the aid-screen header and clipping in the web fallback's bottom-tab
labels. The header now moves its title below the action/logo row at narrow
widths or large system text. Expanded tab labels can use two lines, and the tab
bar grows to leave room. Text size is not capped.

The test also checks that dashboard shortcuts, aid actions, tab names, and
screen-reader button names remain visible, in bounds, and tappable. It does not
run VoiceOver or TalkBack.

## Dashboard

1. Enable VoiceOver or TalkBack.
2. Confirm the greeting, quick-action labels, operation summary, metric values
   and labels, alerts, and announcement text remain readable without clipped
   lines. Scroll the dashboard to reach actions below the fold.
3. Swipe through the tab bar and confirm **الرئيسية**, **المساعدات**, **السجل**,
   **التنبيهات**, and **الحساب** are announced with distinct names.
4. Swipe through the primary actions. Confirm **الإشعارات**, **تسجيل مساعدة**,
   **إضافة فرد**, **تسجيل شكوى**, **تكليف مهمة**, **العائلات**, **الاحتياجات**,
   **وحدات الإيواء**, and **التقارير** are announced with useful Arabic names
   and as buttons.
5. Activate at least one quick action and return to the dashboard. Confirm the
   destination opens and the action remains reachable.

## Aid operations

1. Open **المساعدات** from the tab bar. Confirm **إدارة المساعدات** and its
   subtitle are readable.
2. Confirm **إضافة مساعدة** is announced as a button and can be reached and
   activated. Return without saving a campaign.
3. Focus a campaign with a long title. Confirm its full title, status, type,
   date, family count, and recipient count can be read; wrapped lines must not
   overlap or be cut off.
4. Confirm the campaign card is announced as one button with its campaign
   title and recipient information. Activate it and confirm the details open.

## Record

Record OS version, device model, maximum text setting, screen reader used, and
pass/fail for each platform. A hidden or clipped line, missing/ambiguous
button name, or action that cannot be focused or activated is a failure.

Native iOS/Android and screen-reader checks remain unverified until this
checklist is run on devices or emulators with VoiceOver/TalkBack available.