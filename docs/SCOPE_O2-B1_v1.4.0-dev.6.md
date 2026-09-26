# O2-B1 scope — v1.4.0-dev.6

Owner FINAL APPROVAL: Acquisition and Tag Runtime Foundation only.
Approved base: `20b929bb5bdd82673173764efab1effc98c2aa5a`, v1.4.0-dev.5,
O2-A APPROVED / Owner Local Manual Review PASS.
Branch: `arena/01a0d291-modbus-workflow-studio`.

## Included

- Bounded Modbus TCP MBAP stream framing, transaction/session correlation and stale completion rejection.
- Separate persisted Shared Tag acquisition mappings, configuration-only API and minimum Data Sources UI.
- Independent server acquisition owner and canonical in-memory Tag Runtime Store.
- Application metadata version synchronization only; no dependency upgrades.

## Framing and protected queue integration

One connection-owned parser accumulates at most one 260-byte ADU (MBAP length 2–254,
protocol ID zero). It handles fragmented headers/bodies and multiple frames per chunk.
Complete unsolicited frames are discarded, never saved for later requests. A partial frame
retains the request receiver that existed when its first byte arrived. Generation/socket and
transaction checks prevent old receivers from completing new requests. Invalid framing closes
the corrupt stream rather than guessing its next boundary. Disconnect clears buffered state.
Unit/function and read byte counts are validated; transaction exceptions remain failures.

Timeouts retain their configured duration. Timed-out/cancelled transaction IDs are retired for
that TCP session, including across the 16-bit ID rollover. The set is bounded by the 65,536-ID
space. Exhausting it fails closed and requires explicit reconnect, never automatic reconnect.
Successful IDs may cycle normally; no non-standard transaction identifier is added to Modbus.

A read-only `acquisition` request class has a 32-queued-request per-Device cap. Existing priority
writes, Workflow reads and Monitor jobs retain their relative order, all ahead of new acquisition
work. Only acquisition requests are cancelled by the new service. Existing Workflow/Monitor
scheduler and output code is unchanged; no cross-owner read broker is present.

## Mapping contract and configuration API

`shared-tag-acquisition.json` under DATA_DIR stores `{version:1,mappings:[...]}` separately from
`source-definitions.json`. No runtime samples, browser state or Overview fields are persisted.
Input is strict and includes only:

- existing SHARED_TAG `sourceId`, `deviceId`, `unitId` (0–255)
- `functionCode` (numeric 1–4), zero-based `address` (0–65535), `width`
- `dataType`, `byteOrder` (BIG_ENDIAN/LITTLE_ENDIAN), `wordOrder` (HIGH_FIRST/LOW_FIRST)
- finite `scale`/`offset`, `pollIntervalMs`, `staleAfterMs`, `enabled`

FC01/02: Boolean, width 1 bit, scale 1, offset 0.
FC03/04: UInt16/Int16 width 1, UInt32/Int32/Float32 width 2, Float64 width 4 registers.
No General String, ASCII, Hex or Bit Field codec is offered in this checkpoint. String Definitions
remain valid metadata but are not acquisition-compatible. Definition type/capability and Device
existence are checked. Disabled sources/devices suspend acquisition, not their configuration.
Missing/deleted referenced entities remain explicit availability conditions; reload does not
invent definitions or rewrite IDs. Orphan mappings can be removed through the configuration API.

- `GET /api/shared-tag-acquisition` lists mappings and configuration availability.
- `GET /api/shared-tag-acquisition/:sourceId` returns mapping/null and availability.
- `PUT /api/shared-tag-acquisition/:sourceId` creates/replaces the mapping; body ID must match.
- `DELETE /api/shared-tag-acquisition/:sourceId` removes only that mapping.

These are configuration CRUD routes, not a runtime snapshot API. GET never reads the Device or
exposes samples. Availability is separate from the five existing binding resolver statuses.
Data Sources adds a Shared-Tag-only Acquisition action. Save/Remove is independent of Definition
metadata and Overview Save/Cancel. Defaults are disabled. Load failures block save; removal needs
confirmation. No Browser connect/read/write/command or runtime delivery path is introduced.

## Acquisition ownership, grouping and limits

Service startup is server-owned, independent of browsers and Workflow running state. Enabled,
compatible mappings only poll already-connected existing DeviceConnection instances. No new
socket-per-tag or auto-connect/retry policy. Existing Device lifecycle has sole connection authority.
Manual disconnect cancels work; connection/mapping/definition invalidation fences success AND error
completion. Configuration mutations and Device state events trigger reconciliation, with a 1-second
fallback. Completion also rechecks current identity, configuration, connection and generation.

**Conservative grouping:** identical configured ranges only, with the same Device, unit, FC,
wire codec/orders and cadence. Alias Tags share the raw read and apply scaling independently.
No address gaps are read. No adjacent-range expansion is attempted: the current Device schema
has no declared smaller block-read capability. This avoids inventing Device limits. Group counts
are validated before configuration persistence and bounded again in scheduler planning.

**Known limitation:** Workflow, Modbus Monitor and Shared Tag owners may still perform duplicate
reads of the same Device/address. No cross-owner deduplication is claimed.

| Resource | Bound |
| --- | --- |
| Mapping records / active Shared Tags | 2,000 total (disabled records also count against config cap) |
| Polling groups per Device | 128 |
| Concurrent acquisition reads globally | 32 |
| Concurrent/queued scheduler work per Device | one outstanding read; no pending scan backlog |
| Device acquisition queue admission | 32 queued plus the serialized active request |
| Poll interval | 100–3,600,000 ms |
| Stale threshold | 100–86,400,000 ms, at least poll interval |
| Scheduler tick / defensive reconciliation | 50 ms / 1,000 ms |
| TCP parser retained receive buffer | 260 bytes per connection |
| Runtime serialized sample payload budget | 16 MiB (not an RSS/heap guarantee) |
| Runtime scalar text budget | 1,024 UTF-8 bytes if a future producer supplies String; no String Modbus codec now |
| Runtime observers / config observers | 32 / 8 |

A slow read does not accumulate scans; next due time is completion plus interval. Higher-priority
owners may delay acquisition: last-good data then becomes STALE, not falsely refreshed.
No hardware throughput, hard real-time cadence or 24/7 soak certification is claimed.

## Canonical Runtime Store

Transport-neutral sample: stable Source identity, logical dataType, typed value/hasValue,
quality/reason, sourceTimestamp, receiveTimestamp, stateUpdatedAt, serverEpoch, sampleSequence,
lastGoodValue and lastGoodReceiveTimestamp. Internal tokens contain acquisition generation and
monotonic producer input sequences. Samples and observer events are defensive copies.

- Startup: UNCERTAIN / NO_SAMPLE, null value/times and hasValue=false.
- Valid read (including 0/false): GOOD; new receive time and sequence even if value is unchanged.
- Freshness expiration: STALE using monotonic elapsed time.
- Read/decode/type failure: BAD. NaN/Infinity/type coercion is rejected.
- Connection loss: DISCONNECTED. BAD/DISCONNECTED retain fault precedence over age-only STALE.
- Under non-GOOD quality, value/hasValue may retain the last successful sample; it is not a fresh
  successful read. No-sample remains null/false. Last-good and receive times never advance on
  quality-only transitions. Modbus sourceTimestamp is always null, never server time.
- Disable/delete/incompatible configuration removes the entry and emits an invalidation event.
  Mapping changes clear the old engineering value; connection fences retain last good but reject
  old generations. Old/duplicate producer sequences cannot replace current state.

Observers are synchronous bounded registrations with isolated exceptions and explicit unsubscribe;
future adapters must supply their own bounded delivery queues. No replay journal, persistence,
React, REST/WS message type, MQTT, Sparkplug, Historian or Overview Element dependency in the store.
WORKFLOW_VARIABLE publishers and Variable Blocks are deferred. Existing Definitions and bindings
are preserved and do not become MISSING merely for lacking a producer.

## Protected / excluded

No edits to Overview rendering, Page/Draft persistence/revision, resolver, saved-reference logic,
Preview Control state, selection/selected-only drag, resize, viewport, Inspector motion/focus,
Font Size Draft, Workflow grid, CRUD/runtime isolation, output guards/ownership, command/effective/
read-back distinction, Monitor ownership or WS protocol/reliability. Existing legacy traffic events
still report Modbus traffic; they are not normalized Tag delivery.

O2-B2 snapshot/Tag subscription/delta/replay and O2-B3 Overview live rendering are NOT implemented.
No O2-C/O2-D, production controls, commands, Variable Blocks, cross-owner broker, assets, MQTT,
Sparkplug, Historian, HA, Permissions/User Management or dependency changes.
Trusted LAN boundary remains: no new authentication or production-security claim.

## Delivery gate

Owner has accepted Stage 1 and separately authorized sequential Full Gates, one scoped commit
and a normal push to the existing development branch. Stop afterward for Owner Local Manual
Review (PENDING). No new implementation, later phase, PR, Tag, Release or ZIP is authorized.
See [Stage 1 acceptance and exact evidence](ACCEPTANCE_TESTS/O2-B1-v1.4.0-dev.6.md).
