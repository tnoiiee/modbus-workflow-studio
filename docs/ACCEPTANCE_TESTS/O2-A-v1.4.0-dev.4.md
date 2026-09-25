# O2-A v1.4.0-dev.4 — final workspace UX acceptance

- Branch: `arena/01a0d291-modbus-workflow-studio`.
- Approved base: `c8ef28b6c9d2160334d97565ae558d7cb03d891a`, v1.4.0-dev.3.
- Owner dev.3 review: **APPROVED WITH PUNCHLIST**; dev.4 Owner Manual Review **PENDING**.
- Frontend UX only, except synchronized application versions and docs/tests. No dependency changes.
- PR NOT OPENED; O2-B/O2-C/O2-D NOT STARTED. No Tag, Release or ZIP.

## Before-edit grid investigation and bounded fix

Inspected App's persistent Overview host (mounted before Workflow, `display:none` when away),
Overview EDIT-only Background, Workflow's existing `<Background gap={16}/>` and the installed
`@xyflow/react` Background implementation. It builds `pattern-${rfId}${id}`; independent default
providers both produce `pattern-1` when no Background ID is supplied. No scoped/global grid
hiding rule was identified; neither grid's color nor Workflow lifecycle was changed.

Before Source edits, executable `renderToStaticMarkup` of the actual installed Background in two
independent providers, hidden Overview first then visible Workflow, produced:

- pattern IDs: `[pattern-1, pattern-1]`
- rect fills: `[url(#pattern-1), url(#pattern-1)]`

**REPRODUCED AND FIXED: SVG pattern-ID collision.** The Workflow URL could resolve to the first,
hidden Overview definition. The fix is ONLY `id="overview-editor-grid"` on Overview's existing
Background. No Workflow Canvas edit, second grid, new fitView, viewport reset or state recreation.
Regression tests retain the old collision fixture and exercise unique IDs through repeated
Workflow → Overview VIEW → EDIT → Workflow and fresh-mount fixture sequences.

**Evidence limit:** this environment has no Chromium/Firefox browser. SSR proves duplicate SVG
IDs and corrected URL ownership, not disappearing pixels, browser navigation/refresh timing,
layout width, real pointer movements or native focus. Those remain Owner manual checks; no
claim of visual browser reproduction or browser PASS is made.

## Automated coverage

- Selection/drag: first unselected nodes non-draggable; RF echoes ignored; A→B click exactly once;
  tiny/stale unselected position changes cannot mutate geometry; unselected nodes retain `nopan`
  so native selection clicks are not consumed by canvas pan; selected unlocked drag commits
  once; locked/View boundaries; keyboard Enter/Space; no duplicate pointer click handler.
- Inspector: actual Page hook/event harness loads a Page, enters Edit, selects A, clears and selects
  B; entire panel/rail absent when empty, correct fields return, same elements/viewport/restore epoch,
  unchanged history/save status/revision and no API writes. Input patch, drag, resize and Data Sources
  hide/show keep selection. CSS releases the Inspector track; manual collapse preference retained.
- Grid: installed component SSR collision and unique-ID repeated navigation/fresh-mount fixtures;
  protected Workflow/Devices/selector hashes stay at the approved baseline.
- Data Sources: exact full shell description, toolbar DOM order/names, native table roles/headers,
  source/status/search filtering, named Edit/Enable/Disable/Delete, exact Unit preservation,
  explicit non-color status, on-demand existing saved-reference API, responsive row detail CSS.
- Existing Create/Edit/Delete and Modal focus-cycle/return, error/retry, API/CRUD/MISSING,
  binding/resolver, Font Size liveDraft/one-Undo, View/Edit, resize, savedViewport, independent
  Control Preview, navigation and Workflow/Devices regressions remain covered by full suites.

Callback/SSR/source-contract checks are deliberately not labelled browser/a11y-tool evidence.
Executed validation (2026-09-25):

| Gate | Result |
| --- | --- |
| Stage 1 targeted Client UX/selection/grid | PASS — 403 tests / 21 files |
| Client typecheck | PASS on one authorized retry (see below) |
| Server typecheck | PASS |
| Client build | PASS |
| Full Client | PASS — 481 tests / 32 files |
| Full Server | PASS — 84 tests / 9 files |
| `npm run check` | PASS — both typechecks, full suites and both builds |

The initial Client typecheck reported TS2769 because the imported React `KeyboardEvent` type
shadowed the existing native window resize-Escape event type. One targeted type-only alias
(`ReactKeyboardEvent`) and exactly one retry passed. Server typecheck/build had not run before
that retry. No runtime event behavior was changed by the type correction.

Final review retained React Flow's `nopan` on unselected nodes and added focus fallback when an
edited row no longer exists. Full Client and `check` validated these final changes, including the
new fallback regression. The earlier passing Stage 1 command was not unnecessarily repeated.
Final strict hygiene, publish verification, diff/scope and actual Remote equality are reported in
the delivery handoff after final documentation verification. Build output stays ignored.
Final JS bundle: 630.98 kB minified; bundle-size advisory remains.

## Owner local manual checklist — all PENDING

1. Edit with no selection: pointer down and tiny movement on A only selects A; no movement,
   dirty/Undo/revision/API change. Drag A subsequently; one Undo restores the entire gesture.
2. A→B takes one click and never moves B. Locked and VIEW nodes cannot drag. Blank Canvas alone
   deselects; keyboard selection, selected drag and resize remain usable.
3. Blank Canvas removes the entire Inspector including its header/rail and returns horizontal space.
   Keep exact pan/zoom and element geometry. Reselect shows current fields immediately with no
   stale content. Test collapsed Library/Inspector, inputs/selects/dialogs and Data Sources return.
4. Workflow grid → Overview → Edit → Workflow; repeat and refresh. Verify grid, original viewport,
   MiniMap, selection, workflows, runtime state and autosave/revision are unaffected.
5. Data Sources: title `Data Sources`; full sentence `Manage configuration definitions for Workflow
   Variables and Shared Tags.` No title-area Refresh/Create and no truncation/hidden description.
6. At desktop, 1000/900/520px and narrow browser widths, toolbar wraps intentionally; search is
   flexible, all status/actions remain visible, rows reflow, no page overflow or clipped critical data.
7. Keyboard filters/search/row actions/Stable ID; focus visible. Create/Edit/Delete open, cancel/save
   and return focus appropriately; no trap. Check renamed/filtered-away or deleted row invokers.
8. Metadata-only notice readable. CRUD, Enable/Disable, Delete confirmation/impact and MISSING
   semantics use existing APIs. Unit values and Stable IDs remain exact; references are not invented.
9. Binding states and BOUND + EDITOR PREVIEW retained. CONTROL RUNTIME NOT ENABLED; no live
   values or writes. Check Font Size immediate preview, Save/Cancel, Undo/Redo, Page CRUD,
   savedViewport, independent Preview controls, navigation, Workflow and Devices.

## Protected boundaries and warnings

No Server/API behavior change; no resolver/reference/persistence/identity normalization;
no runtime acquisition/polling/REST snapshots/WS deltas, Picture Box, production commands,
MQTT/Sparkplug, historian, authorization/interlocks/queues or LIVE/ARMED implementation.
Existing transport-neutral future architecture remains future, with no new core dependencies.

Dependency advisories: **5 moderate, 1 high, 1 critical — Not resolved / Not accepted /
Not part of this Punchlist**. Known SSR useLayoutEffect and JS bundle-size warnings are nonfatal.
