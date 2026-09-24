# MODBUS WORKFLOW STUDIO v1.3.0

Full-stack TypeScript application for designing and operating Modbus TCP workflows through a browser, REST API, WebSocket, and a Node.js raw TCP gateway.

## Current status

- Current application version: `v1.3.0`
- Accepted Overview baseline: `58c3586e1f433b44fca53bf2c183be6065a796e5`
- Release identity: **Overview Designer Foundation**. Release candidate prepared for Owner PR review and manual merge; no tag, GitHub Release or ZIP created.
- Current scope: O1-D configuration-only Draft Tag binding, validation, Overview accessibility and responsive regression. O1-C independent Switch state and revision-free View controls are preserved. Tag Runtime and Variable Blocks are excluded.
- Final O1 Owner Manual Review: **PASS** at `58c3586`. See [O1 acceptance](docs/ACCEPTANCE_TESTS/O1-v1.3.0-dev.2.md) and [release notes](docs/RELEASE_NOTES_v1.3.0.md).
- Reliability defaults: monitor queue 32 jobs/device, one in-flight plus one pending scan/list, WebSocket 256 messages or 1 MiB/client, reconnect backoff 250 ms–30 s with jitter
- Intended environment: trusted local or industrial LAN
- Authentication: not included
- Modbus writes: disabled by default
- Protocol addresses: zero-based

Do not expose the application directly to the public Internet. Use an authenticated reverse proxy and appropriate network controls before broader deployment.

## Overview Designer Foundation

Includes Overview Page management, Overview Editor, Element Library and Inspector, Draft, Undo/Redo, Save and Cancel, View/Edit boundaries, independent Preview Control state, savedViewport, accessibility/responsive baseline and Draft Tag binding configuration.

Does not include Production Monitoring Runtime, live Modbus values in Overview, Production Control Runtime, Modbus writes from Overview, Tag Runtime, Variable Blocks integration, MQTT implementation or an MQTT Sparkplug adapter. MQTT Sparkplug B is a future architecture plan only. Existing Workflow/Modbus capabilities below are not Overview runtime capabilities.

## Main capabilities

### Workflow editor

- React 18, Vite, and React Flow workflow canvas
- Workflow create, rename, duplicate, delete, and selection
- Node drag, position persistence, connections, deletion, Undo/Redo, Fit View, pan, zoom, and MiniMap
- Dynamic input and output ports
- Live runtime values and animated flow indicators
- Workflow validation and revisioned persistence

### Concurrent workflow runtime

- Independent runtime session per workflow
- Independent node values, engine memory, pollers, timers, Manual Trigger state, and output initialization
- Multiple workflows may run concurrently
- Project-level shared Modbus device connections and per-device request queues
- STOP ALL and output ownership conflict protection

### Modbus blocks

- `MODBUS_INPUT`
- `MODBUS_MULTI_INPUT`
- `MODBUS_OUTPUT`

`MODBUS_MULTI_INPUT` supports one to eight independent input configurations. Device and Unit ID are shared by the block. Each sub-input has an independent name, FC01-FC04, zero-based protocol address, data type, byte/word order, scale, offset, engineering unit, scan interval, runtime quality, status, error, Boolean lamp, and source port.

### Protocol operations

- FC01 Read Coils
- FC02 Read Discrete Inputs
- FC03 Read Holding Registers
- FC04 Read Input Registers
- FC05 Write Single Coil
- FC06 Write Single Register
- FC16 Write Multiple Registers

FC15 is intentionally unavailable. (Will be added later)

### Logic and utility blocks

- AND, OR, XOR, NAND, NOR, and NOT
- SR/RS Latch
- Rising/Falling Edge
- Compare and arithmetic blocks
- Timers
- Constants
- Manual Trigger
- Data conversion and bit operations
- Linear Mapping with clamp, extrapolation, bad-quality, stop-branch, and invalid-span policies

### Reliable auto-save

- Debounced parameter saves
- Serialized saves per workflow
- Latest snapshot wins
- Revision conflict recovery
- Request timeout and explicit save-failure state
- Pending save flush before workflow switching

### Read-only Modbus Monitor

- Project-level monitor lists stored separately from workflows
- Add Item and Add Range
- FC01-FC04 reads
- Manual `READ NOW`
- Continuous monitoring
- Boolean status lamps, numeric values, raw values, quality, response time, and engineering units
- CSV export with CRLF rows and UTF-8 BOM
- No Modbus write operation is available from the monitor
- Single-flight scheduling prevents overlapping scans; Stop, delete, disconnect, and restart invalidate stale scans
- Monitor admission is bounded per device with coalescing/drop diagnostics while workflow reads and safety-critical writes retain priority

### WebSocket reliability

- Per-client queues are bounded at 256 messages or 1 MiB by default
- Telemetry may be coalesced or dropped under pressure; control/state events trigger a revision-safe resync instead of silent loss
- The browser prevents duplicate sockets, reconnects with jittered 250 ms–30 s backoff, and reloads REST state after reconnect
- Server limits can be tuned with `MONITOR_QUEUE_LIMIT`, `WS_CLIENT_MAX_MESSAGES`, `WS_CLIENT_MAX_BYTES`, `WS_TELEMETRY_COALESCE_MS`, `WS_RECONNECT_BASE_MS`, `WS_RECONNECT_MAX_MS`, and `WS_RECONNECT_JITTER`

### Diagnostics

- Audit Viewer
- Runtime Monitor
- Traffic Monitor
- Validation page
- Device connection management

## Addressing

All addresses are zero-based Modbus protocol addresses.

```text
Protocol address 0 maps to:
Coil reference           00001
Discrete input reference 10001
Input register reference 30001
Holding register         40001
```

Reference prefixes are display conventions and are not transmitted on the wire.

## Installation on Windows

From PowerShell in the repository root:

```powershell
Copy-Item .env.example .env
npm install
npm run check
npm run dev
```

Open:

```text
http://localhost:5173
```

## Production

After a successful local or CI validation:

```powershell
npm start
```

The production server serves `client/dist` and listens on the configured host and port.

## Write safety

Writes require all applicable safeguards:

- `ALLOW_WRITES=true`
- Connected device
- Running workflow
- `LIVE_ARMED` mode
- Valid workflow
- No output ownership conflict
- Write policy and read-back conditions satisfied

Commanded Value, Effective Value, and Read-back Value remain separate runtime concepts.

## Persistence and restart behavior

Persisted:

- Devices
- Workflow catalog and workflow configuration
- Nodes, edges, positions, and parameters
- Monitor-list configuration
- Project settings

Not restored as active runtime:

- TCP sockets
- Pollers and timers
- Runtime values
- Pending writes
- Running workflow state
- Active monitor state

Persisted `LIVE_ARMED` is downgraded to `LIVE_LOCKED` on startup.

## Repository governance

Read these files before contributing:

- `AGENTS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROTECTED_AREAS.md`
- Target version acceptance test under `docs/ACCEPTANCE_TESTS/`

Every code change requires a new version and an explicitly approved scope. Approved tags and release ZIPs are immutable.

## Validation

The standard project validation command is:

```powershell
npm run check
```

It runs server/client typecheck, tests, and production build in sequence.

## Operational boundaries in v1.2.11

- Authentication is still outside this application and the deployment must remain on a trusted local or industrial LAN.
- The monitor and WebSocket bounds are configurable, but sustained pressure is reported through diagnostics and resync rather than allowed to grow without limit.
- Under high monitoring load, a development proxy may still report `write ECONNABORTED`; use the bounded queues and server logs to diagnose the environment.
- Live Modbus hardware and browser/E2E acceptance must be run in the target deployment environment; local unit tests do not replace those checks.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`
- `docs/KNOWN_ISSUES.md`
- `docs/ROADMAP.md`
- `docs/RELEASE_PROCESS.md`
- `docs/RELEASE_CHECKLIST.md`


## UI refinement in v1.2.9

- Bundled Google Sans for offline use.
- Increased application typography by 2 px.
- Improved React Flow Controls and MiniMap contrast.
- Enlarged and centered logic symbols.
- Added Thai descriptions below English Block Parameter descriptions.


## Google Sans hotfix in v1.2.10

Static Google Sans files now declare explicit weights 400, 500, 600, and 700. Application, form, table, and React Flow selectors explicitly use Google Sans so library font declarations cannot override the application typography. No runtime network font dependency was added.
