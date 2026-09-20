# Current Project State

## Current working version

`v1.2.10`

## Publication and history state

- v1.2.10 has been published.
- The repository was created again as a clean repository with exactly one commit.
- Default branch: `main`
- Default branch commit SHA: `aea05e2be99461f0f5bc3b133278841f3763c4d3`
- Publication date recorded for this baseline: `2026-09-21`
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
- Output ownership conflict protection

## Validation status

Validation evidence is recorded in [docs/ACCEPTANCE_TESTS/v1.2.10.md](ACCEPTANCE_TESTS/v1.2.10.md). The record distinguishes commands actually run from browser checks or operational checks that were not run in this environment.

## Known issues

1. Continuous monitor cycles may overlap.
2. Monitor traffic can create high WebSocket event volume.
3. Server WebSocket broadcast has no explicit backpressure policy.
4. Traffic events are not batched.
5. Client WebSocket has no automatic reconnect.
6. State is not resynchronized automatically after WebSocket loss.
7. Vite may log `write ECONNABORTED` under high monitor/proxy load.

## Next proposed target

`v1.2.11`, Monitor Scheduler and WebSocket Reliability. The planning scope is approved, but implementation is not included in this release. See [docs/PHASE_PLAN_v1.2.11.md](PHASE_PLAN_v1.2.11.md) and [docs/ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md).

The plan includes bounded handling for overlapping monitor cycles that currently enqueue work into a shared device FIFO without a backlog bound or stop cancellation. Without those controls, latency can grow without bound and workflow reads may starve. It also covers WebSocket reliability; no scheduler, WebSocket, React Flow, workflow runtime, Modbus semantics, or safety behavior was changed in the planning/documentation update.

## Publishing controls

- `.gitignore` and `.gitattributes` keep secrets, runtime data, build output, logs, databases, archives, and editor artifacts out of Git.
- `scripts/hygiene-check.mjs` audits the worktree, staged index, tracked tree, reachable history, and the combined `--all` mode with masked evidence.
- `.githooks/pre-commit` and `.githooks/pre-push` block unsafe publication after `npm run hooks:install` registers them in a clone.
- `.github/workflows/hygiene.yml` applies the hygiene gate on pushes and pull requests.
- `scripts/prepare-clean-history.mjs` creates recovery material and a clean single-commit history without pushing or configuring a remote.
