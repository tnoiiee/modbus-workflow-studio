# MODBUS WORKFLOW STUDIO v1.0.18

Full-stack TypeScript monorepo for designing and operating Modbus TCP workflows through a browser, REST API, WebSocket, and a Node.js raw TCP gateway.

## Safety

This release is intended for trusted local networks only and has no authentication. Do not expose port 8080 directly to the Internet. Output writes default to disabled. LIVE ARMED requires `ALLOW_WRITES=true`, a running workflow, and a connected device.

## Install on Windows PowerShell

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. Production:

```powershell
npm run check
npm start
```

The production server serves `client/dist` and listens on the configured host and port.

## Project structure

```text
modbus-workflow-studio/
├── client/                 React 18, Vite, @xyflow/react
├── server/                 Express, ws, node:net Modbus gateway
├── data/                   JSON persistence at runtime
├── .env.example
├── package.json
└── README.md
```

## Simulator test

1. Start a Modbus TCP simulator on `127.0.0.1`, normally port `502` or a non-privileged test port such as `1502`.
2. Create and save the device in **Devices**.
3. Select **Test TCP**, then **Connect**.
4. Add a MODBUS INPUT block, select the device, FC01, protocol address `0`, Boolean, scan interval 1000 ms.
5. Change to LIVE LOCKED and choose RUN. Confirm RX traffic and GOOD quality.
6. Validate the complete workflow before enabling writes.

## Enable writes

Stop the gateway, set the following in `.env`, and restart:

```dotenv
ALLOW_WRITES=true
```

Then connect the device, remove critical validation errors, select LIVE ARMED, and start the workflow. Manual writes are guarded by the server and written to the audit log. Start with LIVE LOCKED against a simulator.

## Addressing

All block addresses are zero-based Modbus protocol addresses. Protocol address 0 maps to coil reference 00001, discrete input 10001, input register 30001, or holding register 40001 depending on function code. Reference prefixes are display conventions and are not transmitted on the wire.

## Output polarity

NORMAL keeps the command unchanged. ACTIVE LOW visibly inverts the effective physical value. FC05 encodes effective false as `0x0000` and effective true as `0xFF00`. The runtime keeps commanded and effective values separate.

## Byte and word order

ABCD is normal order. BADC swaps bytes in each 16-bit word. CDAB reverses 16-bit word order. DCBA reverses word order and swaps bytes per word. Float64 applies the same rule over four words.

## Supported protocol operations

FC01, FC02, FC03, FC04, FC05, FC06, and FC16 are implemented by the gateway. FC15 is intentionally unavailable and must remain disabled in the UI.

## Persistence and restart behavior

Devices, workflow configuration, positions, edges, parameters, and settings persist as JSON. Runtime values and sockets do not. At startup all devices are disconnected, workflow is stopped, and persisted LIVE ARMED is downgraded to LIVE LOCKED.

## Tests

```powershell
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` runs typecheck, test, and build in that order.

## Known limitations in v1.0.18

- FC15 is not supported.
- No authentication is included; trusted LAN use only.
- JSON persistence is single-process and intended to be replaceable by a database adapter.
- TLS termination and role-based access should be supplied by a trusted reverse proxy before broader deployment.
- The generated package was structurally inspected but dependency installation, typecheck, tests, and build were not run in the delivery environment, per the requested handoff workflow.

# Multi-workflow foundation in v1.2.8

Version 1.1.0 migrates the former single `workflow.json` configuration into a workflow catalog. The first migrated definition is named `Main Workflow`. Configuration files are then stored by immutable UUID:

```text
data/
├── workflows.json
└── workflows/
    └── <workflow-id>.json
```

The legacy file is retained for rollback and is not used as a workflow filename. Runtime values, connections, pending writes, and running state are not persisted. Any saved LIVE ARMED definition is downgraded to LIVE LOCKED during startup.

## Workflow management

The Workflow header now provides a selector and actions to create, rename, duplicate, and delete definitions. Duplicate creates new workflow, node, and edge IDs, preserves positions and device references, and starts in DESIGN/STOPPED. The final remaining workflow cannot be deleted.

## Runtime policy in v1.2.8

This foundation release intentionally permits only one running workflow per project. A second run request returns HTTP 409 with the active workflow ID. Selecting another workflow only changes the editor and does not stop the running workflow.

## New API

```text
GET    /api/workflows
POST   /api/workflows
GET    /api/workflows/:workflowId
PUT    /api/workflows/:workflowId
DELETE /api/workflows/:workflowId
POST   /api/workflows/:workflowId/activate
POST   /api/workflows/:workflowId/rename
POST   /api/workflows/:workflowId/duplicate
POST   /api/workflows/:workflowId/run
POST   /api/workflows/:workflowId/stop
POST   /api/workflows/:workflowId/mode
```

The old workflow read endpoint remains available for compatibility. Legacy mode/run/stop endpoints return HTTP 410 to prevent bypassing the single-running policy.

## Known limitations

- Only one workflow may run at a time.
- WORKFLOW INPUT and WORKFLOW OUTPUT are planned for a later release.
- Published Signal Registry and cross-workflow dependencies are not included.
- Concurrent LIVE workflows and output ownership arbitration are not included.
- Viewport fields are supported by the persistence model; automatic viewport save controls remain a follow-up item.

## Local validation

Dependencies are intentionally not bundled. Run locally:

```powershell
npm install
npm run check
npm run dev
```


## v1.2.8 hotfix

Restores Manual Trigger with the workflow-aware endpoint `POST /api/workflows/:workflowId/runtime/nodes/:nodeId/manual-trigger`. Toggle, Momentary, and One Shot actions validate the running workflow and include workflow identity in audit events.


# Independent runtime sessions in v1.2.8

Each workflow now owns an isolated runtime session containing node values, engine memory, pollers, timers, manual trigger timers, and automatic output write state. Multiple workflows can run concurrently while sharing the project-level Modbus device connection queue.

New runtime APIs:

```text
GET  /api/runtime/summary
POST /api/runtime/stop-all
GET  /api/workflows/:workflowId/runtime
GET  /api/workflows/:workflowId/runtime/nodes/:nodeId
```

Traffic entries created by workflow operations carry `workflowId` and `nodeId`. LIVE ARMED workflows claim output resource keys and conflicting output resources are rejected. Runtime sessions are not persisted and all workflows restart in STOPPED state.


# Audit Viewer in v1.2.8

Adds a read-only Audit Log workspace with workflow/action/severity/result/time filters, search, server-side pagination, live/pause updates, JSON/CSV export, detail inspection, workflow navigation, and confirmed clear with a retained `AUDIT_CLEARED` record. Audit retention is capped at 10,000 entries.


# Linear Mapping and logic symbols in v1.2.8

`LINEAR_MAPPING` uses `outputLow + (input - inputLow) * (outputHigh - outputLow) / (inputHigh - inputLow)`. It supports forward/reverse mapping, clamp, extrapolation, mark-bad, stop-branch, safe-value handling, display precision, and engineering units. Boolean logic blocks display compact inline SVG symbols beside their text titles without changing React Flow handles.


# Reliable auto-save hotfix in v1.2.8

Parameter edits are debounced for 500 ms. Saves are serialized per workflow, use the latest revision from a ref, retry a revision conflict once after reloading the current server revision, time out after 10 seconds, and always leave the UI in Saved or Save failed rather than remaining at Saving. Pending parameter edits are flushed before switching workflows.


# v1.2.8
Adds MODBUS MULTI INPUT with up to 8 consecutive values, Boolean status lamps, and the read-only Modbus Monitor with project-level lists, manual/continuous reads, range creation, and CSV export. Multi-output writing is not included.


# v1.2.8 CSV export hotfix

Fixes the Modbus Monitor CSV unterminated string issue. CSV export now uses Windows-compatible CRLF rows, a UTF-8 BOM, and a UTF-8 CSV MIME type. Workflow, React Flow, runtime, Modbus, and monitor behavior are otherwise unchanged.


# v1.2.8 independent Modbus Multi Input

MODBUS MULTI INPUT now contains 1 to 8 independent read configurations sharing one Device and Unit ID. Each input has its own FC01-FC04, protocol address, data type, byte/word order, scale, offset, engineering unit, scan interval, runtime quality, value, lamp, and output port. Modbus Monitor ADD RANGE now provides FC, start address, count, step, data type, naming, validation, and preview.


# v1.2.8 server type-narrowing hotfix

Adds an explicit device guard before using `device.defaultUnitId` in the independent Modbus Multi Input read path. No polling, runtime, React Flow, Modbus Monitor, auto-save, or CSV behavior was changed.
