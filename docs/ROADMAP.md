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

## v1.2.12: UI/UX Modernization — next

Behavior-preserving frontend modernization:

- Restrained dark-first Industrial Cyberpunk design system with selective glass surfaces
- Desktop and tablet-landscape layouts with WCAG AA contrast, keyboard focus, and reduced-motion support
- Segmented Workflow command bar for Workflow CRUD, edit tools, mode/safety, and runtime controls
- Application modal, confirmation, toast, validation, loading, and error patterns replacing native browser popups
- Categorized collapsible Block Library with modern interactive cards
- English and Thai block descriptions in the Parameters inspector
- Duplicate Block in the inspector and node quick actions: new ID, copied parameters, offset position, no copied edges
- Function Block layout that prevents label/action/port overlap
- Complete visual redesign of Devices, Modbus Monitor, Runtime Monitor, Traffic Monitor, Audit Log, Validation, and Project Settings
- Visible `LIVE`, `RECONNECTING`, and `OFFLINE` connection states

Constraints:

- Preserve all current APIs, persistence formats, React Flow behavior, workflow/runtime behavior, Modbus semantics, monitor read-only behavior, queue policy, and write-safety guards.
- Do not add cross-workflow variables in v1.2.12.
- Carry every pending/not-run v1.2.11 acceptance row into the v1.2.12 matrix.
- Remediate dependency advisories or record explicit reviewed risk acceptance before release.

Implementation must begin from the latest `main` after PR #2 is merged and must use a new planning/implementation branch and PR.

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
