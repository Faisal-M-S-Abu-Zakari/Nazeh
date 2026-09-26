---
name: React Native Web tab label scaling
description: How to detect and prevent clipped bottom-tab labels when mobile text is enlarged in the browser.
---

React Native Web tab labels can remain single-line and clipped inside their own text container even when the tab row and document fit the viewport. Large-text checks must compare each rendered label's text range with its tab bounds, not only check document width. Longer labels may need more tab width, and enlarged line height may need more tab-bar height while preserving the web safe-area inset.

React Native Web tab accessible names may also include private-use glyphs from icon fonts, sometimes twice. To verify the visible label text, strip Unicode private-use characters from each tab's text content and compare the remaining labels; test click actionability separately.

**Why:** A 150% text check exposed Arabic tab-label clipping that the standard viewport-width check did not report.

**How to apply:** In mobile browser tests, enlarge visible text, measure label ranges against their individual `role="tab"` bounds, and use trial clicks to check tab actionability.