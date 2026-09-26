# Native sign-in, recovery, and password-reset large-text check

The Playwright checks in `mobile-home-roles.spec.ts` enlarge text in the web
fallback only. They do not emulate iOS Dynamic Type or Android's system
font-size setting. Run the Maestro flow below on the installed native app on
both platforms; a browser preview is not a substitute.

## Device setup

Run once on iOS and once on Android using a native build that includes the
current mobile app:

- **iOS:** Open **Settings → Accessibility → Display & Text Size → Larger
  Text**, enable **Larger Accessibility Sizes**, and move the slider to its
  largest setting.
- **Android:** For a manual screen-reader pass, open **Settings → Display →
  Display size and text**, set **Font size** to its largest setting, and leave
  display size at its default. The automated command sets font scale to `2.0`.

Use a narrow supported phone and restart the app after changing the setting.

## Repeatable native flow

Install Maestro CLI and connect one target device at a time. Sign out before
starting. The flow does not clear app data or submit real credentials. Find the
device identifier with `maestro list-devices`, then run:

```sh
MAESTRO_DEVICE_ID=<device-id> pnpm test:task186:native-auth:ios
MAESTRO_DEVICE_ID=<device-id> pnpm test:task186:native-auth:android
```

The Android command sets the native system font scale to `2.0` for the test and
restores the previous value even if the flow fails. On iOS, set Larger
Accessibility Sizes to its maximum in Settings before running the command and
leave it at maximum.

The flow checks the account choices and selected state, email and password
labels and focus, the enabled **دخول** button and its empty-form validation
alert, and both recovery links. It opens the recovery guidance and reset-code
route without submitting data or using real credentials. The empty-form check
is local validation and must not send a sign-in request.

The flow checks the native accessibility tree and reachability, but Maestro
cannot confirm what a screen reader speaks. Repeat the empty-form check with
VoiceOver on iOS and TalkBack on Android. Keep the screen reader on, activate
**دخول** once while both fields are empty, and confirm the full validation
message is announced immediately as an alert without moving accessibility
focus to the message. Confirm the screen stays on sign-in and no loading state
or sign-in request occurs. Also confirm the account choices (including selected
state), both field labels, **دخول**, and both recovery links are announced
correctly.

## Sign-in

1. Open the sign-in screen and confirm **رب الأسرة** and **فريق المخيم** are
   fully readable, selectable, and reachable. The selected account choice
   should be announced as selected.
2. Focus each field and confirm the **البريد الإلكتروني** and **كلمة المرور**
   labels are announced with their inputs. Confirm neither label or input text
   is clipped.
3. Scroll through the form and confirm **دخول**, **نسيت كلمة المرور؟**, and
   **لديّ رمز دعوة أو استعادة** are complete, reachable, and announced as
   buttons. With both fields empty, activate **دخول** once and confirm
   **تحقق من البريد وكلمة المرور (8 أحرف على الأقل).** is announced immediately
   as an alert. Do not enter credentials; this local validation must not send a
   sign-in request.
4. Open each recovery action and return to sign-in before checking the next
   one. Confirm the destination opens and the sign-in form remains reachable.

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

Record the OS version, device model, maximum font setting, VoiceOver/TalkBack
result, whether the empty-form validation was announced immediately, and
whether any sign-in request or loading state occurred. Record pass/fail results
for sign-in, recovery, and password reset on each platform. Any clipped or
missing text, inaccessible input label, obscured button, unreachable button, or
validation message that is only visible but not announced is a failure.
