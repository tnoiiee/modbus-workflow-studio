# Current Project State

## Current working version

`v1.2.11` local follow-up implementation on the session branch.

The v1.2.10 publication and the documentation-only v1.2.11 planning change remain the baseline. v1.2.11 source changes are being developed locally; no follow-up pull request has been opened in this closed session.

## Publication and history state

- v1.2.10 has been published.
- The repository was created again as a clean repository with exactly one commit before the publication workflow.
- The documentation-only v1.2.11 planning change was merged through PR #1; its merge commit is `9004125b8c9047136807d2d84b648135bb96e38e`.
- Publication date recorded for this baseline: `2026-09-21`.
- History remediation is complete for this repository; no further history rewrite is required.
- Operational backup material, if retained, must stay outside Git in access-controlled storage.
- Thai operational procedure: [docs/CLEAN_HISTORY_PUSH_RUNBOOK_TH.md](CLEAN_HISTORY_PUSH_RUNBOOK_TH.md)
- English operational procedure: [docs/CLEAN_HISTORY_PUSH_RUNBOOK.md](CLEAN_HISTORY_PUSH_RUNBOOK.md)

## Current capabilities

- React Flow workflow editor and workflow CRUD
- Concurrent isolated workflow runtime sessions
- Shared project-level Modbus connections and per-device queues
- FC01-FC04 reads and FC05/FC06/FC16 writes
- Single Modbus Input and Output
- Independent Modbus Multi Input with 1-8 sub-inputs
- Per-sub-input FC, address, data type, order, scale, offset, unit, scan interval, runtime, quality, lamp, and source port
- Manual Trigger and Timer blocks
- Boolean logic symbols and status lamps
- Linear Mapping
- Reliable auto-save and revision recovery
- Audit Viewer, Runtime Monitor, Traffic Monitor, and Validation
- Read-only Modbus Monitor with lists, Add Item, Add Range, continuous monitoring, and CSV export
- Single-flight monitor scans with one pending scan/list, generation invalidation, cancellation, queue diagnostics, and bounded per-device admission
- Bounded WebSocket client queues with telemetry coalescing/drop behavior and control/state resync signaling
- Client duplicate-socket prevention, jittered reconnect, status transitions, and revision-safe resynchronization
- Output ownership conflict protection

## Local validation status

Observed during this local implementation session:

- `npm run typecheck` passed for server and client.
- `npm test` passed: server 3 test files/13 tests and client 2 test files/3 tests.

Still required before calling the implementation release-ready:

- Full `npm run check` including client tests and production builds.
- Browser/E2E reconnect, queue pressure, and revision-resync checks.
- Modbus simulator and live hardware acceptance with read-only monitor and write-safety verification.
- Hygiene and release evidence for the follow-up change.

## Resolved v1.2.11 reliability issues

1. Monitor cycles no longer overlap for a list: one scan is in flight and one follow-up scan is pending; additional requests coalesce.
2. Stop, delete, disconnect, update, and restart paths invalidate monitor generations and cancel queued/active monitor work without publishing stale values.
3. Monitor admission is bounded per device with coalescing/drop diagnostics; workflow reads and priority writes retain queue priority.
4. WebSocket delivery now has per-client message and byte bounds, telemetry coalescing/drop handling, and control-event resync signaling.
5. The browser reconnects with bounded jitter, prevents duplicate sockets, reports status transitions, and reloads revisioned REST state after reconnect.

## Remaining operational boundary

Authentication remains outside the application. Keep deployment on a trusted local or industrial LAN and follow [docs/ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md) for local/CI, browser/E2E, simulator, hardware, and release evidence.

## Publishing controls

- `.gitignore` and `.gitattributes` keep secrets, runtime data, build output, logs, databases, archives, and editor artifacts out of Git.
- `scripts/hygiene-check.mjs` audits the worktree, staged index, tracked tree, reachable history, and the combined `--all` mode with masked evidence.
- `.githooks/pre-commit` and `.githooks/pre-push` block unsafe publication after `npm run hooks:install` registers them in a clone.
- `.github/workflows/hygiene.yml` applies the hygiene gate on pushes and pull requests.
- `scripts/prepare-clean-history.mjs` creates recovery material and a clean single-commit history without pushing or configuring a remote.
