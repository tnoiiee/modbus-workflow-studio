# O2-B3 — Overview Read-only Live Rendering — v1.4.0-dev.10

Owner FINAL APPROVED from `9d73d96ee910ac3ad1ad2a83a5572dbe77c1b309` / dev.9,
branch `arena/01a0d291-modbus-workflow-studio`. O2-B2 is APPROVED AS TRANSPORT FOUNDATION.
Owner INTERMEDIATE ACCEPTANCE supersedes the original Stage-1-only stop: Stage 1 **997/63 accepted**.
Full Gates, exactly one commit and normal push to this development branch are now authorized.
Then STOP for Owner Local Manual Review, which remains **PENDING**.

## Locked boundaries

SHARED_TAG acquisition → existing Store → existing Snapshot / dedicated Tag WS → unchanged B2
headless client → Overview-specific external presentation store → read-only monitoring child.
No second transport/poller, Browser Modbus/MQTT, command, write, producer or protocol extension.
No Runtime values in Page JSON, Definition metadata, Draft/history, Preview Control state or Flow
node configuration. Canvas geometry/interaction/viewport and Binding resolver matrix are unchanged.
No confirmed replay-complete / caught-up / synchronized freshness / exactly-once claim.

Server production changes: version literals only in index.ts. Server version expectations only.
B2 server modules and client tagRuntimeClient.ts/tagDeliveryProtocol.ts/reconnect.ts unchanged.
No persisted Element fields, custom number-format settings or dependency graph changes.

## Monitoring matrix

| Element | Supported presentation |
|---|---|
| NUMERIC_LABEL | finite Number only; Definition unit |
| STATUS_LIGHT | Boolean TRUE/FALSE; no switch/control semantics |
| VALUE_BADGE | finite Number + unit, or Boolean TRUE/FALSE |
| TEXT_LABEL / String-bound VALUE_BADGE | Binding/availability only; explicit unsupported String producer; no process text |

No Runtime behavior for PICTURE_BOX, decorative Elements, SWITCH, PUSH_BUTTON or NAVIGATION_LINK.
No inference from Tag names, legacy tagId, address, Workflow variables or navigation IDs.
Only visible, explicitly complete SHARED_TAG, MONITOR, BOUND, type-compatible Elements enter selection.
String-bound BOUND identities can receive availability; they never become supported String acquisition.
Dedup/sort/selectionKey use B2 canonicalTagSelection; no second canonicalization implementation.

## Ownership and lifecycle

One stable adapter/store per mounted Overview, with at most one active B2 client. App already keeps
Overview mounted when hidden: active=false is a real lifecycle boundary, not just an unmount check.
Provider enables only active + VIEW + matching loaded Page ID + valid nonempty selection.

Page-loading request generations reject out-of-order configuration load completions. Confirmed
navigation fences the old Runtime before await. Runtime callbacks also carry an adapter generation,
in addition to B2 socket/operation/subscription-generation fences. No App.load() for recovery.

Edit synchronously stops the adapter and removes live rendering. Existing EDITOR PREVIEW/Binding
presentation, selection/selected-only drag/resize/Inspector remain. Save success returns to a fresh
View Snapshot; Save failure stays unsubscribed in Edit; Cancel uses saved baseline. Page navigation,
inactive Overview, empty selection and disposal close the client and cancel presentation/age/core timers.
Unsubscribe is sent where established, followed by disposal; retired callbacks never affect the new Page.

Provider starts via one generation-checked microtask so StrictMode setup/cleanup/setup does not open
two active clients. No Flow remount/key on cursor or generation. Hidden browser tabs and offline
browsers pause/close delivery; return/online uses a fresh Snapshot. Acquisition remains server-owned.

The IO composition delegates to browserTagIO. B2 validates/caches Snapshot before calling socket();
the adapter reads that validated public cache once at this boundary, presents Snapshot/Connecting,
then delegates the single socket creation. No direct second Snapshot or WebSocket path is introduced.
Initial Snapshot is never described as confirmed live/caught-up. B2 subscribed only means transport
connected; UI explicitly says latest received and catch-up is not confirmed.

## Four independent state axes

Binding: NOT_BOUND / DRAFT / BOUND / MISSING / INCOMPATIBLE, unchanged resolver semantics.
Availability: available, missing/disabled Definition, unconfigured/disabled mapping, missing/disabled/
disconnected Device, unsupported/incompatible producer, no sample. Binding BOUND is not readiness.
Quality: actual GOOD / UNCERTAIN / STALE / BAD / DISCONNECTED; no UNKNOWN or synthesized BAD.
Browser transport: Connecting / Connected / Reconnecting / Resynchronizing / Offline / Error / Disposed.
Browser disconnect never relabels Device/sample quality. Connected does not mean all Tags are GOOD.

GOOD shows actual value; UNCERTAIN with value is explicit; no-sample shows em dash, never 0/false.
STALE is labeled and styled differently. BAD/Device DISCONNECTED/unavailable may show last-good only
with explicit Last good label and its original timestamp. False differs from no sample, bad or offline.
String caption is configuration text, never process value. Invalid types/nonfinite values fail closed.
During short reconnect retained data is visibly cached; discontinuity/resync clears old continuity.

Number format is client-only: ≤6 decimals, scientific at |x|≥1e9, 0<|x|<1e-6 or >16 normal characters;
full JS Number precision is available in details. -0 is displayed as 0 only; no Boolean/String coercion.
Unit comes only from the current Definition Catalog (≤80 chars); metadata uses existing catalog
refresh on active/focus/manual refresh, not a new metadata or Runtime polling loop.
Captions are clipped at 120 Unicode code points, unit preview at 16; full text is in details.
Tabular numerals/clipping prevent value-driven Element resizing; very small Elements have a Page-level
keyboard details list instead of forced geometry expansion.

Receive time is Server receiveTimestamp, not fabricated source time. Missing sourceTimestamp stays
not supplied. Last-good time is never refreshed by rendering/quality changes. Clock skew/invalid time
has an explicit limitation. Connected age ticks ≤1 Hz; stopped/offline/error clocks show absolute
receive time with age paused, never a frozen duration masquerading as current elapsed time.

## Resources and publication

- 200 eligible Elements / 200 unique SHARED_TAG identities per Page. Reject whole Runtime selection
  on excess; never silently select a subset. Configuration/Edit stays usable.
- 512 KiB serialized presentation items / 200 items. Separate from B2 canonical cache and its original
  512 KiB / 64 pending frames / 64 KiB frame limits. Payload-byte bounds are not whole-process RSS.
- Presentation batches no faster than once per 200ms (5 Hz) after initial Snapshot. Every protocol
  frame is still applied/ACKed by B2 independently of painting. No chart/history/sample ring buffer.
- Safety invalidation/transport transitions are immediate; they do not publish new process samples.
- Changed callbacks merely schedule one timer; cache is not cloned per callback. At bounded flush,
  unchanged item references are reused. Checkpoint-only traffic does not notify value subscribers.
- Keyed item subscriptions, separate status/clock subscriptions. Max 256 each observer class;
  normal page uses ≤200 value consumers plus details. Presentation cache does not retain signature copies.
- One shared age timer; no per-Element timers. All scheduled work and browser listeners have cleanup.

These are initial tested limits, not render-speed/heap/latency certification. Unit listener counts
are not claimed as measured browser React commits; actual React Profiler/browser review is separate.

## Recovery budget and failures

B2 alone owns reconnect scheduling (250ms→30s ceiling ±20% jitter, up to 36s actual). Composition
counts actual automatic CONNECTING attempts after a recovery notification, max five in rolling 60s.
Initial View Snapshot and explicit Manual Retry are not automatic attempts. Once exhausted, adapter
cancels pending automatic work and latches Error. Manual Retry is limited to one per second and does
not erase the automatic window. Rolling-window timestamps expire after 60s; a budget Error does not
self-restart when they expire. Stable Connected for ≥60s permits budget reset; a brief subscribed
message does not reset it. View re-entry/navigation does not erase recent automatic attempts.

Budget/permanent-error cancellation after RECOVERING is deferred one guarded microtask so B2 can
finish installing its timer before disposal cancels it. No second reconnect loop or B2 code change.
HTTP 400/403/413 and body-too-large fail visibly rather than automatic storms. Generic WS failure is
not guessed to be Origin rejection. Other transient failures/resync/expiry/epoch/selection/protocol/
queue errors use B2 recovery under the same budget. Partial Tag unavailability is per item, not a
whole-Page transport failure. No exception/error path mutates configuration or commands a Device.

## Accessibility and controls

Quality/recovery is text as well as color; lamps are read-only indicators, not switches. No output
or per-sample aria-live regions. Page transport/error announcement is polite and debounced 500ms.
Runtime details use the existing Modal's keyboard/Escape/focus-return behavior, portaled outside Flow
transforms; changing samples does not recreate its focus effect. Reduced motion, long text and small
Elements have dedicated scoped rules. Browser keyboard/screen-reader certification remains pending.

SWITCH/PUSH_BUTTON retain independent preview interactions/state, with persistent readable PREVIEW /
CONTROL RUNTIME NOT ENABLED content not hidden by legacy View badge CSS. No command/Modbus write,
Workflow injection, LIVE ARMED or Commanded/Effective/Read-back extension. Navigation remains navigation.
Page Runtime information states trusted LAN/authenticated proxy only; Origin is not authentication;
no integrated authentication/authorization or public-Internet readiness. It is not repeated per Element.

## Exclusions and handoff

No WVar producer, Variable Blocks, general String decoding, persisted custom formatting, Picture Box,
assets, O2-C, O2-D, MQTT/Sparkplug, Historian, HA, durable replay, authentication, dependency upgrade,
hardware/24x7 certification. Existing advisories remain 5 moderate /1 high /1 critical, unresolved/unaccepted.

Stage 1 results and exact files: [acceptance](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.10.md).
Exactly one authorized commit: `feat(overview): add O2-B3 read-only live rendering`, only after all
Full Gates and final scope verification pass. Normal push only; no retry/force if rejected. Verify
Actual Remote equals HEAD, clean tree and staged zero, then STOP for Owner Local Manual Review.
Manual Review **PENDING**, not performed; no PR, tag, release, ZIP, O2-C or O2-D.
