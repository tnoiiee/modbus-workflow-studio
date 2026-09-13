# Current Project State

## Current working version

`v1.2.8`

## Source baseline

- Imported source ZIP: `modbus-workflow-studio-v1.2.8.zip`
- Source ZIP SHA-256: `fc43341789d7a61f3f1b37f3108573bd7b346f2ba405d2b2713634e5512e9749`
- Git tag: create `v1.2.8` after the initial GitHub commit is validated.
- Git commit SHA: pending initial GitHub push.

## Validation status

The v1.2.8 source was structurally inspected and the source ZIP passed archive integrity verification. Dependency installation, typecheck, tests, and production build were not run in the bootstrap packaging environment.

The project owner should run:

```powershell
npm install
npm run check
```

## Current capabilities

- React/Vite workflow editor using React Flow.
- Workflow create, rename, duplicate, delete, activation, and revisioned persistence.
- Independent concurrent runtime sessions per workflow.
- Shared project-level Modbus TCP device connections and per-device request queues.
- FC01, FC02, FC03, FC04, FC05, FC06, and FC16.
- Single Modbus Input and Output blocks.
- Independent Modbus Multi Input with 1 to 8 inputs sharing Device and Unit ID.
- Per-Multi-Input FC, address, data type, order, scale, offset, unit, scan interval, runtime, quality, and output port.
- Boolean status lamps.
- Boolean logic symbols.
- Compare, Math, Timer, Utility, Manual Trigger, and Linear Mapping blocks.
- Reliable workflow auto-save with debounce, serialization, and revision conflict recovery.
- Read-only Audit Viewer.
- Read-only Modbus Monitor with manual/continuous reads, monitor lists, Add Item, Add Range, and CSV export.
- Workflow output ownership conflict protection.

## Known issues

1. Modbus Monitor continuous scheduling uses `setInterval`; a new cycle may begin before the previous cycle finishes.
2. Monitor items are read sequentially and each request creates traffic events, which can generate high WebSocket message volume.
3. Server WebSocket broadcast does not inspect `bufferedAmount` and does not batch traffic events.
4. Client WebSocket has no abnormal-close auto-reconnect.
5. After WebSocket loss, live runtime, monitor, device, audit, and traffic updates may stop until browser refresh.
6. Vite development proxy may report `write ECONNABORTED` under high monitoring/WebSocket load.
7. The README contains accumulated historical sections and should be consolidated in a later documentation-only change.

## Next target

`v1.2.9`, Monitor Scheduler and WebSocket Reliability Hotfix.

No v1.2.9 source changes are included in this GitHub bootstrap.
