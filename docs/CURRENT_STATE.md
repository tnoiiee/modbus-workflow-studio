# Current Project State

## Current working version

`v1.2.8`

## Source baseline

- Imported source: `modbus-workflow-studio-v1.2.8.zip`
- Source ZIP SHA-256: `fc43341789d7a61f3f1b37f3108573bd7b346f2ba405d2b2713634e5512e9749`
- Git branch: `main`
- Git tag: create `v1.2.8` only after CI passes
- Commit SHA: update after repository baseline is validated

## Current capabilities

- React Flow workflow editor and workflow CRUD
- Concurrent isolated workflow runtime sessions
- Shared project-level Modbus connections and per-device queues
- FC01-FC04 reads and FC05/FC06/FC16 writes
- Single Modbus Input and Output
- Independent Modbus Multi Input with 1-8 sub-inputs
- Per-sub-input FC, address, data type, order, scale, offset, unit, scan interval, runtime, quality, lamp, and source port
- Manual Trigger and Timer blocks
- Boolean logic symbols and status lamps
- Linear Mapping
- Reliable auto-save and revision recovery
- Audit Viewer, Runtime Monitor, Traffic Monitor, and Validation
- Read-only Modbus Monitor with lists, Add Item, Add Range, continuous monitoring, and CSV export
- Output ownership conflict protection

## Validation status

Source and repository structure have been statically inspected. The assistant packaging environment did not install dependencies or run typecheck, tests, or build.

The GitHub baseline must not be tagged until `npm run check` passes locally or in approved CI.

## Known issues

1. Continuous monitor cycles may overlap.
2. Monitor traffic can create high WebSocket event volume.
3. Server WebSocket broadcast has no explicit backpressure policy.
4. Traffic events are not batched.
5. Client WebSocket has no automatic reconnect.
6. State is not resynchronized automatically after WebSocket loss.
7. Vite may log `write ECONNABORTED` under high monitor/proxy load.

## Next proposed target

`v1.2.9`, Monitor Scheduler and WebSocket Reliability Hotfix.

No v1.2.9 functional source changes are included in this bootstrap.
