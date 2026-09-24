# Changelog

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
