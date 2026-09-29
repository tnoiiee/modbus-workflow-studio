# v1.4.0-dev.18 — Workflow Modbus Write Simulator Manual Review

**Status: PENDING Owner review.** See the [dev.18 scope gate](../SCOPE_GATES/O2-B-WORKFLOW-WRITE-FOUNDATION-v1.4.0-dev.18.md) and [Master Plan](../MASTER_PLAN.md). This procedure validates only the guarded development Simulator path. It is not authorization for production devices, real hardware, a field trial, soak testing, or certification. Do not enter a real endpoint or connect production equipment.

## Safety contract to verify

- `ALLOW_WRITES` defaults to `false`. Do not enable it except for this isolated, disposable Simulator review.
- `WorkflowRuntimeManager` is the sole write authority: `MODBUS_OUTPUT → WorkflowRuntimeManager → bounded shared Device queue → DeviceConnection → Modbus frame`.
- The only supported writes are FC05 Boolean (`NORMAL` / `ACTIVE_LOW`), FC06 `UInt16` / `Int16`, and FC16 `UInt32` / `Int32` / `Float32` / `Float64`. Addresses are zero-based; datatype, function code, quantity, complete encoded span, byte/word order, finite value and range must agree. FC15 is not supported.
- Each intent has a command ID, Workflow/node/Device/resource identity, runtime and connection generations, monotonic expiry and commanded value. QUEUED is distinct from ON_WIRE. Queue admission is bounded; only a not-yet-sent command for the same Workflow node/resource may be superseded. Nothing is persisted or replayed.
- Stop, Delete, workflow revision change and manual Device disconnect fence pending commands and stale callbacks. Manual Trigger state resets on Stop and is not replayed after restart/reconnect. Delete releases output ownership.
- Optional read-back is only a SHARED_TAG UUID association resolved through the Server Tag Runtime Store and existing acquisition. It creates no poller or connection, does not read on demand, and does not convert a missing sample into false/zero. Unavailable optional read-back must not block an otherwise admitted write; mismatch does not retry.
- Overview remains **PREVIEW ONLY** (no Device/Workflow command). Overview and Modbus Monitor remain read-only. Production/hardware writes are unauthorized; hardware acceptance and 24/7 soak certification remain **PENDING**.

## Exact compatibility route result

`POST /api/nodes/:id/write` remains temporarily so obsolete clients receive deterministic feedback. Every request that reaches the handler returns HTTP **410 Gone** and exactly this JSON contract:

```json
{"code":"LEGACY_DIRECT_WRITE_DISABLED","error":"Direct node writes are disabled. Modbus writes must use the guarded Workflow runtime."}
```

It does not inspect the body or `:id`, look up/connect a Device, admit queue work, create a frame, write/retry, mutate Workflow/runtime/ownership/trigger state, or disclose sensitive configuration. There is no redirect and no replacement public write API. Existing JSON body-size, Origin and general security middleware stays in force; malformed and oversized requests can be rejected before this route and are not promised a 410.

## Isolated setup

1. Use a disposable local checkout and a private loopback-only Modbus TCP Simulator. Confirm the configured host is `127.0.0.1` (or the Simulator's isolated container address), not a plant/hardware address.
2. Confirm no real Device is configured or connected. Take a copy of the Simulator frame log before testing.
3. Start with `ALLOW_WRITES=false`; confirm the health endpoint reports `allowWrites: false` and LIVE ARMED is blocked. Enable writes only in the disposable local test process, never in a shared/production environment.
4. Use a sacrificial Workflow and reserved Simulator addresses. Do not reuse protected O2-A/O2-B data or workflows.
5. Keep the browser Overview in View mode and confirm controls are labelled **PREVIEW ONLY**. Use Modbus Monitor only for read-only checks.

Automated harness entry points (run only after dependencies are available) are:

- `npm test -w server -- --run test/writeValidation.test.ts test/workflowWriteQueue.test.ts test/workflowWriteLifecycle.test.ts test/workflowWriteSimulator.test.ts test/legacyDirectWrite.test.ts`
- `npm run typecheck -w server`

The `workflowWriteSimulator.test.ts` harness starts a local TCP Simulator and exercises FC05, FC06, FC16 plus independent Store-backed SHARED_TAG read-back. It is test scaffolding, not a hardware result.

## Review scenarios and expected evidence

| ID | Action | Expected result / evidence |
|---|---|---|
| S1 | Submit valid-looking and invalid JSON-shaped bodies to the legacy route. Also submit malformed JSON and a body exceeding the configured limit. | For requests reaching the handler: HTTP 410 and the exact code/message above. Parser/size middleware may reject first. No route-created traffic, connection, Workflow/runtime/ownership/trigger mutation or Audit entry. No sensitive data in response. |
| S2 | With `ALLOW_WRITES=false`, attempt to arm a sacrificial Workflow. | Arm is blocked; no queued intent or frame. Default health reports false. |
| S3 | With writes enabled only for the isolated Simulator, issue FC05 NORMAL and ACTIVE_LOW Boolean commands. | Correct single-coil frame/value; effective value reflects polarity; command ID is consistent in Audit, runtime and Traffic. |
| S4 | Issue FC06 UInt16 and Int16, and FC16 UInt32, Int32, Float32 and Float64 using representative byte/word orders. | Exact zero-based start and encoded span; exact quantity/payload; matching response echo. No coercion, truncation or FC15. |
| S5 | Try incompatible FC/type pairs, quantity mismatch, address underflow/span overflow, invalid order, NaN/infinity, wrong JavaScript type, and out-of-range values. | Explicit rejected/validation status and Audit reason; no queue admission, effective-value change, read-back mutation or transmitted frame. |
| S6 | Hold one Simulator request open, fill the bounded write queue, submit one more command, then supersede a queued command for the same node/resource. | Overflow is explicitly rejected without silent eviction. Only eligible queued same-owner work is superseded; ON_WIRE work is never reported as superseded. |
| S7 | Queue a write, Stop the Workflow; repeat with Delete and with manual Device disconnect. Then reconnect. | Unsent work is cancelled/fenced, stale completion cannot mutate current runtime, ownership is released on Delete, disconnect is authoritative, and reconnect does not auto-connect/replay the old intent. |
| S8 | Press a Manual Trigger, Stop, restart, then reconnect after a disconnect. | Stop resets trigger state. No prior trigger or command is replayed across Stop/restart/reconnect. |
| S9 | Associate an optional read-back SHARED_TAG and test true/false and nonzero/zero samples, then no sample, stale and unavailable states. | Preserve `hasValue`, value, quality, availability and timestamp. False and zero are real values; no sample is not false/zero. No read-on-demand or extra connection/poller; no mismatch retry. |
| S10 | Observe Audit, runtime diagnostics and Traffic for accepted and rejected attempts. | Command ID and owner/resource/generation/expiry evidence agree. Rejections are explicit; no credential/configuration data appears. TX/RX are distinguished from QUEUED and ON_WIRE. |
| S11 | Review Overview control affordances and Modbus Monitor. | Overview controls remain PREVIEW ONLY with no command path; Monitor can read only and cannot affect Workflow write lifecycle. |

## Stop conditions

Stop immediately if any unexpected frame is sent, any queue item survives a lifecycle fence, a stale callback changes current state, the Simulator endpoint is not isolated, response/Audit/Traffic contains a credential, or a protected Overview/Monitor/O2-A/O2-B behavior changes. Preserve only sanitized evidence; never attach secrets, real endpoint addresses, runtime data or raw credential-bearing logs.

## Owner disposition (complete after review)

- Owner / date / application commit:
- Simulator identity (non-sensitive label only):
- Scenarios passed / failed / not run:
- Sanitized frame/Audit/Traffic evidence location:
- Production/hardware write authorization: **NOT GRANTED by this review**
- Hardware acceptance / 24/7 soak certification: **PENDING**
- Owner decision: **PENDING**
