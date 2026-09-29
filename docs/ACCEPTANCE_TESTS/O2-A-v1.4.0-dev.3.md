# O2-A UX and Selection punchlist — v1.4.0-dev.3

> Historical checkpoint: Owner subsequently reviewed dev.3 **APPROVED WITH PUNCHLIST**.
> Current follow-up acceptance is [dev.4](O2-A-v1.4.0-dev.4.md); older pending entries below are historical.

Base: `4c73b1e82db050224d7599e0357bd323f5c6b961`, v1.4.0-dev.2.
Branch: `arena/01a0d291-modbus-workflow-studio`. Owner review of base: **APPROVED WITH PUNCHLIST**.

## Scope and protection

Frontend-only configuration UX: Data Sources search/source/status filters, readable metadata table,
on-demand saved-reference counts, direct Enable/Disable, focused Create/Edit form and accessibility.
Inspector fields are grouped into Element, Geometry, Appearance, Text, Binding or Navigation, Actions.
No selected Element shows a compact neutral empty state without stale property inputs.
All field meanings, validation, Draft/Undo and Font Size transactions remain unchanged.

No API/persistence/identity/resolver/reference-calculation change. Server index changes are limited
to the three required application version strings (health, hello and banner). Dependency versions,
resolution and integrity remain unchanged. No O2-B, Picture Box/O2-C expansion, O2-D, Runtime Tag values,
Monitoring transport, new Modbus acquisition, MQTT/Sparkplug or Production Control.

## Selection investigation — NOT REPRODUCED (limited to component/event evidence)

Before implementation, 10 baseline investigation tests passed against the dev.2 Canvas/Node behavior.
The actual registered React Flow callbacks were exercised through a component harness. Scenarios:
A → B node click; select-false A/select-true B ordering; blank-pane deselect; Font Size commit followed
by B selection; multi-Element font overlay isolation; updated callbacks after rerender; resize dimension
updates; View Mode ignoring selection; Edit child controls (Push Button/Switch/Navigation) are spans;
selected-only NodeResizer and non-intercepting overlay badges.

Source inspection covered onNodeClick/onPaneClick, select-false handling, node reuse/callback freshness,
Inspector commit/blur wiring, NodeResizer visibility, pointer-events/z-index, and the render-only Draft
overlay. The pane handler is the explicit null-selection route; node selection directly calls the Page
selection setter, without Draft/history/revision/API work.

This environment has no browser executable or browser automation dependency. The callback/SSR harness
is **not** a real pointer hit-test or browser blur-order reproduction. The intermittent browser symptom
remains NOT REPRODUCED, not claimed fixed. Therefore Canvas, ElementNode, Page selection wiring, event
propagation and the Font Size transaction implementation are left unchanged. No duplicate handlers added.

## Automated checks and evidence

- `OverviewSelectionUX.test.tsx`: baseline callback investigation and selection isolation.
- `definitionList.test.ts`: search/type/status combinations, immutable inputs, exact identity row keys.
- `DataSourcesUX.test.tsx`: load/search/filter, direct Edit/Enable/Disable, existing Delete dialog,
  on-demand reference count, empty/error states, Create/Edit requests, validation associations,
  initial focus/Tab/Escape/focus return through the existing Modal event harness.
- `InspectorUX.test.tsx`: empty/selected/deselected/reselected markup, grouping, preserved fields,
  navigation-only group, locked Delete, responsive normal-flow and safe ID wrapping.
- Existing O1/O2-A tests remain part of Stage 1/regression coverage. Runtime functionality is untouched.

Stage 1 and Full Gate execution results are recorded in the delivery handoff. No browser/manual test
is implied by passing unit, SSR or source-contract tests. Current-environment /tmp recovery evidence
is not durable across Sandbox recreation.

## Owner Local Manual Review — PENDING

- Reproduce rapid A → B selection on the Owner browser, including Inspector input blur/Enter,
  active Font Size preview, child controls, overlapping/rotated Elements and resize handles.
- Blank Canvas hides selected-Element fields; selecting B restores B immediately. No unintended
  deselect while editing, opening selectors/dialogs, resizing, dragging or visiting Data Sources.
- Search/type/status filters, list density, stable-ID disclosure, on-demand counts and responsive scroll.
- Create/Edit and direct Enable/Disable for both source types; field validation, keyboard navigation,
  focus return after Save/Cancel, and Create fallback focus when the invoking Delete row is removed.
- Delete confirmation, saved-reference impact, unsaved-Draft exclusion and unchanged stored IDs/MISSING.
- Font Size immediate rendering, no leakage to unrelated Elements, one Enter+blur commit/Undo,
  Page Cancel restoration, Save/reload persistence and independent Preview state.
- Inspector spacing, applicable groups, safe wrapping and no Canvas-covering layout.
- Direct O1/O2-A regression: View/Edit, Page CRUD, Draft/Save/Cancel, Undo/Redo, drag/resize/collision,
  savedViewport, Navigation, Workflow, Devices, Modbus safety and WebSocket reliability.

## Known warnings / risks

SSR useLayoutEffect and Vite JavaScript bundle-size warnings may remain.
Dependency advisories: **5 moderate, 1 high, 1 critical** — **Not resolved, Not accepted,
Not part of this Punchlist**. No audit fix or dependency upgrade is authorized.
