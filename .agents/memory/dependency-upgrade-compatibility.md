---
name: Dependency upgrade compatibility
description: Preserve module-format and SDK compatibility during security-only dependency remediation.
---

For security-only updates, retain the current Expo SDK release line unless a
patched dependency cannot work within it. Check module exports independently of
semantic-version compatibility when overriding transitive dependencies.

**Why:** Legacy CommonJS consumers can receive a namespace object rather than a
callable default when a patched dependency becomes ESM. Typechecks and lockfile
audits do not detect this runtime failure. Moving every dependency to its latest
major can also change native SDK requirements beyond a security-fix request.

**How to apply:** Exercise the real parent consumer (for example URL parsing,
native project generation or spreadsheet export), not just the upgraded package's
own import. Verify Metro exports as well as Node tests before considering the
mobile dependency graph compatible.
