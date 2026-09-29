# Scope Gate — Workflow Modbus Write Foundation — v1.4.0-dev.18

**Status:** implementation and automated validation in progress; Owner Simulator Manual Review pending. This record defines the development checkpoint only. It is not production/hardware authorization.

## Approved objective

Implement and validate a guarded Workflow Modbus write foundation for an isolated TCP Simulator while preserving the existing canonical tag and protected Overview/Monitor boundaries. The direct legacy API behavior is an intentional production Server compatibility change: `POST /api/nodes/:id/write` fails closed with HTTP 410 and stable code `LEGACY_DIRECT_WRITE_DISABLED` before any Device lookup or write side effect.

## Included

- `WorkflowRuntimeManager` as the only active write authority, with `ALLOW_WRITES=false` by default and no replacement public write API.
- Strict FC05 Boolean, FC06 UInt16/Int16, FC16 UInt32/Int32/Float32/Float64 configuration/value/range/span/encoding validation; FC15 excluded.
- Bounded per-Device queue admission, explicit rejection/supersede outcomes, stable command/resource identity, generation fencing, monotonic expiry, and no persistence/replay of pending commands.
- Stop/Delete/revision/manual-disconnect lifecycle fencing, Manual Trigger reset, and output resource ownership.
- Independent optional SHARED_TAG read-back from the existing Tag Runtime Store; no read-on-demand, new poller/connection, or automatic mismatch retry.
- Separate Commanded, Effective, and Read-back diagnostics, plus corresponding Audit and Traffic evidence.
- Automated endpoint, validator, queue, expiry, lifecycle, trigger, read-back, Simulator, Audit/Traffic, and version tests, plus this scope and the [Owner Simulator Manual Review](../ACCEPTANCE_TESTS/O2-B-WORKFLOW-WRITE-MANUAL-REVIEW-v1.4.0-dev.18.md).
- Documentation and application/package version synchronization for `1.4.0-dev.18`; no dependency resolution/integrity/version change.

## Required boundaries

- The legacy route's exact handler response is HTTP 410 with `LEGACY_DIRECT_WRITE_DISABLED`; requests rejected earlier by JSON-size/security middleware are outside that handler response contract.
- The route must not inspect node/body data, look up or connect a Device, admit a queue item, create a frame, write/retry, mutate Workflow/runtime/ownership/trigger state, or disclose configuration.
- No browser, Overview, Monitor, or public API direct-write path. Overview remains PREVIEW ONLY; Monitor stays read-only.
- No Shared Tag Input, generic Signal/Variable, Published Workflow Output, O2-B2/canonical SHARED_TAG semantic change, FC15, O2-C/O2-D implementation, MQTT/Sparkplug implementation, real hardware test, or certification claim.
- Owner Simulator review remains pending until the Owner records a disposition. Hardware acceptance and soak validation remain unperformed unless separately authorized and evidenced.

## Acceptance evidence

Automated acceptance and Simulator steps are in the linked Manual Review guide. Required checks include the exact legacy 410 contract/no side effects, strict protocol validation, queue bound and expiry, Stop/Delete/manual disconnect/reconnect fencing, Manual Trigger reset, independent Store-backed read-back without connection/poller creation, no mismatch retry, Audit/Traffic identity, and FC05/06/16 Simulator framing.

Record checks, real exit codes, Owner Simulator disposition, and explicitly unperformed hardware/site/soak work in the checkpoint report. Passing Simulator tests is not evidence of hardware acceptance or certification.
