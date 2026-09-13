# Architecture

## System overview

```text
React 18 + Vite Client
    |-- REST /api
    `-- WebSocket /ws/live
             |
Express + Node.js Server
    |-- WorkflowManager
    |-- WorkflowRuntimeManager
    |-- ModbusMonitorManager
    |-- DeviceConnection per device
    |-- FIFO request queue per device
    |-- Audit and traffic services
    `-- JSON persistence
             |
        Modbus TCP devices
```

## Configuration and runtime boundaries

- Workflow configuration is revisioned and persisted.
- Workflow runtime values, pollers, timers, sockets, pending writes, and running state are not persisted.
- Devices are project-level resources shared by workflows and monitor lists.
- Monitor-list configuration is stored separately from workflows.
- Monitor runtime values and monitoring state are not intended to restore on startup.
- The server downgrades persisted `LIVE_ARMED` to `LIVE_LOCKED` on startup.

## Workflow runtime

Each running workflow owns an isolated runtime session:

- Node runtime values.
- Engine memory.
- Input pollers.
- Timer state.
- Manual Trigger timers.
- Output initialization and write-on-change state.

Workflows share project-level device connections and per-device request queues.

## Live transport

The client receives workflow configuration, runtime, device state, traffic, audit, and monitor updates over `/ws/live`. In v1.2.8 the connection is created once and has no reconnect loop. Server broadcast is immediate and has no explicit backpressure policy.

## Persistence

Runtime JSON is stored under `data/` and is excluded from version control and clean release ZIPs. Source repositories must keep only `data/.gitkeep`.
