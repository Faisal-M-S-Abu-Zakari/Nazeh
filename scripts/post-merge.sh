#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
CI=1 pnpm install --frozen-lockfile
# Schema changes require a separate reviewed migration; never push on merge.
pnpm --filter @workspace/db run verify
