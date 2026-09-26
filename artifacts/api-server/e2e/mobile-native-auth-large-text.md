# Native sign-in, recovery, and password-reset accessibility checks

The Playwright checks in `mobile-home-roles.spec.ts` enlarge text in the web
fallback only. They do not emulate iOS Dynamic Type or Android's system
font-size setting. Run the Maestro flows below on an installed native app on
both platforms; a browser preview is not a substitute.

## Device setup

Run once on iOS and once on Android using a native build that includes the
current mobile app:

- **iOS:** Open **Settings → Accessibility → Display & Text Size → Larger
  Text**, enable **Larger Accessibility Sizes**, and move the slider to its
  largest setting.
- **Android:** The test commands set the native system font scale to `2.0` and
  restore its previous value when they finish. For the manual screen-reader
  pass, set **Font size** to its largest setting in **Settings → Display →
  Display size and text**, leaving display size at its default.

Use a narrow supported phone, enable VoiceOver or TalkBack for the manual
checks, and restart the app after changing the text setting.

## Repeatable native flows

Install Maestro CLI and connect one target device at a time. Sign out before
starting. These flows do not clear app data or use real account credentials.
Find the device identifier with `maestro list-devices`.

Run the standard sign-in, rejection, recovery, and reset-form checks **with
network access enabled**:

```sh
MAESTRO_DEVICE_ID=<device-id> pnpm test:task193:native-auth:ios
MAESTRO_DEVICE_ID=<device-id> pnpm test:task193:native-auth:android
```

The flow checks local empty-form validation, a server-rejected sign-in using a
reserved `.invalid` email and fake password, and verifies that server details
are not displayed. It also checks both recovery links, reset-code and password
fields, the password requirements, and the enabled **حفظ كلمة المرور** button.
It uses only fixed sample values and never activates the save button, so no
credential-completion request is sent.

Run the connection-failure check separately, with Wi-Fi and mobile data
disabled before starting. The native app must already be installed; do not rely
on a live Expo development session while the device is offline.

```sh
MAESTRO_DEVICE_ID=<device-id> pnpm test:task194:native-auth:ios
MAESTRO_DEVICE_ID=<device-id> pnpm test:task194:native-auth:android
```

This flow enters only fake, correctly-shaped credentials. It checks that the
generic connection message appears, no network or programming details appear,
and **دخول** becomes available for a second attempt. Restore network access
after completing the offline test.

The Android commands set the system font scale to `2.0` and restore the
previous value even if the flow fails. On iOS, set Larger Accessibility Sizes
to its maximum in Settings before running either command.

## VoiceOver and TalkBack checks

Maestro checks the native accessibility tree and reachability, but cannot
confirm spoken output. Repeat the relevant flows with VoiceOver on iOS and
TalkBack on Android, keeping the screen reader enabled:

- With both sign-in fields empty, activate **دخول**. Confirm the complete local
  validation message is announced immediately as an alert, focus stays in
  place, and no request or loading state occurs.
- With network access enabled, submit the fake `.invalid` credentials in the
  standard flow. Confirm **البريد الإلكتروني أو كلمة المرور غير صحيحة.** is
  announced immediately and clearly, the screen remains on sign-in, and no
  server message, status code, or exception details are shown or announced.
- With Wi-Fi and mobile data disabled, submit the fake credentials in the
  connection-failure flow. Confirm **تعذر تسجيل الدخول. تحقق من الاتصال وحاول
  مجدداً.** is announced immediately as an alert. Confirm the button becomes
  available and can be activated a second time, with the same safe message
  announced again. No raw network, server, or programming error should appear.
- Confirm the account choices (including selected state), sign-in and reset
  field labels, password requirements, **دخول**, **حفظ كلمة المرور**, and both
  recovery links are announced correctly.

Restore network access after the offline check.

## Sign-in

1. Confirm **رب الأسرة** and **فريق المخيم** are readable, selectable, and
   reachable. The selected account choice should be announced as selected.
2. Focus both fields and confirm **البريد الإلكتروني** and **كلمة المرور** are
   announced with their inputs. Confirm neither label nor input is clipped.
3. With both fields empty, activate **دخول** once and confirm
   **تحقق من البريد وكلمة المرور (8 أحرف على الأقل).** is announced immediately
   as an alert, with no request or loading state.
4. With network access enabled, enter the fake credentials
   `native-auth-rejection@example.invalid` and `IncorrectTestPassword123!`.
   Confirm the safe rejection message is announced, sign-in remains visible,
   and raw server details do not appear.
5. Open both recovery actions and return to sign-in between them. Confirm each
   destination opens and the sign-in form remains reachable.

## Recovery guidance

1. Open login, then choose **نسيت كلمة المرور؟**.
2. Confirm the **استعادة الوصول** heading and guidance paragraph are visible
   and readable without horizontal clipping.
3. Confirm **لديّ رمز إعادة تعيين** and **العودة لتسجيل الدخول** are visible,
   announced as buttons, and can be activated.
4. Activate **لديّ رمز إعادة تعيين** to open password reset.

## Reset-code form

1. Confirm the **تعيين كلمة المرور** heading, introductory guidance, all field
   labels (**الرمز الآمن**, **كلمة المرور الجديدة**, **تأكيد كلمة المرور**), and
   password requirements are complete and readable.
2. Focus each input and confirm it is announced with its matching label.
   Confirm the password requirements are announced as text.
3. The automated flow types fixed sample values to enable the save button.
   These are test-only values; the button is never activated and no request is
   submitted.
4. Confirm **حفظ كلمة المرور** is visible, enabled, and announced as a button.
   Move VoiceOver or TalkBack focus to it, but do not activate it.

## Record

Record the OS version, device model, maximum font setting, and VoiceOver or
TalkBack result for each platform. Record whether local validation, rejected
credentials, and connection failure were announced immediately; whether the
retry button stayed usable; and pass/fail for recovery and password reset.
Clipped text, inaccessible labels, obscured or unreachable buttons, missing
announcements, or exposed technical details are failures. Mark any native
screen-reader check as unverified unless it was actually performed on the
platform.