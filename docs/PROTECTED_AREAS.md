# Protected Areas

## React Flow workflow editor

- Canvas must not become empty after runtime events, workflow switches, saves, or reconnect work.
- Runtime updates must not replace persisted node configuration.
- Dynamic handles must remain aligned and connectable without refresh.
- Deleting one node or edge must not remove unrelated data.
- Undo/redo must preserve node settings, ports, and edges.
- Existing Workflow UI and interaction patterns must not regress during backend work.

## Reliable auto-save

- Parameter changes remain debounced.
- Workflow saves remain serialized per workflow.
- Latest snapshot wins.
- Revision conflicts recover safely.
- Save status must not remain indefinitely at `Saving...`.
- Switching workflows must not write configuration across workflows.

## Runtime isolation

- Runtime, timers, pollers, triggers, and output state remain isolated by workflow ID.
- Shared device queues must not merge runtime ownership.
- Stopping one workflow must not stop unrelated workflows.
- STOP ALL must remain available.

## Modbus safety

- Addressing remains zero-based.
- Manual disconnect stops affected polling and invalidates stale queue generations.
- No write occurs without permitted mode, running state, valid configuration, and write enablement.
- Output ownership conflict protection remains active.
- Modbus Monitor remains read-only.
