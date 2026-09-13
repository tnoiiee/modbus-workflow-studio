# Roadmap

## v1.2.9: Monitor and WebSocket reliability

Proposed scope, pending final acceptance approval:

- Non-overlapping Modbus Monitor scheduler.
- Start/stop idempotency and generation guard.
- Cycle duration, active item, and request diagnostics.
- Server WebSocket backpressure policy.
- Batch or throttle high-frequency traffic diagnostics.
- Client WebSocket automatic reconnect with bounded backoff.
- State resynchronization after reconnect without resetting React Flow.
- Live connection indicator.

## v1.3.0: Cross-workflow published signals

- `WORKFLOW_INPUT`.
- `WORKFLOW_OUTPUT`.
- Published Signal Registry.
- Value, quality, and timestamp propagation.
- Missing/stopped/stale source handling.
- Cross-workflow dependency graph.
- Circular dependency protection.

## v1.4.0: Concurrent LIVE arbitration

- Full output ownership and resource claims.
- Conflict resolution and cross-workflow write safety.
- Shared polling optimization.
- Improved dependency and ownership diagnostics.

## Deferred

- Modbus Multi Output.
- Write operations from Modbus Monitor.
- Long-term historical trending and logging.
- Workflow UI redesign.
