---
name: Deployment environment guards
description: Choose the app deployment marker, not the platform environment label, for development-only safeguards.
---

Do not treat `REPLIT_ENVIRONMENT=production` alone as proof that this app is running against production. Use the documented `REPLIT_DEPLOYMENT=1` marker to identify a published Replit process, alongside explicit test opt-in and isolated synthetic storage.

**Why:** The development task workspace carried the `production` platform-environment label while the development database callback connected successfully. Checking that label incorrectly blocked development-only integration tests. Official Replit configuration documentation identifies `REPLIT_DEPLOYMENT` as the published-app marker.

**How to apply:** For development-only test safeguards, reject published processes and production-mode application runs. Keep test connections isolated and do not override a deployment marker merely to make a test run.