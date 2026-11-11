# Dependency security update

Audit date: 2026-11-11.

## Scope and result

All **176 explicitly requested package/advisory pairs** are absent from the final
dependency audit. Both `pnpm-lock.yaml` and the preserved migration copy's
`package-lock.json` were updated; neither was excluded from scanning.

Direct parents were updated first. Workspace overrides cover dependencies whose
parents still pin affected versions. The existing Expo SDK release line was
retained. Next remains on version 15 in the migration copy and version 16 in the
active workspace.

Compatibility changes:

- UUID uses the patched v11 line, retaining CommonJS APIs required by ExcelJS,
  ngrok and Xcode project generation.
- The `query-string` patch unwraps the updated ESM decoder's default export.
  The decoder itself is the patched upstream release, not a local security fork.
- ProseMirror model/transform versions and Vite's YAML peer were aligned to avoid
  incompatible duplicate type instances.
- The migration copy's Tiptap editor uses the v3 TextStyle export, avoids duplicate
  Link/Underline extensions and disables immediate server rendering.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm run typecheck`
- `pnpm run test:task10` — 96 passing tests across mobile, web and API.
- `pnpm --filter @workspace/scripts test:dependency-security` — 5 passing tests:
  both lockfiles' version floors, Arabic/malformed query decoding, native project
  UUID generation and Excel export/import.
- API build and all four Vite artifact builds, using their configured
  `PORT`/`BASE_PATH` values.
- Expo exports for web, iOS and Android.
- All six workflows restarted; main web and mobile public previews rendered.

Native exports verify bundling, not execution on an iOS or Android device.
The preserved migration app is not a running artifact and was not independently
built. No deployment was performed.

## Findings outside the supplied list

The final audit still reports **11 additional findings** (6 high, 5 moderate),
with **no critical findings**. These are not any of the 176 requested pairs:

| Package/release | Advisory | Fixed release |
| --- | --- | --- |
| zod 3.25.76, 4.4.3 | GHSA-mrhx-c7xc-m3w5 | 4.6.6 |
| body-parser 2.3.0 | GHSA-27r3-jxmh-p828 | 2.4.0 |
| follow-redirects 1.16.0 | GHSA-8r9p-f939-6h3c | 1.16.1 |
| follow-redirects 1.16.0 | GHSA-mrwp-f3q8-3g9p | 1.16.2 |
| follow-redirects 1.16.0 | GHSA-q3jh-wrc6-jgq8 | 1.16.1 |
| glob 13.0.6, 13.0.7 | GHSA-3g3m-2fjr-6pw4 | 14.0.2 |
| minimatch 10.2.5, 10.2.6 | GHSA-g3hv-75wg-m249 | 11.0.1 |

The audit counts separate lockfile/package-version occurrences. Full remaining
finding IDs and scan totals are recorded in the ignored generated output
`generated-artifacts/dependency-audit-result.json`. The regression test covers
this update's affected release lines; it does not replace ongoing security scans.
