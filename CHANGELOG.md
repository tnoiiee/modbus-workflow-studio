# Changelog

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
