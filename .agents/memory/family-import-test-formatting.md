---
name: Family import test formatting
description: Avoid broad formatting churn in the PostgreSQL family-import integration suite.
---

The family-import PostgreSQL test file uses established manual formatting rather than the root Prettier defaults. Running Prettier over the whole file can rewrite unrelated sections and produce a very large diff.

**Why:** A focused test change should remain reviewable; a formatter run without matching project settings produced unrelated changes throughout the suite.

**How to apply:** Follow nearby formatting when editing this suite. Before finishing, inspect the diff and run the focused PostgreSQL test, typecheck, and `git diff --check`; do not autoformat the entire file unless the project adds a matching config.
