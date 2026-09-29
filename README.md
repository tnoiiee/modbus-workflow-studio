# MODBUS WORKFLOW STUDIO v1.4.0-dev.17

Full-stack TypeScript application for designing and operating Modbus TCP workflows through a browser, REST API, WebSocket, and a Node.js raw TCP gateway.

## Current status

**v1.4.0-dev.17 — O2-B documentation and PR-readiness checkpoint.** O2-B (read-only Overview
Runtime) is complete for the Development checkpoint at `c633a4426b72f805c279eb1e25c7deba74d2071b` /
dev.16 (Owner manual review PASS); Hardware and 24/7 soak certification remain **PENDING**. This
checkpoint changes documentation and Version literals only. **O2-C Picture Box/Assets is DEFERRED
(not cancelled)** to prioritize Workflow Shared Signal and safe Modbus Write validation; see
[the deferred record](docs/SCOPE_GATES/O2-C-PICTURE-BOX-ASSETS-DEFERRED.md) and the
[PR readiness](docs/ACCEPTANCE_TESTS/O2-B-PR-READINESS-v1.4.0-dev.17.md).

**v1.4.0-dev.16 — O2-B3 Optional Inline Runtime Details Action**. Approved base
`e3f606765c8d8b83a4c30b0b861e5f90d762050e` / dev.15, branch
`arena/01a0d291-modbus-workflow-studio`. Owner manual review **PASS**.

- One optional persisted presentation field, `showRuntimeDetails` (absent = false, no migration).
  The Inspector checkbox **Show Runtime Details** (Appearance group, eligible Monitoring types only)
  controls the inline Details button. Off: no button, no action gutter, no focusable control; the
  Page-level `Runtime details & safety → Element Runtime Details` path stays available. Runtime
  eligibility, projection, geometry and protocol are unchanged.
  [Scope](docs/SCOPE_O2-B3_v1.4.0-dev.16.md) · [acceptance](docs/ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.16.md).

Previous checkpoint — **v1.4.0-dev.15 — O2-B3 Canvas HMI Visual Refinement (A+B)**. Approved base
`0d4147d61fe89b875caa425b148ae94c636036c5` / dev.14. Owner local manual review **PASS for dev.14**;
**dev.15 Owner local manual review PENDING**.

- Canvas/Element presentation only. High-performance industrial HMI with compact, low-noise
  composition. No mandatory equipment-card style: Owner Background/Border remain authoritative.
  The Page background is intentionally configurable, not a defect; no shell/header/status-bar redesign.
- Remove Runtime rail paint in both modes, preserving the existing abnormal 2px border allocation.
  Normal inset, outer dimensions and stored geometry are unchanged by rail removal. Edit selection,
  resize handles and external EDITOR PREVIEW / Binding chrome remain.
- Monitoring has primary Value/Light, concise abnormal status, secondary Caption/Unit and Details.
  GOOD has no badge; No data/Uncertain/Stale/BAD/Disconnected/Unsupported are concise. Historical
  and Cached qualifiers remain explicit; canonical values, quality and availability are unchanged.
  Large layouts use a stable status row; tight layouts use a separate critical-marker column with
  full accessible status. Slot decisions use geometry/configuration, never a live sample.
- Light retains filled/dot TRUE, hollow/minus FALSE and dashed/question unavailable. Show Text
  controls optional visible words; tight layouts prioritize the lamp and abnormal marker.
  Background Opacity and Show Border do not hide intrinsic indicators. No command behavior.
- Switch/Push Button have one visible **PREVIEW ONLY** marker and a full accessible description:
  Control Runtime is not enabled; UI preview only, no Device or Workflow command. Existing Preview
  handlers/state path are unchanged. Navigation uses a directional glyph/link-like treatment,
  not a Preview or process-command appearance. Its navigation handler is unchanged.
- Empty Text does not invent generic Element-type labels. Image/Picture remain glyph/dashed
  placeholders only, with accessible descriptions; no assets/O2-C. Details is 24px where it fits,
  otherwise the dev.14 Page-level fallback remains. Eligibility, Details and safety overlay unchanged.
- No persisted fields added; dev.14 fields/defaults/fallbacks and Inspector behavior unchanged.
  No migration, automatic color correction, opaque fill injection or autosize. Owner colors,
  RGBA alpha multiplier and legacy Overall Opacity remain independent and preserved.
- Stage 1 **1428 tests / 89 unique files PASS**, both standalone typechecks/builds PASS.
  Full Client **1105/65**, Server **323/24**, `npm run check` PASS. Strict hygiene **614/0/0**,
  complete worktree **300/0/0**, verify:publish and diff checks PASS. Final staged/Remote evidence
  belongs in the delivery handoff; [acceptance](docs/ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.15.md).
- [Scope](docs/SCOPE_O2-B3_v1.4.0-dev.15.md). Browser bounding-box/contrast measurements and
  screen-reader observations remain **PENDING**. SSR/CSS/deterministic callback tests are not
  Browser or hardware/soak certification. Very small geometry and extreme fonts/opacity cannot
  guarantee readable text; full accessible information remains, with eligible Monitoring fallback.
  Future contrast/minimum-usable-size guidance is documentation only, not an implemented feature.
- Catalog/focus/lifecycle, B1/B2, Binding/quality/availability, Page transactions/geometry/viewport,
  Device/Manual Disconnect, Control/Navigation behavior, Workflow/Monitor/Traffic/write safety locked.
  Production Server version-only; dependencies/scanner unchanged. Existing 66 SSR warnings,
  chunk warning and advisories **5 moderate / 1 high / 1 critical** remain unresolved/unaccepted.
  No PR/tag/release/ZIP. **O2-C/O2-D NOT STARTED.**

### Operational safety boundary

Intended for a trusted local or industrial LAN. Authentication is not included; do not expose
this application directly to the public Internet. Use an authenticated reverse proxy and
appropriate network controls. Tag Origin/CORS is not authentication. Configure exact comma-separated
`TAG_ALLOWED_ORIGINS` for trusted cross-origin clients; `TAG_ALLOW_MISSING_ORIGIN=false` disables
non-browser missing-Origin access (default allowed). Same request Host is permitted; a trusted proxy
must preserve it or configure the public Origin. No Preview URL hardcoding. See the dev.9 protocol
for limits and failure semantics. Modbus writes remain disabled by default; addresses are zero-based.
Existing write-safety guards and relative Workflow/Monitor priority are preserved. Shared Tag
acquisition has its own bounded, lower-priority read class; manual disconnect remains authoritative.

## Overview Designer Foundation

Includes Overview Page management, Overview Editor, Element Library and Inspector, Draft, Undo/Redo, Save and Cancel, View/Edit boundaries, independent Preview Control state, savedViewport, accessibility/responsive baseline and Draft Tag binding configuration.

Includes bounded read-only SHARED_TAG monitoring in active Overview View Mode through O2-B2. Does not include Production Control Runtime, Overview writes, WORKFLOW_VARIABLE Runtime, Variable Blocks, String acquisition, MQTT or Sparkplug. Existing Workflow commands are not Overview Runtime commands; MQTT Sparkplug B remains future planning only.

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
