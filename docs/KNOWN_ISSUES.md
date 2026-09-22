# Known Issues: v1.2.11 source baseline

## Release status

v1.2.11 source/CI closure and selected local reliability scenarios passed, but standalone final release acceptance was not granted. Remaining frontend, safety, pressure, soak, frame-capture, and hardware checks are mandatory carryover gates for v1.2.12. Do not create a v1.2.11 release tag or ZIP.

## Deployment security boundary

Authentication and authorization are outside this application. Keep the gateway on a trusted local or industrial LAN and use an authenticated reverse proxy before broader deployment.

## Dependency audit

Audit observation on 2026-09-22:

- full graph: 5 moderate, 1 high, and 1 critical advisory
- production-only graph: 2 moderate advisories in the Express/qs path

No automatic or forced audit fix was applied because dependency remediation was not part of the v1.2.11 reliability scope. The findings remain unresolved. v1.2.12 must remediate them or record an explicit reviewed risk acceptance before release.

## UI connection status

The reconnect mechanism works in the recorded browser scenario, but the v1.2.11 UI does not visibly present `LIVE`, `RECONNECTING`, or `OFFLINE` labels. Visible connection-state presentation is required in the v1.2.12 UI scope.

## Repeated Stop generation counter

Repeated Stop remained externally state-idempotent and safe, but the internal monitor generation counter advanced from 7 to 21 in the recorded stress run. No active, pending, late, or published stale work remained. This is non-blocking for the source baseline; regression tests must assert safe state rather than a specific internal counter value.

## DATA_DIR restart consistency

Persisted workflow, device, and monitor-list configuration is restored only when a restarted server uses the same `DATA_DIR`. Starting with a different, incorrect, or unset path appears as an empty project but does not prove data loss. Acceptance and deployment procedures must record the exact sanitized `DATA_DIR` configuration.

## Development proxy behavior

Under high monitoring load, a development proxy may report `write ECONNABORTED`. The monitor and WebSocket bounds prevent unbounded backlog, but representative proxy/network load and slow-consumer behavior still require v1.2.12 acceptance evidence.

## Deferred environment acceptance

The following were not completed for standalone v1.2.11 release acceptance and move to v1.2.12:

- full UI behavior regression after the UI redesign
- write-disabled and isolated write-enabled simulator safety
- multiple monitor lists plus workflow reads
- WebSocket slow-consumer pressure
- long-running soak, memory, and handle trends
- approved test PLC and frame capture

See [the v1.2.11 acceptance test](ACCEPTANCE_TESTS/v1.2.11.md), [local evidence](ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md), and [the v1.2.11 phase plan](PHASE_PLAN_v1.2.11.md).

## Reliability configuration

Approved defaults are parsed in `server/src/reliability.ts`: monitor queue 32 jobs/device, one in-flight plus one pending scan/list, WebSocket 256 messages or 1 MiB/client, telemetry coalescing at 100 ms, and reconnect backoff from 250 ms to 30 s with jitter. Changing these limits requires representative-load validation and updated acceptance evidence.
