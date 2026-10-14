---
name: Archived shelter assignments
description: Operational semantics for active families still assigned to archived shelters.
---

Archiving a shelter does not move or archive families assigned to it. Those families remain active and visible with their original shelter IDs; managers can still change family details as long as they do not change the retained placement. A successful shelter archive audit records how many active family assignments were retained.

**Why:** Families may be moved to a shelter before its later archival; removing their assignment or blocking all subsequent edits would break the operational record.

**How to apply:** When changing shelter archival or family editing APIs, preserve historical placement, allow non-placement edits, and only validate placement availability when placement actually changes. User-facing screens should not label an assigned archived shelter as “no shelter.”
