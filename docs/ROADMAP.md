# Roadmap

## v1.2.11: Monitor Scheduler & WebSocket Reliability

Proposed, pending final acceptance approval. This item is not approved for implementation in the current release:

- Overlapping monitor rounds currently enqueue work into the shared device FIFO without a backlog bound or stop cancellation. Latency can grow without bound and workflow reads may be starved.
- Non-overlapping monitor scheduler
- Idempotent Start/Stop and generation guard
- Cycle/request diagnostics
- WebSocket backpressure handling
- Traffic batching or throttling
- Client automatic reconnect with bounded backoff
- State resynchronization without resetting React Flow
- LIVE, RECONNECTING, and OFFLINE indicator

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
