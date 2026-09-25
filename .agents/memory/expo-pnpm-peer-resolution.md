---
name: Expo peers in a pnpm workspace
description: Why Expo Doctor can report duplicate native modules after an SDK upgrade even when their versions match.
---

In a pnpm workspace, an unrelated React Three Fiber web artifact can resolve optional Expo peer dependencies from the mobile artifact. If that web artifact resolves a different TypeScript major, pnpm creates separate peer-context instances of the *same* Expo and expo-asset versions; Expo Doctor reports these as duplicate native modules. Align the TypeScript peer version for the sibling artifact instead of excluding the Doctor check or deleting the lockfile. Ensure React typings are available from the workspace root so Expo package declarations can resolve them under pnpm's strict node_modules layout.

**Why:** Dedupe did not collapse peer contexts with different TypeScript versions. Matching versions and root-visible React typings allowed the mobile typecheck and Expo Doctor to pass without suppressions.

**How to apply:** After an Expo SDK upgrade in this workspace, inspect `pnpm why expo` from both the mobile and web artifact if Doctor reports duplicate native modules of the same version. Check peer-context TypeScript versions before changing package versions or treating the installation as corrupted.