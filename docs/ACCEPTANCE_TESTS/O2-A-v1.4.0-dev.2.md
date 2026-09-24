# O2-A punchlist acceptance — v1.4.0-dev.2

Base: Remote `fa2ac89e1f4582df5f6cdda7fe8b6de40fd91390`, v1.4.0-dev.1.
Owner review of base: **APPROVED WITH PUNCHLIST**.
[Approved punchlist scope](../SCOPE_O2-A_PUNCHLIST_v1.4.0-dev.2.md).

## Automated coverage (executed; browser interaction remains pending)

| File | Coverage |
|---|---|
| `server/test/definitionReferences.test.ts` | Both source types; saved counts/identity isolation; GET is read-only; Delete preserves Page bytes/revisions and resolver returns MISSING; missing source 404; legacy/navigation/other Workflow excluded |
| `server/test/definitionRoutes.test.ts` | Existing CRUD/error tests wired to real reference reader |
| `client/src/components/sources/DataSourcesPage.test.tsx` | Sidebar/page/Overview shortcut, metadata editing both types, impact labels/counts/caveat, explicit confirmation guard, no Runtime paths |
| `client/src/lib/definitionDeleteApi.test.ts` | Exact stable identity GET/DELETE paths and storage failure propagation |
| `client/src/lib/overviewFontDraft.test.ts` | 12 text-bearing types, immediate overlay without mutation, one commit, Enter+blur coalescing, invalid/Escape/reset, Undo/Redo/Save roundtrip/Cancel, locked/View guard, Preview boundary |
| Existing Overview / binding / protected App tests | Retained (only current version expectations updated) |

## Accepted Stage 1 record (preserved, not rerun during delivery)

| Check | Accepted result |
|---|---|
| Targeted Client tests | 348 PASS / 16 files |
| Targeted Server tests | 71 PASS / 6 files |
| Client typecheck | PASS |
| Server typecheck | PASS |
| Client build | PASS |

The Owner accepted these results and moved missing multi-Element browser interaction coverage to
Owner Local Manual Review. SSR/source guards and pure state/serialization tests are not browser tests.

## Atomic recovery and delivery validation

- Verified actual Remote `fa2ac89e1f4582df5f6cdda7fe8b6de40fd91390`; fetched the approved branch once
  because the object was missing in the recreated environment. Exported it with `git archive`.
- File-by-file comparison: exactly 32 approved differences (21 modified / 11 new); no unexpected
  or missing Source. The old-HEAD 52-path status included 20 paths already identical to the checkpoint.
- External evidence and backups apply only to the current execution environment. No durability
  across Sandbox recreation is claimed.
- Used Compare-and-swap `git update-ref` and `git read-tree` without `-u`, never reset/clean/restore.
  Recovery retained all 52/52 backed-up file hashes and all 176/176 nonignored Source hashes.
- Authorized `npm ci --include=optional --ignore-scripts` ran exactly once and succeeded (249 packages).
  All Source/package/lock bytes remained unchanged after installation. node_modules is ignored/untracked.
- Documentation validation records were then updated within the same approved 32-file scope.
  No implementation correction or validation retry was needed for the completed commands below.

| Executed Full Gate command | Actual result |
|---|---|
| `npm test -w client -- --run` | 422 PASS / 26 files |
| `npm test -w server -- --run` | 84 PASS / 9 files |
| `npm run check` | PASS: both typechecks, Server 84 / Client 422 tests, both builds |

The remaining required Gates are strict hygiene, `npm run verify:publish` and `git diff --check`.
Their execution results and the verified Remote delivery SHA are recorded in the Owner handoff;
commit/push are permitted only after every Gate and final diff verification succeeds. Passing commands
must not be manually repeated; the tests/builds inside `npm run check` are its normal contract.
No standalone Stage 1 command was rerun in this delivery pass.

## Warnings and limits

- SSR `useLayoutEffect` warning from Tooltip/command-bar markup tests.
- Vite JavaScript chunk warning: 623.52 kB minified (181.66 kB gzip), above the 500 kB threshold.
- Dependency advisories: **5 moderate, 1 high, 1 critical** — **Not resolved, Not accepted,
  Not part of this Punchlist**. No dependency upgrade, audit fix or resolution/integrity change.
- No browser/manual/hardware acceptance or Production Runtime is claimed.
- **Owner Local Manual Review = PENDING**. No PR, Tag, Release or ZIP is authorized.

## Owner local review checklist — all items PENDING

- Open Data Sources directly from sidebar, without first opening Overview or entering Edit.
- Create/read/edit/rename/enable/disable both Source types; UUID and owning Workflow immutable.
- Bind the same definition on multiple pages/elements; inspect Delete summary for Page/Element
  IDs/names/counts. Name-only legacy, other Workflow, other source type and navigation must not count.
- Open/Cancel Delete: no definition, Page, revision, binding or Preview-state change.
- Confirm Delete: definition disappears; existing binding IDs are untouched and show MISSING after
  Catalog refresh. Recreate same name: does not rebind. Verify storage/API errors do not show success.
- Unsaved Draft references are explicitly not included in Server impact; returning from Data Sources
  preserves that Draft and its Undo, while resolution refreshes independently.
- Type/spin Font Size on Numeric/Text/Status/Badge/controls/navigation/static text/Panel/Rectangle
  and existing picture/image placeholder text. Content must change before blur; safety badges remain legible.
- Multiple Elements must not share or leak the active Font Size preview; this remains an Owner browser test.
- One Enter or blur commits one changed property; Enter+blur is not two Undo entries. Undo/Redo,
  invalid/empty/range input, Escape, element switching and locked elements behave correctly.
- Font editing sends no Page request until Save; Save/reload keeps size; Cancel restores baseline.
- BOUND monitoring content remains EDITOR PREVIEW, not a Runtime value. Preview controls stay isolated.
- Recheck Page CRUD, View/Edit, selection/drag/resize/collision/delete/savedViewport and keyboard/focus.
- Workflow, Devices, runtime isolation, Modbus safety and WebSocket behavior must remain unchanged.
