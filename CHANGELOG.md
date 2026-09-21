# Changelog

## [1.2.11] - Monitor scheduler and WebSocket reliability

### Added

- Single-flight monitor scheduling with one pending scan per list, generation guards, cancellation, restart invalidation, and diagnostics.
- Configurable per-device monitor queue admission with a default bound of 32 jobs and priority protection for workflow reads and safety-critical writes.
- Bounded per-client WebSocket queues with telemetry coalescing/drop handling and control-event resync signaling.
- Jittered client reconnect from 250 ms to 30 s, duplicate-socket prevention, connection status transitions, and revision-safe REST resynchronization.
- Server reliability defaults and environment parsing for monitor, transport, and reconnect limits.

### Preserved

- Modbus protocol operations, workflow runtime, React Flow editing, output safety, read-only monitor semantics, and ownership protection.

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
