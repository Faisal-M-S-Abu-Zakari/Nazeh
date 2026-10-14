---
name: Family archive and transfer races
description: Expected shelter occupancy when family archive and reassignment race for the final place
---

When a family archive and a transfer compete for a full shelter's final place, the archive must commit in either lock order. If the archive locks first, the transfer can use the freed place; if the transfer locks first, it is rejected and the later archive leaves the shelter empty.

**Why:** An initial concurrency assertion assumed the shelter would always have one active assignment after both requests. The transfer-first order correctly leaves zero because the move was rejected before the occupant was archived.

**How to apply:** In tests of capacity-changing requests that free and claim space, assert the final occupancy for each ordering as well as the upper capacity bound; do not assume both operations always commit.
