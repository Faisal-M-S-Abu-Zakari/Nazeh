# Native recovery and password-reset large-text check

The Playwright checks in `mobile-home-roles.spec.ts` enlarge text in the web
fallback. They do not emulate iOS Dynamic Type or Android's system font-size
setting. Run this checklist on a phone with the native app or Expo Go; do not
use the browser preview.

## Device setup

Run once on iOS and once on Android using a build or Expo Go version that
includes the current mobile app:

- **iOS:** Open **Settings → Accessibility → Display & Text Size → Larger
  Text**, enable **Larger Accessibility Sizes**, and move the slider to its
  largest setting.
- **Android:** Open **Settings → Display → Display size and text**, set **Font
  size** to its largest setting, and leave display size at its default.

Use a narrow supported phone and restart the app after changing the setting.
Enable VoiceOver or TalkBack for the accessibility-name checks.

## Recovery guidance

1. Open login, then choose **نسيت كلمة المرور؟**.
2. Confirm the **استعادة الوصول** heading and the complete guidance paragraph
   are visible and can be read without horizontal clipping.
3. Confirm **لديّ رمز إعادة تعيين** and **العودة لتسجيل الدخول** are fully visible,
   announced as buttons, and can be activated.
4. Activate **لديّ رمز إعادة تعيين** to open password reset.

## Reset-code form

1. Confirm the **تعيين كلمة المرور** heading, introductory guidance, all field
   labels (**الرمز الآمن**, **كلمة المرور الجديدة**, **تأكيد كلمة المرور**), and
   the password requirements are complete and readable.
2. Confirm each input is reachable and announced with its matching label.
3. Enter a 32-character sample code, a password that meets the displayed
   requirements, and the same password again. Do not submit the sample values.
4. Scroll as needed, then confirm **حفظ كلمة المرور** is fully visible,
   announced as a button, and can be focused and activated.

## Record

Record the OS version, device model, maximum font setting, and pass/fail result
for each screen and platform. Any clipped or missing text, inaccessible input
label, obscured button, or button that cannot be reached is a failure.