# Approved Scope v1.2.12 — UI/UX Modernization

Status: **owner-approved. Version split and scope direction confirmed on 2026-09-22, including the
documentation corrections A-H. This file is the repository source of truth for the v1.2.12 scope.**

- Baseline: `main` at `efcd15bda9608a6d68cfbf944b1599d50ff65306` (merge of PR #2, v1.2.11 reliability)
- Protected reliability baseline: v1.2.11 implementation commit `a393cf3f2521abc41d21c13e5e6db02a481aa56a`
- Planning: [PHASE_PLAN_v1.2.12.md](PHASE_PLAN_v1.2.12.md)
- Design contract: [UI_DESIGN_SYSTEM_v1.2.12.md](UI_DESIGN_SYSTEM_v1.2.12.md)
- Baseline inventory: [UI_INVENTORY_v1.2.12.md](UI_INVENTORY_v1.2.12.md)
- Acceptance matrix: [ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md)
- Traceability: [SCOPE_TRACEABILITY_v1.2.12.md](SCOPE_TRACEABILITY_v1.2.12.md)
- Carryover: [ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md),
  [ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md](ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md)

## Goal

Replace the visually dated and crowded frontend with a production-grade, behavior-preserving
industrial control interface: faster to scan, safer to operate, easier to understand — with no
change to workflow, Modbus, persistence, monitor, WebSocket, or safety contracts.

## Version split (approved)

1. **v1.2.12** is UI/UX modernization only; every existing behavior is preserved.
2. The cross-workflow Variable requirement moves to **v1.3.0** as `Publish Variable` /
   `Read Variable`.
3. The Variable requirement is **Deferred, not Cancelled**. It stays on the roadmap with its own
   planning and acceptance PR, and no part of it may be implemented in v1.2.12.

## Approved UI direction

- Restrained dark-first Industrial Cyberpunk
- Glassmorphism only on key surfaces (shell, command bar, modal, floating status/inspector), never
  on every card or control
- Production-grade hierarchy, spacing, typography, and interaction
- Desktop plus tablet landscape, minimum planning breakpoint about 1024 px
- WCAG AA contrast, visible keyboard focus, `prefers-reduced-motion` support
- Segmented top Workflow command bar

## Version timing (decision F)

- The version is bumped to `1.2.12` in the **first implementation commit** of Milestone 1.
- From that commit onward, the version stays identical and synchronized across: root
  `package.json`, `client/package.json`, `server/package.json`, `package-lock.json`, the UI version
  label, the server startup banner, and `GET /api/health`.
- Documentation version references are updated as each document is touched and finalized at release
  closure.
- **No tag and no release ZIP may be created before the final release gate passes** and the owner
  approves.

## 1. Design system and frontend structure

- Shared design tokens for color, typography, spacing, radius, elevation, border, focus, state, motion
- Consistent button, icon-button, input, select, card, table, badge, status, modal, toast, empty,
  loading, and error components
- Preserve the bundled Google Sans fonts and offline operation
- Behavior-preserving decomposition of `client/src/App.tsx` into reviewable components/hooks/metadata
- No framework replacement; any new dependency needs justification, lockfile review, audit review,
  and acceptance coverage

## 2. Application shell

- Redesigned sidebar/navigation with clear active-page treatment (`aria-current`)
- Clear page title, context, status, and action hierarchy
- Consistent density for industrial operational data
- Visible application connection state: `LIVE`, `RECONNECTING`, `OFFLINE` as a dedicated status pill,
  derived only from the existing reconnect state
- No hard-coded browser localhost dependency (relative REST/WebSocket URLs)
- Desktop and tablet-landscape layouts

## 3. Segmented Workflow command bar

1. **Workflow management**: selector, Add, Rename, Duplicate, Delete
2. **Editing**: visible Undo, Redo, Fit View, plus save/revision status
3. **Mode and safety**: `DESIGN`, `SIMULATION`, `LIVE_LOCKED`, `LIVE_ARMED` plus relevant warnings
4. **Runtime**: Run, Stop, and a separately emphasized `Stop All` danger action

### Editing controls (decision C)

- Visible Undo, Redo, and Fit View controls are **added to scope**, implemented on top of the
  existing logic only:
  - Undo/Redo call the existing `undoHistoryRef` / `redoHistoryRef` snapshot stacks
    (`restoreSnapshot('undo' | 'redo')`).
  - Fit View uses the existing React Flow viewport API.
- Existing keyboard shortcuts (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`, `Delete`/`Backspace`,
  `Escape`) are preserved unchanged.
- Existing history semantics are preserved: one snapshot per mutation, redo stack cleared on a new
  mutation, snapshots persisted through the existing `persist()` path.
- React Flow state ownership is preserved; no second history model, no new state owner, and no
  change to `onNodesChange` / `onEdgesChange` / `onConnect` / drag-persist behavior.
- **Fit View must not mutate persisted node positions** and must not trigger a save, revision bump,
  or `PUT /api/workflows/:id`.
- Enabled/disabled states must be explicit and correct (Undo disabled with an empty undo stack, Redo
  disabled with an empty redo stack, both re-evaluated on workflow switch), and button/shortcut
  behavior must be at parity.
- Acceptance: v1.2.12-D14, D15, D16, D17, D18.

The layout must reduce accidental activation and stay usable with long workflow names.

## 4. Application dialogs and feedback

Replace all 15 native dialog call sites (3 `prompt`, 8 `confirm`, 4 `alert` — see
[UI_INVENTORY_v1.2.12.md §3](UI_INVENTORY_v1.2.12.md)) with application UI: form modal,
confirmation modal, destructive confirmation, toast/notification, inline validation, loading and
disabled states, error summary, focus trap, focus restoration, and safe `Escape` behavior. This
includes Workflow Add/Rename/Duplicate/Delete and every other native popup. While a modal is open,
canvas keyboard shortcuts must be suppressed. No surface may report success for an operation the
backend did not perform.

## 5. Workflow Block Library

- Modern interactive block cards with icon, title, and concise purpose
- Logical categories with collapse/expand behavior
- Accessible hover, active, focus, and disabled states
- Clear affordance for adding a block
- Every existing block type (48) and the existing add behavior preserved
- **Search/filter (decision D): optional enhancement and non-blocking.** It is not mandatory scope
  and not a release gate. If implemented it must be client-side only, must not change add behavior,
  and no acceptance row may depend on it.

## 6. Parameters inspector

For every block type, display centrally managed metadata below `PARAMETERS` and above Block Name:
block title, English explanation, Thai explanation, input/output behavior, and a safety note where
relevant. Metadata must live in one central module and must not be duplicated across unrelated JSX
branches.

## 7. Duplicate Block

Exposed in the Inspector next to `Delete Block` and as a node quick action next to the trash action.
Required behavior: new node ID, copied type and all parameters, deterministic unique `Copy` name,
offset position from the source, no copied incoming/outgoing edges, dynamic ports preserved or
recreated from the copied configuration, Undo/Redo support, and an unchanged source node.

## 8. Function Block layout

Separate header, content, status, ports, and quick-action zones; prevent title, label, symbol,
action, and handle overlap; truncate long names with an accessible full-name affordance; keep quick
actions away from React Flow handles; preserve live values, status lamps, animated flow, and dynamic
ports; remain readable at 90%, 100%, 110%, and 125% zoom.

## 9. Devices page

Complete presentation redesign while preserving list and selection, add/edit/delete,
connect/disconnect, desired and actual state, endpoint and timing configuration, queue/runtime
diagnostics, timeout/error state, workflow reference handling, and all current API contracts and
validation. Field labels become human-readable while payloads, keys, and editability (including the
editable `id`) stay exactly as in the baseline.

## 10. Remaining pages

Redesign without functional loss: Modbus Monitor, Runtime Monitor, Traffic Monitor, Audit Log,
Validation, Project Settings. Preserve filters, links, CSV export, monitor actions, diagnostics,
state transitions, and safety visibility.

### Traffic Monitor (decision B)

- The baseline UI has **no Traffic Clear action**; `DELETE /api/traffic` exists server-side but is
  unused by the client.
- **Adding a Clear button is not approved in v1.2.12.** The route stays untouched and unused.
- Preserve existing events, ordering, columns, values, timestamps, filters, links, and display
  behavior.
- Acceptance v1.2.12-E08 was corrected accordingly (the previous "clear behavior" criterion is
  removed).

### Project Settings (decision A)

Baseline truth: the page is a non-functional mock — nine labels rendered from a string array with
`defaultValue`, one `defaultChecked` checkbox, and a `SAVE SETTINGS` button with no handler and no
API call. Nothing loads and nothing persists. `PUT /api/workflow` accepts a `settings` object but the
UI never calls it.

v1.2.12 scope for this page:

- **Redesign UI only.**
- Preserve the existing displayed fields and their defaults exactly.
- **No settings API** — no new endpoint, no call to `PUT /api/workflow` or any other route.
- **No persistence schema change, no migration, no backend storage.**
- **No false successful-save state** — no "Saved" toast, no saved indicator, no persisted badge, no
  implied write.
- **Clearly communicate non-persistent behavior** with a permanent visible notice on the page and an
  explicit description on the save control.
- Preserve the existing safety notice (no authentication; writes disabled unless
  `ALLOW_WRITES=true`).
- Acceptance v1.2.12-E11 was rewritten to match this baseline instead of asserting load/save.

Wiring Project Settings to real persistence is **out of scope** and would require a separate
approved scope change (candidate for a later version).

## 11. Responsive and accessibility target

- Desktop 1366x768 through large displays; tablet landscape about 1024 px and above
- WCAG AA contrast, keyboard-operable controls, visible focus, reduced-motion support
- No unintended clipping or overlap at target viewports and zoom levels
- Mobile-phone workflow editing is out of scope

## Protected behavior (no change without new scope approval)

- React Flow node/edge/dynamic-port semantics
- Workflow CRUD, revision, save/reload, Undo/Redo history semantics
- Workflow runtime evaluation and concurrent isolation
- REST/WebSocket paths and authoritative resync behavior
- Modbus FC/address/frame semantics
- Monitor single-flight, pending, generation, cancellation, and queue policy
- `ALLOW_WRITES`, modes, ownership, priority writes, write-on-change, read-back
- Read-only Modbus Monitor
- Persistence schema and runtime restoration behavior

## Explicit exclusions

v1.2.12 must not add or change: Publish Variable / Read Variable or any cross-workflow signal
runtime · Modbus function codes, addressing, frame encoding, retry, timeout, or queue semantics ·
workflow evaluation/runtime semantics · workflow persistence schema (unless a UI-only migration is
explicitly approved) · monitor single-flight, cancellation, generation, or queue policy · WebSocket
queue, reconnect, resync, or revision semantics · output ownership, `ALLOW_WRITES`, modes,
write-on-change, read-back, or safety guards · writes from Modbus Monitor · a Traffic Monitor clear
action · Project Settings persistence or any settings API · authentication/authorization ·
Modbus Multi Output · historical trending · release tags before full acceptance.

## Acceptance classification (decision G)

Every acceptance row is classified as exactly one of:

- **Mandatory for merge** (`M-MERGE`)
- **Mandatory for release** (`M-REL`)
- **Conditional when environment is available** (`COND`)
- **Non-blocking evidence** (`NB`)

Hardware and extended-soak rows without an available environment must remain `NOT RUN` and must
never be converted to `PASS`.

## Acceptance carryover (decision H)

The following v1.2.11 behaviors must be **preserved and rerun after the UI modernization**:

1. Monitor one-in-flight / one-pending behavior
2. Coalescing and bounded queue
3. No stale publication after Stop
4. No stale publication after Disconnect
5. No Monitor auto-start after Device reconnect
6. Safe repeated-Stop behavior (externally idempotent; internal generation may advance)
7. Same `DATA_DIR` persistence and safe runtime restoration
8. Browser reconnect without duplicates
9. Write-disabled safety (`ALLOW_WRITES=false`)
10. Approved simulator write tests (isolated non-production fixture only)
11. Relevant load and pressure tests (multiple lists plus workflow reads, slow WebSocket consumer,
    soak, memory/handle trend)

Rows 1-7 and 9-11 are `COND` (they need the approved simulator, capture tool, or hardware); row 8 is
`M-MERGE`. None may be reported as `PASS` until executed against v1.2.12.

Audit snapshot (reproduced 2026-09-22): full graph 5 moderate / 1 high / 1 critical; production-only
2 moderate (`express` through `qs`). `npm audit fix --force` must not be run without reporting and
obtaining approval for the resulting dependency and scope change. Remediation or an explicit reviewed
risk acceptance is a mandatory pre-release gate.

## v1.3.0 boundary (deferred requirement)

Cross-workflow variables remain a separate version with explicit `Publish Variable` and
`Read Variable` blocks, Boolean/Number types, stable project-level Variable ID/registry, one
publisher per ID, multiple readers, value/quality/timestamp/sequence propagation, fail-safe
`MISSING`/`STOPPED`/`BAD` states (unavailable sources never reported as `GOOD`), no persisted live
values, dependency graph validation, and circular-dependency protection. Existing Modbus output
ownership, mode, write-on-change, read-back, and write guards remain mandatory there.
