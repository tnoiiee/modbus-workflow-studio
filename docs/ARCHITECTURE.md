# Architecture: v1.2.9

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

Workflow configuration is revisioned and persisted. Runtime values, pollers, timers, sockets, pending writes, and running state are not persisted. Devices are shared project resources. Monitor lists are stored separately from workflows; monitor runtime and running state are not restored.

## Concurrent runtime

Each running workflow has isolated node runtime, engine memory, pollers, timers, Manual Trigger timers, output initialization, and write-on-change state. Workflows share project-level device connections and queues.

## Multi Input

A Modbus Multi Input shares Device and Unit ID at block level and supports one to eight independent sub-inputs. Each sub-input owns FC, address, data interpretation, scale, unit, interval, runtime, quality, and output port.

## Live transport

The client receives workflow, runtime, device, traffic, audit, and monitor updates over `/ws/live`. In v1.2.9 there is no reconnect loop, state resynchronization, explicit server backpressure policy, or traffic batching.
