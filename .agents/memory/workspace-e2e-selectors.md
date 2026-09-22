---
name: Workspace browser selector conventions
description: Accessible control roles used by the staff workspace browser tests.
---

Mantine `Select` and `NumberInput` controls in the staff workspace are exposed as
textboxes in the browser accessibility tree. Select assertions should check the
visible option label rather than an internal option value.

**Why:** Browser tests initially targeting combobox/spinbutton roles, or asserting
internal IDs, did not match the controls as a staff member sees them.

**How to apply:** Use the Arabic field label with `getByRole('textbox', { name })`;
after selection, assert the displayed label and keep IDs only in the mocked API
request assertions.