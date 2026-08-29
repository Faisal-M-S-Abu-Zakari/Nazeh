---
name: Expo API host routing
description: Replit development routing differences between Expo web previews and native Expo clients.
---

Use same-origin relative API paths for Expo web previews, but configure an absolute API host for native iOS and Android clients. In Replit development, the injected Expo domain may be the Metro host with an `.expo.` label; the sibling shared-proxy host omits that label.

**Why:** Pointing Expo web at the sibling host introduced an avoidable cross-origin transport path, while pointing native clients at Metro sent API calls to the wrong service. The injected development domain differed from the ordinary workspace shell domain.

**How to apply:** Branch API base configuration by platform. Keep web requests relative. For native development only, normalize the Replit `.expo.` hostname to its sibling proxy hostname; leave custom and published domains unchanged.