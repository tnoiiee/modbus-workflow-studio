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

## UI baseline gaps recorded for v1.2.12

These are baseline facts, not defects introduced by v1.2.11. Owner decisions on 2026-09-22 fixed how v1.2.12 must treat them (see [SCOPE_v1.2.12.md](SCOPE_v1.2.12.md) and [ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md)):

- **Project Settings does not persist.** The page renders default values and its save button has no handler or API call; there is no settings endpoint used by the UI. v1.2.12 redesigns this page UI-only, must not show a false successful-save state, and must clearly communicate that changes are not stored (decision A, row v1.2.12-E11).
- **Traffic Monitor has no clear action.** `DELETE /api/traffic` exists server-side but is unused by the client. Adding a Clear button is not approved for v1.2.12 (decision B, row v1.2.12-E08).
- **Undo, Redo, and Fit View are keyboard/widget only.** No visible command-bar controls exist today. v1.2.12 adds visible controls on the existing logic without changing history semantics or React Flow state ownership, and Fit View must not mutate persisted node positions (decision C, rows v1.2.12-D14 to D18).
- **No native-dialog replacement exists.** The UI uses 15 `window.prompt` / `window.confirm` / `alert` call sites; v1.2.12 must replace all of them with application modals, confirmations, toasts, and inline validation (row v1.2.12-C04).
- **No design tokens or shared primitives.** `client/src/styles.css` defines a single custom property and the whole UI lives in one 92 KB `App.tsx`; v1.2.12 introduces tokens, primitives, and a behavior-preserving decomposition (rows v1.2.12-B01 to B06).

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
