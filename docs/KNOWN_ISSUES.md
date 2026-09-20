# Known Issues: v1.2.10

## Monitor cycle overlap

Continuous monitoring uses interval-based scheduling. A cycle can be invoked before the previous cycle finishes when total read duration exceeds the configured interval.

## High WebSocket diagnostic volume

Each Modbus request can emit TX and RX/error traffic events. Large monitor lists can create many WebSocket frames.

## No server backpressure policy

Server broadcast sends immediately to open clients without an explicit `bufferedAmount` policy or traffic batching.

## No client reconnect

The client creates one WebSocket connection and does not automatically reconnect after abnormal close, proxy failure, network interruption, or backend restart.

## No post-reconnect resynchronization

Live workflow runtime, device state, monitor values, traffic, and audit updates may remain stale until page refresh after a lost WebSocket connection.

## Development proxy error

Under high monitoring load, Vite may report `write ECONNABORTED` when the proxied WebSocket is aborted.

## v1.2.11 proposal: Monitor Scheduler & WebSocket Reliability

This remains a proposed, unapproved item. Overlapping monitor rounds can enqueue work into the shared device FIFO without a backlog bound or stop cancellation. Latency can therefore grow without bound and may starve workflow reads. The proposal also covers the WebSocket reliability issues listed above; this documentation/toolkit change does not alter scheduler or WebSocket behavior.
