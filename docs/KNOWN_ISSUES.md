# Known Issues

## v1.2.8

### Continuous monitor cycle overlap

`ModbusMonitorManager.start()` starts an immediate read and then uses `setInterval`. If one list read takes longer than the configured interval, another read invocation can begin before completion.

### High diagnostic event volume

Each Modbus request can emit TX and RX/error traffic events. Continuous monitoring with many enabled items can generate many WebSocket frames.

### No WebSocket backpressure policy

Server broadcast sends to every open client without inspecting `bufferedAmount`. High-volume diagnostics can accumulate in the transport.

### No client WebSocket reconnect

The client creates one WebSocket and handles messages, but does not register a reconnect strategy for abnormal close or proxy failure.

### Vite development proxy ECONNABORTED

Under high monitoring load or a broken proxy socket, Vite may log `write ECONNABORTED`. If the browser socket is lost, live updates may remain stopped until refresh.
