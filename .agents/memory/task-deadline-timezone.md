---
name: Task deadline timezone semantics
description: Keep date-only task deadlines aligned to the device calendar while preserving the stored instant.
---

Mobile task deadline inputs are calendar dates in the staff member's local timezone. A newly entered date represents local midnight and is sent to the API as an ISO timestamp. If an existing date is left unchanged while editing other task fields, preserve the original API timestamp exactly. Task lists and details should format the timestamp with the device's local timezone.

**Why:** Treating a date-only value as UTC midnight can display the previous or next calendar day on a device in another timezone, and normalizing an unchanged task date can move the stored instant.

**How to apply:** When changing mobile task deadline entry or task list/detail presentation, preserve the local-calendar interpretation and test both local date selection and rendering in different timezones.
