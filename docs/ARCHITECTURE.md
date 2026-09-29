# Architecture: v1.2.11 source baseline

```text
React 18 + Vite Client
    |-- Relative REST /api
    |-- Revision-aware state reload
    `-- WebSocket /ws/live
          |-- bounded reconnect delay + jitter
          |-- duplicate-socket guard
          `-- explicit resync request
                    |
Express + Node.js Server
    |-- WorkflowManager
    |-- WorkflowRuntimeManager
    |-- ModbusMonitorManager
    |     `-- single-flight/list + one pending scan
    |-- DeviceConnection per device
    |     `-- classified write/workflow/monitor queue
    |-- BoundedLiveQueue per WebSocket client
    |-- Audit and traffic services
    `-- JSON configuration persistence
                    |
              Modbus TCP devices
```

## Configuration and runtime boundaries

Persisted configuration:

- device definitions
- workflow catalog and revisioned workflow definitions
- nodes, edges, positions, parameters, and project settings
- monitor-list definitions

Not restored as active runtime:

- TCP or WebSocket connections
- workflow running state
- monitor running state
- pollers and timers
- runtime values
- pending requests or writes
- live queue contents
- monitor generation counters

Persisted `LIVE_ARMED` state is downgraded to `LIVE_LOCKED` at startup. A restart must use the same `DATA_DIR` to load the same project configuration.

## Concurrent workflow runtime

Each running workflow owns isolated node runtime, engine memory, pollers, timers, Manual Trigger timers, output initialization, and write-on-change state. Workflows share project-level device connections and request queues.

## Guarded Workflow write boundary (v1.4.0-dev.18)

`WorkflowRuntimeManager` is the sole write authority: `MODBUS_OUTPUT → WorkflowRuntimeManager → bounded shared Device queue → DeviceConnection → Modbus frame`. Writes default disabled (`ALLOW_WRITES=false`) and require a running/current generation, `LIVE_ARMED`, owned output resource, enabled/connected/non-manually-disconnected Device, strict typed command/configuration validation, unexpired command and bounded queue admission. The supported contract is FC05 Boolean, FC06 UInt16/Int16, and FC16 UInt32/Int32/Float32/Float64; FC15 is excluded. Stop/Delete/revision changes/manual disconnect cancel queued work and fence stale callbacks. Nothing pending is persisted or replayed.

The legacy `POST /api/nodes/:id/write` route is compatibility feedback only: HTTP 410 `LEGACY_DIRECT_WRITE_DISABLED`, with no Device lookup, connect, queue, frame, write, retry, ownership/runtime mutation, Workflow start/trigger, or sensitive config disclosure. Existing body-size, Origin and security middleware remains; no redirect or replacement public write API exists.

Output safety remains enforced by `ALLOW_WRITES`, connected device state, running workflow state, `LIVE_ARMED`, validation, ownership conflict protection, write policy, and optional Server Tag Runtime Store-backed SHARED_TAG observation. Optional read-back creates no poller/connection and cannot authorize or block a write.

## Device request admission

A `DeviceConnection` classifies work as workflow, monitor, or write traffic:

- priority writes remain ahead of workflow and monitor work
- workflow requests are not dropped because monitor capacity is exhausted
- monitor admission is bounded to 32 queued jobs/device by default
- duplicate/stale monitor work may be coalesced or rejected with diagnostics
- cancelling a monitor list removes its monitor work without clearing workflow or write requests

All Modbus protocol addresses remain zero-based. Existing FC01-FC04 read and FC05/FC06/FC16 write semantics are unchanged.

## Monitor scheduling

Each monitor list has:

- at most one active scan
- at most one pending follow-up scan
- a generation guard used to suppress stale completion after Stop, update, delete, disconnect, or restart
- cancellation and coalescing counters

Monitor runtime and running state are not persisted. Device reconnect does not automatically restart a previously running monitor list.

## Live transport

Each server-side WebSocket client has an independent bounded queue:

- 256 messages or 1 MiB by default
- 100 ms telemetry coalescing window by default
- telemetry may be coalesced/dropped under pressure
- control/state overflow produces an explicit resync signal instead of silent loss
- close/error clears queued state and retry timers

The browser derives the application WebSocket from the current page host, prevents duplicate application sockets, reconnects with jittered backoff from 250 ms to 30 s, and requests/reloads authoritative REST state after reconnect. The v1.2.11 implementation has reconnect state internally, but visible `LIVE`/`RECONNECTING`/`OFFLINE` presentation is carried into v1.2.12.

## Multi Input

A Modbus Multi Input shares Device and Unit ID at block level and supports one to eight independent sub-inputs. Each sub-input owns FC, address, data interpretation, scale, unit, interval, runtime, quality, and output port.

## Deployment boundary

The server binds to the configured host/port and is intended for a trusted local or industrial LAN. Authentication and authorization are not implemented; broader deployment requires an authenticated reverse proxy and environment-specific security review.
