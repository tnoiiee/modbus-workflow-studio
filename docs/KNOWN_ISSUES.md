# Known Issues: v1.2.11

## Deployment security boundary

Authentication and authorization are still outside this application. Keep the gateway on a trusted local or industrial LAN and use an authenticated reverse proxy before broader deployment.

## Development proxy behavior

Under high monitoring load, a development proxy may report `write ECONNABORTED`. The v1.2.11 monitor and WebSocket bounds prevent unbounded backlog, but the deployment should still be tested with the target proxy and network topology.

## Environment acceptance

Browser/E2E checks, Modbus simulator checks, and live hardware checks require the target environment. Local unit, typecheck, and production-build checks do not replace those acceptance environments.

## Reliability configuration

The approved defaults are configurable through environment variables parsed in `server/src/reliability.ts`: monitor queue 32 jobs/device, one in-flight plus one pending scan/list, WebSocket 256 messages or 1 MiB/client, and reconnect backoff 250 ms–30 s with jitter. Changing limits should be recorded as deployment configuration and validated under representative load.

See [docs/PHASE_PLAN_v1.2.11.md](PHASE_PLAN_v1.2.11.md) and [docs/ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md) for the remaining simulator, hardware, browser, and release evidence requirements.
