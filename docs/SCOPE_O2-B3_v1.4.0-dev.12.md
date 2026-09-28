# O2-B3 v1.4.0-dev.12 — HMI Presentation Polish

Owner final approval: Client presentation only, based on
`2e90a03c75259f7e0e3cc0f2afd372ac87c478fd` / dev.11 on
`arena/01a0d291-modbus-workflow-studio`. Dev.11 Runtime functionality and lifecycle are
Owner APPROVED, including focus, single active View session, Edit/inactive cleanup and re-entry.

## Operator hierarchy

- Configured Text is a secondary caption, omitted when blank (including whitespace-only).
  No Definition/Source/ID/address fallback. The readout and optional unit are primary.
- Numeric Label: caption above the value; compact saved dimensions use one-line alignment.
  Value Badge uses compact caption/value alignment. Status Light is a passive indicator with
  TRUE/FALSE text, never a switch or a command. Missing data is not FALSE or zero.
- GOOD has no repeated status. UNCERTAIN value is marked; absent value says Awaiting data.
  STALE appears once with age/clock-skew or paused-age context. BAD never promotes the failed
  sample to a current value; last-good is explicitly historical. Device disconnected appears
  once, with Last good when a historical value exists. Browser recovery labels cached data
  without rewriting canonical Device quality. Page transport carries the detailed state.
- String producer remains unsupported; caption is not process text and unsupported does not
  redefine Binding as MISSING. No decoding, coercion or new producer.
- Internal reason codes, stable identities, Binding, transport, full timestamps and full
  precision are on demand. Existing modal additionally displays separate latest received
  sample (quality applies) and historical last-good value fields.

## Layout/accessibility

Existing theme colors, borders and typography; tabular numerals, restrained scale, ellipsis
and fixed saved outer dimensions. No geometry mutation or autosizing based on sample length.
Monitoring-only body class and styles; Edit and Preview controls use existing rendering.
Small dimensions use a compact/micro layout. Full caption/value/status remain accessible in
the read-only group's accessible name/title, with a native Details button and the existing
Page-level Details list as fallback for Elements too small to fit a useful hit target.
Important abnormal status has explicit text and a visible attention mark, not color alone.
No sample-driven aria-live, focus effects, transitions or flashing. Reduced motion respected.
Existing Details Modal retains native close button, Escape, focus return and bounded Tab
navigation with an exit. Real browser/screen-reader and tiny-size hit testing remain manual.

Page status emphasizes transport, selected Tag count and nonzero stale/unavailable/uncertain
counts. Counts are read-only projections from the existing cache on its existing 1 Hz clock;
no new per-Tag subscriptions, timers, reconnects or Store behavior. No automatic age-based
quality inference. Failures, recovery exhaustion, selection limits and disabled state remain
outside the disclosure. Trusted-network limitation is always visible; full safety/replay
caveats and small-Element Details links remain in expandable content.

## Hard locks

Canonical runtimePresentation value/quality/availability/number-format logic remains intact;
new operator wording and diagnostic/count helpers consume it without changing semantics.
No B1 acquisition, Store, B2 Snapshot/WS/cursor/ACK/replay/resync/backpressure/Origin changes.
No dev.11 Catalog/focus hotfix, Provider/session/adapter lifecycle or recovery changes.
No Binding resolver/matrix, persisted Element schema, Page/Draft/UndoRedo/revision, geometry,
savedViewport, Definition/mapping or Preview Control-state persistence changes.
No Device lifecycle/Manual Disconnect, Workflow/Monitor/Traffic, /ws/live or write-safety change.
Server is application-version synchronization only. Dependencies/resolutions/integrities locked.
No Production Control, WVar Runtime, String decoding, persisted formatting/prefix/suffix,
alarms/history/trends/Picture Box/assets, O2-C/O2-D, MQTT/Sparkplug, HA or authentication.

## Delivery

Target v1.4.0-dev.12; one commit `fix(overview): refine O2-B3 HMI runtime presentation`,
normal push to the session branch, no PR/tag/release/ZIP. Validate Stage 1 then Full Gates,
verify scope and Remote, and stop for Owner local review. No hardware/24-hour soak claims.

See [acceptance, file scope and execution results](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.12.md).
