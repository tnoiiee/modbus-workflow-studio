# O2-B1 validation and Traffic UX punchlist — v1.4.0-dev.7

Owner final approval; base `55335b00ff7cf20c3fee14a09ebd46e52fb476d1` / dev.6.
Branch `arena/01a0d291-modbus-workflow-studio`. O2-B1 APPROVED WITH PUNCHLIST.
Manual Disconnect Owner PASS retained. New local review remains PENDING.

## Included

1. Acquisition editor and pure frontend validator: raw numeric edit strings, below-field reasons,
   clearing as soon as valid, associated live error text, labels and aria-invalid. Invalid Save
   remains keyboard-activatable (`aria-disabled`) only to focus the first invalid field; no PUT.
   Loading/pending/unsupported form gates remain native-disabled. Server/load errors have a
   separate last-response alert; Server remains authoritative if Devices change after loading.
2. Existing Server bounds mirrored: unit 0–255 integer, zero-based address 0–65535, codec Width
   1/2/4 and range end <=65536, finite Scale/Offset, Boolean Scale 1/Offset 0, poll 100–3600000,
   stale 100–86400000 and >=poll. Empty/partial/NaN/Infinity cannot become zero or persist.
3. Five native selects, only supported enum choices. Missing/stale saved options remain visibly
   invalid (disabled selected placeholder), never substituted. Definition-incompatible FC/codecs
   are disabled with explanation. FC never changes other fields. Codec changes derived Width
   with a notice, retaining Scale/Offset/FC. Invalid loaded Width requires an explicit correction.
   Disabled Devices/Definitions may retain configuration but cannot acquire; no auto-connect.
   String and COMMAND_ONLY acquisition remain unsupported without making Definitions MISSING.
4. Dedicated Traffic display model/component. Fixed Timestamp, Phase, Device, Origin/context,
   Transaction, Function, Address, Duration, Result, Payload/error columns. Workflow/node/list IDs
   and requestClass in context/details; quantity and encoded payload in details. Native text is
   escaped by React; unknown objects are not serialized or coerced. Zero/false remain meaningful.
5. Tests/harness only for persistence and lifecycle boundaries, plus application version sync.

## Root cause and presentation semantics

The old generic Table selected `Object.keys(firstRow).slice(0,10)`. Optional Workflow/node/list
fields shifted which later fields were displayed; result/payload disappeared for some origins.
Owner confirms A/B were UI columns, not raw JSON: **CLIENT NORMALIZATION DEFECT**.
Traffic alone now uses a dedicated model; generic Runtime Table and App delivery state unchanged.

Phase derives ONLY from existing TX/RX/ERROR direction. Proven origin rules: acquisition class →
Shared Tag Acquisition; monitor class/listId or contractual `monitor:<id>` context → Modbus
Monitor; otherwise an actual workflowId → Workflow; otherwise Generic/Unspecified. A default
`requestClass=workflow` does not establish Workflow ownership. No display-name or address inference.
RX success is a transport response, not Tag GOOD, effective output or verified read-back.

Received order is retained, not sorted by clocks or grouped. Local keys combine a bounded field
fingerprint and view-local monotonically assigned arrival ordinal. Duplicate record occurrences
remain separate; immutable retained object occurrences keep keys across prepends. New REST
objects/route remounts can acquire new keys. No global/persisted event identity, producer eventId,
connectionEpoch or exactly-once claim. Byte-for-byte identical primitive/reused-object events
have only local occurrence identity, not distinguishable producer identity.

At most 5000 display models/cache entries; 50 primary rows per page; one expanded detail row.
Metadata capped at 256 display characters, previews at 96 (plus ellipsis); payload/error/result
retain original strings in the model, with 16384-character detail cap and truncation notice.
Primary text is single-line clipped, details scroll/wrap. Control characters visibly escaped.
Rows are independent accessible detail buttons; pagination and horizontal scrolling are keyboard
reachable. Real layout/focus/screenreader review remains Owner-local, not established by SSR.

Existing Traffic is best-effort: WS coalescing/drops and REST+WS overlaps/replacements remain.
No grouping, removal or dedup by Device/tx/FC/address; transaction IDs can wrap/reuse.
No claim that observed A/B were duplicate events. Not a complete packet capture.

## Locked / excluded

Production Server changes only application version literals. No Modbus emitter, request queues,
priority, framing, generation fences, acquisition scheduler, Store, Device lifecycle, reconnect,
REST/WS envelopes/retention or Workflow/Monitor changes. No second Tag identity. Shared Tags
only deduplicate compatible mappings; cross-owner Workflow/Monitor/Tag reads can duplicate.
No runtime diagnostics endpoint, Tag WS, console observer or Browser Tag-value delivery.
No Overview config/runtime writes, Page revision, independent Preview Control-state, Draft,
Undo/Redo, Save/Cancel, selection/drag/viewport/Inspector behavior changes. No Variable producer,
controls/write guards changes, MQTT/Sparkplug, Historian/HA, permissions or O2-B2/B3/C/D.
No dependency upgrades, advisory fixes, PR, main push, tag, release or ZIP.

## Runtime evidence limits

Existing real service tests now hash Definition/Page/index/mapping/Control-state bytes and check
Page revision/modifiedAt through reload. Actual client Draft/UndoRedo helpers are exercised alongside
acquisition, but this is not mounted Browser integration. Controlled late success AND error after
manual disconnect preserve DISCONNECTED and last-good timestamps. Private test IPC starts two
separate processes with the same configuration directory, using production Store/config/service
classes and a fake connection, proving fresh epoch/no sample/no last-good and persisted mappings.
Actual Server child process test separately proves restart/Browser reconnect never autoconnects
and there is still no Tag WS/API. Neither is hardware/soak or invisible Browser Tag proof.

## Owner-authorized hygiene scope expansion

Includes the existing contextual scanner correction and focused Node-only regression tests.
Ordinary unquoted JS/TS types/references/calls are distinguished from literal credential material;
typed initializers, later same-line candidates, opaque literal call arguments and independent
embedded-secret rules remain checked. Existing severity/strict behavior and exclusions unchanged.
No new word, path, extension or test-file exclusions; no suppression directives or bypass flags.
This is lexical scanning, not a compiler or proof that arbitrary secret encodings can be detected.

The sole final correction is a positive JSON fixture generated using JSON serialization with a
value assembled from two non-sensitive fragments during the test. Its generated content remains
identical to the original true-positive case; the scanner detects it. No complete credential-like
literal is stored in that test-source line. A comment explains the assembly. No actual credentials.
Generated CLI fixtures use a temporary directory outside tracked source and are removed in finally;
the JSON content fixture is scanned directly in memory. No scanner/application change in this fix.
Target stays dev.7. No new dependencies; Full Client/Server/check are not rerun for this fixture fix.
