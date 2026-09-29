# O2-B2 — Tag Runtime Delivery Foundation — v1.4.0-dev.9

Owner FINAL APPROVED implementation, and subsequently ACCEPTED Stage 1 and authorized
Full Gates plus one normal-push development checkpoint, from approved O2-B1
`86b342b2eec5377773be45d3744d29509c2a64ce` / v1.4.0-dev.8.
Branch: `arena/01a0d291-modbus-workflow-studio`. Intermediate review is complete; commit/push
requires successful Full Gates and final scope verification. Owner Local Manual Review is PENDING.
O2-B1 is Owner ACCEPTED / Manual PASS; historical pending statements in dev.8 artifacts are historical.

## Authority and non-goals

Read-only delivery of the existing memory-only SHARED_TAG Store. No producer changes, Device
connection ownership, acquisition requests, persistence writes, Overview values or normal App
startup subscription. WORKFLOW_VARIABLE definitions/bindings are retained, but that producer is
deferred; its absence is not reclassified as a missing definition. SelectionKey/cursors are not Tag
identities. Binding BOUND is not runtime authority. Five Binding resolver statuses remain unchanged.

**EDITOR PREVIEW / CONTROL RUNTIME NOT ENABLED**. No O2-B3, O2-C, O2-D, Control writes, WVar
producer, Variable Blocks, String decoding, cross-owner read broker, Picture Box/assets, MQTT,
Sparkplug, Historian, HA, durable replay, exactly-once, authentication or dependency upgrades.
Traffic FUNCTIONAL PASS; density/timestamps/payload/error/scroll/responsive polish stays O2-D.
Workflow/Monitor/Shared Tags can still issue duplicate reads across owners. No hard real-time claim.

## REST contract

`POST /api/tag-runtime/snapshot`, `Content-Type: application/json`:

```json
{"protocolVersion":1,"sources":[{"sourceType":"SHARED_TAG","sourceId":"11111111-1111-4111-8111-111111111111"}]}
```

Strict object/identity schemas; 1–200 raw identities **before deduplication**, UUID sourceId only.
Reject extra fields, acquisition/FC/address/Device selectors, unsupported identity types/versions.
Deduplicate exact sourceIds, sort lexicographically (case preserved), serialize without whitespace:
`JSON.stringify({protocolVersion:1,sources:sortedUniqueIdentities})`. Each identity has properties in
`sourceType,sourceId` order. This injective canonical serialization is **selectionKey**, not a hash,
Tag identity, display name or persistence revision. Client/server contract parity is tested.

Response: `protocolVersion:1`, `scope:"TAG_RUNTIME"`, `serverEpoch`, opaque `cursor`, `selectionKey`,
`capturedAt` ISO timestamp, `items`. Exactly one item per unique requested identity; item contains
`source`, `availability`, `reason`, `sample` (actual Store clone or null). Sample properties, embedded
sampleSequence/epoch/timestamps/last-good and scalar zero/false remain intact. No synthetic GOOD,
BAD, UNKNOWN, zero, false or empty-value substitute. Active Store no-sample is actual
UNCERTAIN/hasValue:false/reason:NO_SAMPLE; absent Store sample is null, not a fabricated quality.

Availability precedence: DEFINITION_MISSING, DEFINITION_DISABLED, UNSUPPORTED (String or
COMMAND_ONLY), UNCONFIGURED, MAPPING_DISABLED, DEVICE_MISSING, DEVICE_DISABLED, INCOMPATIBLE,
then Store NO_SAMPLE / DISCONNECTED / AVAILABLE. Availability is separate from Binding resolution
and sample quality; an unavailable item may retain an actual last-known Store sample until the
producer removes it. A BAD or STALE sample with a retained value stays BAD or STALE, never GOOD.
Delivery does not make it valid for production control. Modbus sourceTimestamp remains null.

All endpoint responses use Cache-Control:no-store. Request 32 KiB; response **512 KiB** JSON UTF-8,
reject 413 rather than truncate. Strict route runs before legacy CORS/body parsing. Aggregate token
bucket 20 requests/sec, burst 20 (includes preflight); 8 admitted bodies, 5s body deadline. 400 for
invalid/version/body, 403 Origin, 405 method, 408 slow body, 429 capacity/rate, 503 delivery unavailable.
Compressed requests are not inflated. GET is not a snapshot shortcut.

## Broker, atomic handoff and restart

One Store observer, instantiated before acquisition starts; only get/subscribe are used. Observer
projects and journals synchronously, never awaits a network send. Failure fences delivery and cannot
throw into the producer. Read-only config notifications likewise cannot fail a successful CRUD write.
Definition/Device mutation completion, acquisition-config notifications (after producer reconciliation)
and Device state events invalidate watched availability. No producer/config/persistence semantics change.

Snapshot projection and cursor capture share a synchronous boundary. A successful snapshot creates
60s availability watches; subscriptions reference them; the last release retains a 60s resume lease.
Watches/leases share the global 2,000-identity cap. No HTTP-client pinning, per-IP map or unbounded
snapshot-token table. A missing watch/expired lease requires a fresh snapshot even if journal coverage
would otherwise suffice. Each newly created/recreated watch journals a fresh availability boundary;
its coverage-start fences older cursors, even if another client later refreshes that same identity.
Snapshot-only clients can consume bounded lease capacity for at most 60s.

DeliverySequence is independent of Store sampleSequence, Traffic/liveRevision, Page revisions and
Workflow state. Updated/removed events preserve Store sampleSequence; availability events do not
invent one. Cursor is authenticated, opaque, epoch + sequence + SHA256(selectionKey) bound; signing
key is memory-only. Restart invalidates it. Clients must not decode, increment or reinterpret it.

Journal is ordered FIFO, **16,384 events / 16 MiB serialized JSON / 60s**, first reached bound evicts.
Subscribers cannot pin it. Range reads use bounded indexed lookup (up to 128 events), not a full
retained-journal scan on every idle client tick. Failed coverage, ahead cursor, wrong epoch/selection,
invalid signature or lease expiry explicitly requests resynchronization. Replay after S and live use
the same ordered range pump, avoiding a replay/live registration gap. Restart is a new epoch, not replay.
Memory is not durable; payload-byte caps are not a claim about total V8/process RSS.

## Dedicated WebSocket protocol v1

`/ws/tag-runtime`, noServer WS, no compression. Exactly one server upgrade dispatcher routes this
and `/ws/live`; unknown paths get 404. Legacy envelopes, queues, resync, Traffic and reliability
limits are unchanged. There is no competing path listener and no silent migration of legacy clients.

All controls contain protocolVersion:1 and requestId (1–64 chars):

- subscribe: generation (positive safe integer, monotonically increasing per connection), sources,
  selectionKey, snapshot/resume cursor. Server assigns subscriptionId UUID.
- ack: subscriptionId, generation, last fully applied cursor. ACK is connection flow control only;
  no durable/Modbus acknowledgement, write action or exactly-once guarantee.
- unsubscribe: subscriptionId, generation. Acknowledgment fences further frames for that subscription;
  queued frames are removed before acknowledgment. Stale generation controls cannot affect replacements.

Server `subscribed` includes requestId, subscriptionId/generation/selectionKey/serverEpoch and cursor.
`delta`/`checkpoint` include context, opaque fromExclusive/toInclusive and updates. Delta updates have
ordered deliverySequence, kind (updated/removed/availability), optional Store sampleSequence and full
item. Checkpoint updates is empty: unrelated identities were scanned, not lost. Checkpoints at most
4/sec/subscription. Client must require fromExclusive equal last applied cursor; filtered events do not
constitute gaps. Ranges are split by actual UTF-8 bytes; no middle-event coalescing or silent dropping.

`unsubscribed` includes requestId and context. `error` is a bounded control error; `resync-required`
may be connection-wide (protocolVersion, serverEpoch, reason, optional requestId), covering all its
subscriptions. On overflow/expiry/failure, queued work is discarded only with explicit resync/close,
not alleged continuity. Safe resync send followed by close 1013; terminate if unsafe, or after 1s.
No Tag frames are carried by the legacy channel.

### Server delivery bounds

| Resource | Bound |
|---|---:|
| Tag connections | 16 |
| Subscriptions / connection | 4 |
| Raw identities / subscribe | 200 |
| Distinct identities / connection | 500 |
| Global distinct watched/requested identities incl. leases | 2,000 |
| Incoming control / outgoing frame | 64 KiB each |
| Queued frames / bytes per connection | 256 / 1 MiB |
| WS bufferedAmount | 1 MiB (prospective frame included) |
| Outstanding ACK boundaries / subscription | 256 |
| Unacknowledged progress deadline | 10s **only while an advancing delivery is pending** |
| Pump | one shared 50ms timer, max 128 scanned events/subscription/tick |
| Upgrade rate | aggregate 4/sec, burst 16 |
| Subscribe churn | 2/sec, burst 4 per socket |
| Unsubscribe rate | 4/sec, burst 8 per socket |
| ACK rate | 64/sec, burst 128 per socket |
| Invalid controls | close on third per connection |

Incoming control is 64 KiB because a full 200-ID subscribe contains both sources and the canonical
selectionKey; REST request stays 32 KiB. Queue excludes one in-flight send (it is also subject to WS
buffer checks). There is no heartbeat ACK requirement on an unchanged/idle subscription. Close,
error, overflow, unsubscribe and shutdown release subscriptions/queued work; leases expire separately.

## Opt-in headless client

`client/src/lib/tagRuntimeClient.ts`, explicit `start()`, `unsubscribe()`, `dispose()`. Constructor/import
has no network side effect. Default adapter uses relative REST and same-origin ws/wss; no browser
localhost or App.load recovery. Snapshot reads stream with a 512 KiB cap before JSON parsing.
Injectable IO supports deterministic tests; custom adapters must honor AbortSignal and bounded payloads.

One subscription / 200 identities per instance; immutable canonical selection; cache **200 items /
512 KiB serialized items**, incoming 64 KiB/frame, pending apply 64 frames /512 KiB, one scheduled
apply callback, one socket, one abortable request; at most three timers (reconnect, ACK, deadline).
One bounded 128-char local error code, not an unbounded error/event list. Snapshot/subscribe deadline
10s, unsubscribe deadline 2s, ACK coalescing 100ms. Dispose cancels requests/timers/queues/callbacks.

Reconnect reuses existing 250ms→30s exponential ceiling, ±20% jitter, attempt counter capped at 8
(actual jittered maximum can be 36s). Cached state + matching applied cursor resume without relabeling
Device/sample quality. Epoch/gap/context/replay expiry/overflow -> clear continuity and new snapshot.
Duplicate range is treated conservatively as a discontinuity, not applied twice. Request correlation,
socket operation and subscription generation fence stale callbacks. Apply is atomic; ACK follows cache
application, not UI rendering. Consumer callbacks cannot corrupt bookkeeping. Last-good data is never
rewritten because the browser transport disconnected. Client cache over-limit requires smaller selection
or smaller actual data; it is not silently truncated.

## Origin/deployment boundary

Default permits missing-Origin non-browser clients and http(s) Origins whose host:port equals the
request Host. `TAG_ALLOWED_ORIGINS` adds exact comma-separated http(s) origins, e.g.
`http://localhost:5173,https://studio.example.org`. Wildcards/credentials/path/query/fragment are rejected.
`TAG_ALLOW_MISSING_ORIGIN=false` rejects missing-Origin requests. Null/untrusted origins are rejected.
No Preview URL is hardcoded. A trusted proxy should preserve public Host or configure its public Origin
explicitly; X-Forwarded-* is not blindly trusted. CORS policy is scoped to this new endpoint/channel.

Origin/CORS is **not authentication**. No integrated auth/permissions/user management. Deploy only on
trusted LAN or behind an authenticated proxy; TLS/firewall/access policy are external. These bounded
Tag adapters do not promise whole-server Internet DoS protection or change legacy endpoint security.

## Protected implementation surfaces

Existing production behavior edits: **server/src/index.ts only**, for composition, single upgrade
routing, read-only invalidation, cleanup and version labels. New server modules own the new protocol.
`tagRuntime.ts`, `sharedTagAcquisition.ts`, acquisition config/schema/routes/codecs, Definition CRUD,
Device policy/framing/queues, Workflow writes/guards, Monitor and persistence are untouched. App,
Overview, Acquisition editor, Traffic and legacy WS handler code are untouched apart from index
attachment/version. Historical dev.8 acceptance artifacts remain unchanged.

Stage 1 results, exact files and limitations: [acceptance](ACCEPTANCE_TESTS/O2-B2-v1.4.0-dev.9.md).
Owner intermediate acceptance authorizes Full Gates / one commit / normal push and Actual Remote
verification, without functionality additions. Stop afterward for Owner Local Manual Review (PENDING).
