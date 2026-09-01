---
name: Wouter nested actor paths
description: Route authorization must account for Wouter's nested route location shape.
---

Wouter's `nest` routes expose the child location without the parent prefix inside the nested component. Any policy that matches the full actor URL must prepend the parent segment before checking access.

**Why:** Checking the full policy against the relative child path denied valid users, while rendering the actor layout first would risk exposing protected navigation or triggering page data requests.

**How to apply:** Keep authorization outside the protected actor layout and normalize nested locations to `/actor/...` before calling the route policy. Legacy data clients used by protected pages must also forward the active bearer session.