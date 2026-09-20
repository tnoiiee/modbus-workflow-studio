# MODBUS WORKFLOW STUDIO v1.2.10 

Full-stack TypeScript application for designing and operating Modbus TCP workflows through a browser, REST API, WebSocket, and a Node.js raw TCP gateway.

## Current status

- Current working version: `v1.2.10`
- Next proposed stabilization version: `v1.2.11`
- Intended environment: trusted local or industrial LAN
- Authentication: not included
- Modbus writes: disabled by default
- Protocol addresses: zero-based

Do not expose the application directly to the public Internet. Use an authenticated reverse proxy and appropriate network controls before broader deployment.

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

## Known issues in v1.2.9

- Continuous Modbus Monitor uses interval-based scheduling, so monitor cycles may overlap when a cycle takes longer than its configured interval.
- High monitor traffic can produce many WebSocket traffic events.
- Server WebSocket broadcast has no explicit backpressure or traffic batching policy.
- Client WebSocket has no automatic reconnect or post-reconnect state resynchronization.
- Under high monitoring load, the Vite development proxy may report `write ECONNABORTED`.

These backend reliability issues are deferred to v1.2.10.

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
