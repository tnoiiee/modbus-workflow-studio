# Roadmap

## v1.2.11: Monitor Scheduler & WebSocket Reliability — source complete

Delivered through follow-up PR #2 from source commit `a393cf3f2521abc41d21c13e5e6db02a481aa56a`:

- Single-flight monitor scheduling with one in-flight scan and one pending scan per list
- Idempotent externally observable Start/Stop state, generation guards, cancellation, disconnect invalidation, and stale-publication suppression
- Bounded per-device monitor admission with coalescing/drop diagnostics
- Workflow-read and priority-write ordering ahead of monitor pressure
- Per-client WebSocket message/byte bounds, telemetry coalescing/drop handling, and state resync signaling
- Client duplicate-socket prevention, jittered reconnect, and revision-safe REST resynchronization

Automated, CI, and selected local simulator/browser reliability scenarios passed. The project owner moved the remaining frontend regression, write-safety, mixed-load, soak, slow-consumer, frame-capture, hardware, and security-disposition gates into v1.2.12 so they are run once against the redesigned frontend.

v1.2.11 is a source baseline only. It does not receive a standalone release tag or ZIP. See [acceptance status](ACCEPTANCE_TESTS/v1.2.11.md) and [local evidence](ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md).

## v1.2.12: UI/UX Modernization — approved scope, planning complete

Behavior-preserving frontend modernization. Source of truth: [SCOPE_v1.2.12.md](SCOPE_v1.2.12.md),
[UI_DESIGN_SYSTEM_v1.2.12.md](UI_DESIGN_SYSTEM_v1.2.12.md),
[PHASE_PLAN_v1.2.12.md](PHASE_PLAN_v1.2.12.md),
[SCOPE_TRACEABILITY_v1.2.12.md](SCOPE_TRACEABILITY_v1.2.12.md),
[ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md).

- Restrained dark-first Industrial Cyberpunk design system with selective glass surfaces
- Desktop and tablet-landscape layouts with WCAG AA contrast, keyboard focus, and reduced-motion support
- Segmented Workflow command bar for Workflow CRUD, edit tools, mode/safety, and runtime controls
- **Visible Undo, Redo, and Fit View controls built on the existing logic**, with keyboard shortcuts,
  history semantics, and React Flow state ownership preserved; Fit View must not mutate persisted positions
- Application modal, confirmation, toast, validation, loading, and error patterns replacing all 15 native browser dialog sites
- Categorized collapsible Block Library with modern interactive cards (search/filter is an optional, non-blocking enhancement)
- English and Thai block descriptions in the Parameters inspector from one central metadata module
- Duplicate Block in the inspector and node quick actions: new ID, copied parameters, offset position, no copied edges
- Function Block layout that prevents label/action/port overlap
- Complete visual redesign of Devices, Modbus Monitor, Runtime Monitor, Traffic Monitor, Audit Log, Validation, and Project Settings
- Project Settings is redesigned **UI-only**: no settings API, no persistence, no false successful-save state, and an explicit non-persistent notice
- Traffic Monitor keeps the baseline behavior: **no Traffic Clear action is added**
- Visible `LIVE`, `RECONNECTING`, and `OFFLINE` connection states as a dedicated status pill

Constraints:

- Preserve all current APIs, persistence formats, React Flow behavior, workflow/runtime behavior, Modbus semantics, monitor read-only behavior, queue policy, and write-safety guards.
- Do not add cross-workflow variables in v1.2.12.
- Carry every pending/not-run v1.2.11 acceptance row into the v1.2.12 matrix, classified as mandatory-for-merge, mandatory-for-release, conditional-on-environment, or non-blocking evidence.
- Remediate dependency advisories or record explicit reviewed risk acceptance before release.
- Bump the version to `1.2.12` in the first implementation commit and keep root, client, server, lockfile, UI label, startup banner, and health API synchronized. No tag or release ZIP before the final release gate.

Implementation runs on the session branch `arena/01a0c748-modbus-workflow-studio` from `main` at
`efcd15bda9608a6d68cfbf944b1599d50ff65306` and is delivered through a new PR. The old PR #2 branch is not reused.

## v1.3.0 note: deferred, not cancelled

The cross-workflow Variable requirement is **deferred** from v1.2.12 to v1.3.0 in the form of
`Publish Variable` / `Read Variable`. It is not cancelled and remains planned work with its own
planning and acceptance PR.

## v1.3.0: Cross-workflow Published Variables

Approved direction, subject to a dedicated planning and acceptance PR:

- Separate `Publish Variable` and `Read Variable` blocks
- Boolean and Number values
- Stable project-level Variable ID/registry
- One publisher per ID and multiple readers
- Value, quality, timestamp, sequence, and source revision propagation
- Fail-safe `MISSING`, `STOPPED`, and `BAD` states; unavailable sources must not be reported as `GOOD`
- Definitions may persist; live runtime values do not persist
- Dependency graph and direct/indirect circular dependency protection
- Existing Modbus output ownership, mode, write-on-change, read-back, and write guards remain mandatory

## v1.4.0: Concurrent LIVE arbitration

- Full output ownership and resource claims
- Conflict resolution and cross-workflow write safety
- Shared polling optimization
- Ownership diagnostics

## Deferred

- Modbus Multi Output
- Write operations from Modbus Monitor
- Long-term historical trending
- External/distributed signal buses
- Full mobile-phone workflow editing
