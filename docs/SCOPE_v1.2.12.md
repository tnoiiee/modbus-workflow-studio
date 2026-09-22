# Approved Scope v1.2.12 — UI/UX Modernization

Status: **owner direction approved (handoff bundle, 2026-09-22); this file is the repository
source of truth for the v1.2.12 scope.**

- Baseline: `main` at `efcd15bda9608a6d68cfbf944b1599d50ff65306` (merge of PR #2, v1.2.11 reliability)
- Protected reliability baseline: v1.2.11 implementation commit `a393cf3f2521abc41d21c13e5e6db02a481aa56a`
- Planning documents: [PHASE_PLAN_v1.2.12.md](PHASE_PLAN_v1.2.12.md),
  [UI_DESIGN_SYSTEM_v1.2.12.md](UI_DESIGN_SYSTEM_v1.2.12.md),
  [UI_INVENTORY_v1.2.12.md](UI_INVENTORY_v1.2.12.md)
- Acceptance matrix: [ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md)
- Carryover: [ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md),
  [ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md](ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md)

## Goal

Replace the visually dated and crowded frontend with a production-grade, behavior-preserving
industrial control interface: faster to scan, safer to operate, easier to understand — with no
change to workflow, Modbus, persistence, monitor, WebSocket, or safety contracts.

## Version split (approved)

- **v1.2.12** — UI/UX modernization only; every existing behavior is preserved.
- **v1.3.0** — cross-workflow `Publish Variable` / `Read Variable`; must not appear in v1.2.12.

## Approved UI direction

- Restrained dark-first Industrial Cyberpunk
- Glassmorphism only on key surfaces (shell, command bar, modal, floating status/inspector), never
  on every card or control
- Production-grade hierarchy, spacing, typography, and interaction
- Desktop plus tablet landscape, minimum planning breakpoint ≈ 1024 px
- WCAG AA contrast, visible keyboard focus, `prefers-reduced-motion` support
- Segmented top Workflow command bar

## 1. Design system and frontend structure

- Shared design tokens for color, typography, spacing, radius, elevation, border, focus, state, motion
- Consistent button, icon-button, input, select, card, table, badge, status, modal, toast, empty,
  loading, and error components
- Preserve the bundled Google Sans fonts and offline operation
- Behavior-preserving decomposition of `client/src/App.tsx` into reviewable components/hooks/metadata
- No framework replacement; any new dependency needs justification, lockfile review, audit review,
  and acceptance coverage

## 2. Application shell

- Redesigned sidebar/navigation with clear active-page treatment
- Clear page title, context, status, and action hierarchy
- Consistent density for industrial operational data
- Visible application connection state: `LIVE`, `RECONNECTING`, `OFFLINE` (derived only from the
  existing reconnect state)
- No hard-coded browser localhost dependency (relative REST/WebSocket URLs)
- Desktop and tablet-landscape layouts

## 3. Segmented Workflow command bar

1. Workflow management: selector, Add, Rename, Duplicate, Delete
2. Editing: Undo, Redo, Fit View, save/revision status
3. Mode and safety: `DESIGN`, `SIMULATION`, `LIVE_LOCKED`, `LIVE_ARMED` plus relevant warnings
4. Runtime: Run, Stop, and a separately emphasized `Stop All` danger action

The layout must reduce accidental activation and stay usable with long workflow names.

## 4. Application dialogs and feedback

Replace all 15 native dialog call sites (3 `prompt`, 8 `confirm`, 4 `alert` — see
[UI_INVENTORY_v1.2.12.md §3](UI_INVENTORY_v1.2.12.md)) with application UI: form modal,
confirmation modal, destructive confirmation, toast/notification, inline validation, loading and
disabled states, error summary, focus trap, focus restoration, and safe `Escape` behavior. This
includes Workflow Add/Rename/Duplicate/Delete and every other native popup.

## 5. Workflow Block Library

- Modern interactive block cards with icon, title, and concise purpose
- Logical categories with collapse/expand behavior
- Accessible hover, active, focus, and disabled states
- Clear affordance for adding a block
- Every existing block type (48) and the existing add behavior preserved
- Search/filter may be proposed during planning but is **not** mandatory unless approved

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
validation.

## 10. Remaining pages

Redesign without functional loss: Modbus Monitor, Runtime Monitor, Traffic Monitor, Audit Log,
Validation, Project Settings. Preserve filters, links, CSV export, monitor actions, diagnostics,
state transitions, and safety visibility.

## 11. Responsive and accessibility target

- Desktop 1366×768 through large displays; tablet landscape ≈ 1024 px and above
- WCAG AA contrast, keyboard-operable controls, visible focus, reduced-motion support
- No unintended clipping or overlap at target viewports and zoom levels
- Mobile-phone workflow editing is out of scope

## Protected behavior (no change without new scope approval)

- React Flow node/edge/dynamic-port semantics
- Workflow CRUD, revision, save/reload, Undo/Redo
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
write-on-change, read-back, or safety guards · writes from Modbus Monitor ·
authentication/authorization · Modbus Multi Output · historical trending · release tags before full
acceptance.

## Acceptance carryover

Every v1.2.11 `PENDING` / `NOT RUN` row is carried into v1.2.12 and must not be reported as `PASS`
until actually executed: full UI regression, write-disabled safety, isolated simulator write tests,
multiple monitor lists plus workflow reads, slow WebSocket consumer, soak/memory/handle trend,
frame capture/hardware, and dependency security disposition.

Audit snapshot (reproduced on 2026-09-22): full graph 5 moderate / 1 high / 1 critical;
production-only 2 moderate (`express` through `qs`). `npm audit fix --force` must not be run without
reporting and obtaining approval for the resulting dependency and scope change.

## v1.3.0 boundary

Cross-workflow variables remain a separate version with explicit `Publish Variable` and
`Read Variable` blocks, Boolean/Number types, one publisher per ID, multiple readers, fail-safe
unavailable-source quality, no persisted live values, dependency graph validation, and
circular-dependency protection.
