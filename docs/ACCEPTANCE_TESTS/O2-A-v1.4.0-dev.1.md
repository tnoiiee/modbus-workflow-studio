# O2-A acceptance — v1.4.0-dev.1

Base: `eed588481ae7e7376f9926e58dbd37f9076b5c2e` (merged v1.3.0).
Owner-approved [scope](../SCOPE_O2-A_v1.4.0-dev.1.md), including App navigation-only wiring.
Only Stage 1 is authorized. Full Gates require separate Owner authorization.

## Targeted automated coverage

| Area | Evidence |
|---|---|
| Server UUID generation, immutable IDs, rename, Workflow/source-type/shared isolation | `server/test/definitionCatalog.test.ts` |
| Enable/Disable, delete/missing, no Page rewrite, persistence/reload/failure, deleted parent | `definitionCatalog.test.ts` |
| Strict create/read/list/PATCH/DELETE HTTP, error codes, no Runtime endpoints | `server/test/definitionRoutes.test.ts` |
| Real persisted definitions → BOUND/rename/disable/type mismatch/delete resolution, Page bytes unchanged | `server/test/definitionBindingIntegration.test.ts` |
| Five statuses, legacy/no-name-matching, type/capability matrix, missing metadata, unknown type | `client/src/lib/overviewBindingO2.test.ts` |
| Refresh no dirty/Undo/revision, selection/clear history/roundtrip, bounded memo on resize | `overviewBindingO2.test.ts` plus existing Overview state/history tests |
| Inspector labels/metadata/reason, disabled Runtime, navigation separation, explicit selection callbacks | `client/src/components/overview/OverviewBindingO2.test.tsx` |
| View exact target/open order, Edit no-op, missing/failure no fallback, App/Element boundary | `client/src/lib/overviewNavigation.test.ts` |
| View/Edit, independent controls, geometry/selection/drag/resize/collision/savedViewport | Existing client Overview tests; server Overview page/control tests |
| Protected Workflow selector, Devices and Workflow Canvas source integrity at approved base (not browser behavior) | `client/src/lib/overviewProtectedO2.test.ts` |
| UI/manifests/lockfile/health/hello/banner identity | `client/src/version.test.ts` |

Tests include pure-function, persistence/HTTP, callback, SSR markup and source-contract checks.
SSR/source-contract assertions are NOT browser interaction/accessibility or hardware evidence.
Workflow/Devices implementations remain protected; their full interactive regression is NOT claimed.

## Stage 1 commands

Preparation (no dependency version changes): `npm ci --include=optional --ignore-scripts`.

1. `npm test -w client -- --run overview version.test.ts`
2. `npm test -w server -- --run test/definitionCatalog.test.ts test/definitionRoutes.test.ts test/definitionBindingIntegration.test.ts test/overviewPages.test.ts test/overviewControlStates.test.ts`
3. `npm run typecheck -w client`
4. `npm run typecheck -w server`
5. `npm run build -w client`

Final results are recorded below (2026-09-24). No `npm run check`, full test suite, Server build,
strict hygiene/publish gate or release gate is authorized at this checkpoint.

## Owner manual review — NOT STARTED

- Create both Source kinds in Edit → Manage Source definitions; save, reload/restart and verify IDs.
- Rename without rebinding; duplicate names must remain distinguishable by ID/Workflow.
- Bind monitor/control types; exercise all directions and mismatch/missing-metadata explanations.
- Disable/enable and edit metadata; refresh must not change Page Save status, revision or history.
- Delete via API: binding stays configured and becomes MISSING; same-name recreation must not rebind.
- Load legacy free-text pages: stay DRAFT until explicit selection, with no load-time writes.
- Page Save/Cancel/Undo/Redo and separate Catalog form save/discard semantics.
- BOUND control must display Runtime disabled; clicks affect only existing Preview state.
- Navigation View click selects exact target; Edit click selects Element; missing target gives feedback.
- Revisit Overview without losing session, Preview state or savedViewport.
- Protected selection/drag/eight-handle resize/performance/collision/delete/Page CRUD regression.
- Desktop/tablet accessibility, focus/dialog/keyboard and responsive review at established baseline sizes.
- Workflow selector/autosave/Canvas/runtime isolation, Devices, Audit, Monitor and WebSocket regression.

## Checkpoint disposition

**Stage 1: PASS (2026-09-24).**

| Gate | Result |
|---|---|
| Targeted client + Overview regressions + version | 13 files, **314 tests PASS** |
| Targeted server + Overview regressions | 5 files, **67 tests PASS** |
| Client typecheck | PASS |
| Server typecheck | PASS |
| Client production build | PASS (1,774 modules transformed) |

Total targeted tests: **381 PASS**. New O2-specific files contain 91 client tests and 36 server
tests; the remaining selected tests cover existing Overview behavior and version synchronization
(including one new server-version-surface check).

The first client run exposed an unsupported Vitest matcher in a new test; it was replaced with
supported call-count/argument assertions. Final rerun passed. No failing tests remain in Stage 1.

Non-blocking observations, not suppressed: existing Tooltip SSR `useLayoutEffect` warnings;
Vite warns that the main minified JS bundle is over 500 kB (616.19 kB). Installation reports
7 dependency advisories (5 moderate, 1 high, 1 critical). No dependency versions or lockfile
resolution/integrity entries changed; no `npm audit fix` or security risk acceptance.

Stage 1 does NOT establish browser/hardware/soak/accessibility or full Workflow/Devices
interactive regression. No server/application preview was started for manual review.
Full Gates: NOT RUN — await Owner authorization.
Manual Review: NOT STARTED.
Commit: NOT CREATED. Push: NOT PERFORMED. PR: NOT OPENED.
No O2-B, O2-C or O2-D implementation.

## Changed files at Stage 1 handoff

40 files: 23 modified, 17 new. Build/dependency/runtime artifacts are not tracked.

```text
CHANGELOG.md
README.md
client/package.json
client/src/App.tsx
client/src/components/overview/ElementInspector.tsx
client/src/components/overview/ElementNode.tsx
client/src/components/overview/OverviewCanvas.tsx
client/src/components/overview/OverviewPage.tsx
client/src/lib/overviewApi.ts
client/src/lib/overviewBinding.test.ts
client/src/lib/overviewElements.ts
client/src/lib/overviewState.test.ts
client/src/lib/overviewState.ts
client/src/styles/overview.css
client/src/version.test.ts
client/src/version.ts
docs/CURRENT_STATE.md
docs/ROADMAP.md
package-lock.json
package.json
server/package.json
server/src/index.ts
server/src/overviewPages.ts
client/src/components/overview/DefinitionCatalogEditor.tsx
client/src/components/overview/OverviewBindingO2.test.tsx
client/src/components/overview/SourceBindingFields.tsx
client/src/lib/overviewBinding.ts
client/src/lib/overviewBindingO2.test.ts
client/src/lib/overviewNavigation.test.ts
client/src/lib/overviewNavigation.ts
client/src/lib/overviewProtectedO2.test.ts
client/src/lib/sourceDefinitions.ts
docs/ACCEPTANCE_TESTS/O2-A-v1.4.0-dev.1.md
docs/SCOPE_O2-A_v1.4.0-dev.1.md
server/src/definitionCatalog.ts
server/src/definitionRoutes.ts
server/src/overviewBindingConfig.ts
server/test/definitionBindingIntegration.test.ts
server/test/definitionCatalog.test.ts
server/test/definitionRoutes.test.ts
```
