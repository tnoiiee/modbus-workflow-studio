# Current Project State

## Current working version

`v1.2.10`

## Source baseline

- Base source archive: `modbus-workflow-studio-main-67e03dc.zip`
- Base commit: `67e03dc5f71d6110f0a70b9fb87ef54ad9448358`
- Base source archive SHA-256: `b3e631fb0ace2e5c270108f07707d4b5376031f74eb9332761a2fff96446e1b5`
- Git branch: `main`
- Git tag: create `v1.2.10` only after CI passes
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

`v1.2.11`, Monitor Scheduler and WebSocket Reliability Hotfix.

v1.2.10 fixes Google Sans loading and CSS specificity while preserving the v1.2.9 UI refinements. Backend reliability work remains deferred to v1.2.11.
