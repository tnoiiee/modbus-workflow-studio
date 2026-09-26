# Changelog

## [1.4.0-dev.6] - O2-B1 Acquisition and Tag Runtime Foundation (2026-09-26)

- Approved base `20b929bb5bdd82673173764efab1effc98c2aa5a`, O2-A approved / Owner Manual Review PASS.
- Connection-owned bounded MBAP stream parser, fragmented/coalesced frames, transaction/context
  correlation, timeout/cancellation retirement and stale completion guards.
- Separate persisted Shared Tag mapping schema/configuration-only CRUD API and Data Sources editor.
- Server-owned read-only acquisition, conservative identical-range dedup, bounded scheduling and
  lowest-priority acquisition admission on existing shared DeviceConnection queues.
- Transport-neutral, memory-only Tag Runtime Store with five qualities, explicit no-sample state,
  last-good semantics, source/receive times, epoch/sequence and generation invalidation.
- No new auto-connect policy; manual disconnect remains authoritative. Cross-owner duplicate
  reads remain possible. No String codec or WORKFLOW_VARIABLE producer.
- No O2-B2 REST snapshot/Tag WS delivery, O2-B3 Overview live rendering, controls or later phases.
- Owner accepted Stage 1 and authorized Full Gates plus one normal development checkpoint delivery.
  Full Client 523/36, Full Server 247/16, check, strict hygiene, verify:publish and diff checks PASS;
  Owner Local Manual Review PENDING.
- Application version metadata synchronized; dependency versions/resolution/integrity unchanged.


## [1.4.0-dev.5] - O2-A Inspector and reference UX (2026-09-26)

- Based on `d801666b6a9a650f62a2d4c68eca530e0d894dd9`, dev.4 approved with punchlist.
- Smooth Inspector width/gutter transitions using existing motion tokens; no retained hidden fields,
  no Canvas remount/fitView, reduced-motion opt-out and focus recovery without scrolling.
- Add Owner-authorized read-only POST `/api/source-definitions/references/batch`: 1–100 strict
  stable identities, first-occurrence deduplication/order, one saved-page scan, explicit found/zero.
- Add optional saved `direction` to existing reference details; omit missing/invalid legacy values
  without rewriting saved data. Existing fields, Delete impact and endpoint behavior retained.
- Automatic bounded sequential count loading, non-blocking errors, generation guards and on-demand
  details in an accessible non-modal reading pane. Unsaved browser Drafts explicitly excluded.
- Existing Definition actions and protected Overview/Workflow/Devices/runtime contracts preserved.
- Synchronize application versions only; no dependency changes. Manual review pending, not release
  acceptance; O2-B/O2-C/O2-D not started. No PR, Tag, Release or ZIP.

## [1.4.0-dev.4] - O2-A final workspace UX punchlist (2026-09-25)

- Base `c8ef28b6c9d2160334d97565ae558d7cb03d891a`, v1.4.0-dev.3, approved with punchlist.
- Require selection before drag; ignore React Flow selection echoes and unselected movement.
  Preserve keyboard activation, selected drag/resize and one-gesture/one-Undo semantics.
- Hide the whole deselected Inspector and reclaim Canvas width without viewport/geometry changes.
- Reproduce duplicate SVG pattern IDs with the installed Background component; isolate Overview's
  ID without editing protected Workflow Canvas or adding a grid/fitView. Browser review pending.
- Move Data Sources actions into a unified responsive filter toolbar; show the complete shell
  description, concise configuration boundary and responsive accessible metadata rows.
- Keep APIs, stable identity, Unit data, binding/resolver/reference/CRUD semantics, Font Size,
  savedViewport, independent Preview controls and Workflow/Modbus runtime unchanged.
- Synchronize application versions only; no dependency updates. Owner Manual Review PENDING.
- O2-B/O2-C/O2-D NOT STARTED. No PR, Tag, Release or ZIP.

## [1.4.0-dev.3] - O2-A frontend UX and Selection punchlist (2026-09-25)

- Based on approved dev.2 checkpoint `4c73b1e82db050224d7599e0357bd323f5c6b961`.
- Modernize Data Sources search/type/status filters, readable metadata rows, compact IDs, direct
  Enable/Disable, on-demand saved-reference counts, focused Create/Edit and accessibility.
- Group Inspector fields consistently and provide compact deselected presentation without stale inputs.
- Intermittent selection NOT REPRODUCED in callback investigation; no speculative selection changes.
- Preserve all existing APIs, identity/resolver/persistence, Delete/MISSING, Font Size transactions,
  Page state, independent Preview controls and Runtime contracts. Version metadata only on Server.
- Owner browser Manual Review PENDING; no new dependencies or O2-B/O2-C/O2-D work.

## [1.4.0-dev.2] - O2-A approved punchlist (2026-09-24)

- Base `fa2ac89e1f4582df5f6cdda7fe8b6de40fd91390`, v1.4.0-dev.1, Owner review APPROVED WITH PUNCHLIST.
- Add first-class Data Sources sidebar page for both definition types outside Overview Edit.
- Add explicit Delete confirmation and saved-reference-impact metadata; preserve binding identity,
  Page configuration/revision and existing MISSING resolution after deletion.
- Keep an Overview shortcut and preserve its session when visiting Data Sources.
- Pull forward immediate Font Size Edit preview only: one property commit/Undo, Draft-only until
  Save, Escape/local cancellation and Page Cancel restoration. Element text inherits configured size.
- Preserve BOUND + EDITOR PREVIEW and disabled Production Control Runtime; no Runtime values.
- Synchronize application version metadata; no dependency/resolution/integrity changes.
- Owner accepted Stage 1: 348 client / 71 server tests, both typechecks and Client build PASS.
- Full Client 422 tests / Full Server 84 tests PASS; `npm run check` PASS (both typechecks,
  complete tests and both builds under its normal contract).
- Owner browser Manual Review PENDING, including multi-Element Font Size preview isolation.
- One commit and normal branch push authorized only after Full Gates and final diff verification.
- No O2-B, Picture Box, MQTT/Sparkplug, production commands, PR, Tag, Release or ZIP.

## [1.4.0-dev.1] - O2-A Tag/Variable Binding Foundation (2026-09-24)

- Based on merged v1.3.0 at `eed588481ae7e7376f9926e58dbd37f9076b5c2e`.
- Persisted configuration-only WORKFLOW_VARIABLE and SHARED_TAG catalogs, server-generated
  immutable UUIDs, metadata CRUD API and minimal editor; Disable is the default UI removal action.
- Explicit stable binding selection, type/capability compatibility, pure NOT_BOUND/DRAFT/BOUND/
  MISSING/INCOMPATIBLE resolution and Inspector metadata/reasons. No automatic legacy matching.
- Resolution refresh stays outside Page persistence/history/revision; new bindings omit derived status.
- BOUND Control labels explicitly state Runtime is disabled; independent Preview state preserved.
- Navigation Link uses separate targetWorkflowId and the existing Workflow selection path only.
- O2-A targeted tests/docs and synchronized current version surfaces; dependencies unchanged.
- No Runtime values, acquisition/transport, commands, MQTT/Sparkplug, O2-B/C/D or release activity.
- Stage 1 checkpoint; Full Gates await Owner authorization. Manual Review NOT STARTED.

## [1.3.0] - Overview Designer Foundation

- Promotes Owner-approved Final O1 checkpoint `58c3586e1f433b44fca53bf2c183be6065a796e5` from `v1.3.0-dev.2`; Final O1 Owner Manual Review PASS.
- Includes Overview Page management and Editor, Element Library/Inspector, Draft, Undo/Redo, Save/Cancel, View/Edit boundaries, independent Preview Control state, savedViewport, accessibility/responsive baseline and Draft Tag binding configuration.
- Release preparation changes version metadata and documentation only; feature behavior, dependencies and API contracts are unchanged.
- No Production Monitoring/Control Runtime, live Modbus values or Modbus writes from Overview, Tag Runtime, Variable Blocks, MQTT or Sparkplug implementation. MQTT Sparkplug B remains a future architecture plan only.
- PR review/manual merge remains pending; no tag, GitHub Release or ZIP is created.

## [1.3.0-dev.2] - O1-D configuration validation and accessibility

- Complete configuration-only Tag metadata editing with derived NOT_BOUND/DRAFT status; no runtime resolution or connected claim.
- Validate binding enums, identity/status consistency, direction and Element properties before Save; preserve invalid Draft without PUT.
- Use native Library disclosure/list semantics, associated Inspector help and validation announcements, local Escape editing, and panel-toggle focus restoration.
- Keep compact Inspector in layout rather than overlaying Canvas; bound dialog and command-bar overflow without modifying persisted geometry or savedViewport.
- Synchronize application version values only; no dependency, Server validation, API or WebSocket structure changes.
- Final O1 acceptance remains pending Owner Manual Review.

## [1.3.0-dev.1] - O1-C Stabilization

- View Mode omits Save Status and Page REV; Edit Mode retains configuration save semantics.
- Switch state persists independently through revision-free GET/PATCH APIs with read-only legacy fallback.
- Application version surfaces synchronized without dependency changes.
- No Tag Runtime, Modbus writes, or O1-D changes.

## [1.2.11] - Monitor scheduler and WebSocket reliability

### Added

- Single-flight monitor scheduling with one pending scan per list, generation guards, cancellation, restart invalidation, and diagnostics.
- Configurable per-device monitor queue admission with a default bound of 32 jobs and priority protection for workflow reads and safety-critical writes.
- Bounded per-client WebSocket queues with telemetry coalescing/drop handling and control-event resync signaling.
- Jittered client reconnect from 250 ms to 30 s, duplicate-socket prevention, connection status transitions, and revision-safe REST resynchronization.
- Server reliability defaults and environment parsing for monitor, transport, and reconnect limits.

### Preserved

- Modbus protocol operations, workflow runtime, React Flow editing, output safety, read-only monitor semantics, and ownership protection.

### Acceptance disposition

- Automated, CI, and selected local reliability scenarios passed against implementation commit `a393cf3`.
- Remaining frontend, write-safety, mixed-load, soak, slow-consumer, frame-capture, hardware, and security-disposition gates move to v1.2.12.
- v1.2.11 is a source baseline for v1.2.12 and is not authorized for a standalone release tag or ZIP.

## [1.2.10] - Google Sans loading and override hotfix

### Fixed

- Declared static Google Sans font faces with exact weights 400, 500, 600, and 700.
- Added scoped application, form, table, and React Flow font overrides.
- Preserved offline font assets and all v1.2.9 UI refinements.

### Unchanged

- Backend, runtime, Modbus, WebSocket, monitor scheduling, auto-save, and React Flow architecture.

## [1.2.9] - UI readability and visual refinement

### Changed

- Bundled Google Sans for offline application typography.
- Increased UI text sizes by 2 px and adjusted supporting containers.
- Improved React Flow Controls and MiniMap visibility.
- Moved logic symbols to the top center and enlarged them.
- Added Thai descriptions below English Block Parameter descriptions.

### Unchanged

- Backend, runtime, Modbus behavior, WebSocket, monitor scheduling, auto-save logic, and React Flow architecture.

## [1.2.8] - Current working baseline

### Added

- React Flow workflow editor with workflow CRUD.
- Concurrent isolated workflow runtime sessions.
- Independent Modbus Multi Input with up to eight sub-inputs.
- Per-input configuration, runtime quality, value display, status lamps, and output ports.
- Read-only Modbus Monitor and configurable Add Range dialog.
- Boolean logic symbols and Linear Mapping.
- Audit Viewer and reliable auto-save.

### Fixed

- Workflow save serialization and revision recovery.
- Monitor CSV CRLF and UTF-8 export.
- Server type narrowing in the Multi Input read path.

### Known issues

- Continuous monitor cycles may overlap.
- WebSocket diagnostics have no backpressure or batching policy.
- Client WebSocket has no auto-reconnect or state resynchronization.
