# Native task result and approval large-text check

The `mobile-role-journeys.spec.ts` Playwright check runs against Expo Web and
changes browser text styles to 150%. It does not test iOS Dynamic Type or
Android's system font-size setting. Use Expo Go or an installed native build
on a phone or simulator for this check.

## Device setup

Run on a narrow phone in portrait orientation. Set the operating system text
size to its largest accessibility setting and restart Expo Go or the app:

- **iOS:** Settings → Accessibility → Display & Text Size → Larger Text; turn
  on **Larger Accessibility Sizes** and move the slider to the maximum.
- **Android:** Settings → Display → Display size and text; set **Font size** to
  the maximum and leave **Display size** at its default.

Use a disposable security task assigned to a **SECURITY_MEMBER** account. The
task must be **IN_PROGRESS** so that it can accept a result.

## Security member: submit a result

1. Sign in as the security member and open the assigned task from **التنبيهات**.
2. Confirm **تفاصيل المهمة الأمنية**, its title and details, **تقديم نتيجة
   المهمة**, and the **النتيجة** field are fully readable. No characters should
   be cut off at the sides or hidden behind another control.
3. Tap the result field, enter a short Arabic result, and scroll the screen.
   Confirm the insertion point and entered text remain visible.
4. Scroll to **تقديم**. Confirm the complete label and button hit area are
   visible and can be tapped; submit the disposable result.

## Manager: approve the result

1. Sign in as a manager and open the same task.
2. Scroll through the task details to **اعتماد نتيجة المهمة**. Confirm the
   submitted result is fully readable, and **ملاحظة الاعتماد (اختياري)** and
   its input are visible and reachable.
3. Tap the note field, enter a short Arabic note, and scroll to **اعتماد
   المهمة**. Confirm its complete label and button hit area are visible and can
   be tapped; approve the disposable task.

## Record and pass criteria

Record the platform, OS version, device model, maximum text setting, and
member/manager pass or fail. Both roles pass only if all named text is readable
without clipping, fields can be tapped and edited, and the result/approval
actions can be reached and tapped. Any missing, clipped, obscured, or
untappable content is a failure.