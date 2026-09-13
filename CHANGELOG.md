# Changelog

## [1.2.8] - Current working baseline

### Added

- Independent Modbus Multi Input with up to eight sub-inputs.
- Per-input Modbus configuration, runtime quality, value display, status lamps, and output ports.
- Read-only Modbus Monitor and configurable Add Range dialog.
- Boolean logic symbols and Linear Mapping.
- Audit Viewer and independent runtime sessions.

### Fixed

- Reliable workflow auto-save and revision recovery.
- Modbus Monitor CSV CRLF and UTF-8 export.
- Server device type narrowing in the Multi Input read path.

### Known issues

- Continuous monitor cycles may overlap.
- WebSocket diagnostics have no backpressure/batching policy.
- Client WebSocket has no auto-reconnect or state resynchronization.
