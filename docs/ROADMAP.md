# Roadmap

## v1.2.11: Monitor Scheduler & WebSocket Reliability

The implementation is in progress locally on the follow-up session branch. The approved scope and acceptance matrix remain the source of truth: [docs/PHASE_PLAN_v1.2.11.md](PHASE_PLAN_v1.2.11.md) and [docs/ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md).

Implemented locally so far:

- Single-flight monitor scheduling with one in-flight scan and one pending scan per list
- Idempotent Start/Stop, generation guards, cancellation, disconnect invalidation, and stale-publication suppression
- Bounded per-device monitor admission with coalescing/drop diagnostics
- Workflow-read and priority-write ordering ahead of monitor pressure
- Per-client WebSocket message/byte bounds, telemetry coalescing/drop handling, and state resync signaling
- Client duplicate-socket prevention, jittered reconnect, status transitions, and revision-safe REST resynchronization

Local validation has covered server/client typechecks, server reliability/unit tests, client baseline tests, production builds, API health, and a basic WebSocket snapshot exchange. Browser/E2E, Modbus simulator, live hardware, and release-gate evidence remain required before release readiness is claimed.

## v1.3.0: Cross-workflow published signals

- WORKFLOW INPUT
- WORKFLOW OUTPUT
- Published Signal Registry
- Value, quality, and timestamp propagation
- Missing, stopped, bad, and stale source policies
- Dependency graph and circular dependency protection

## v1.4.0: Concurrent LIVE arbitration

- Full output ownership and resource claims
- Conflict resolution and cross-workflow write safety
- Shared polling optimization
- Ownership diagnostics

## Deferred

- Modbus Multi Output
- Write operations from Modbus Monitor
- Long-term historical trending
- Workflow UI redesign
