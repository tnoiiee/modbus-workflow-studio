# v1.4.0-dev.19 — Workflow MODBUS_OUTPUT Manual-Testability Scope Gate

**Base:** `3a26c92a2e8723c18a54f314cdee7c71f5b157ac` / v1.4.0-dev.18.
**Target:** v1.4.0-dev.19.
**Status:** Implementation checkpoint for Owner Simulator Manual Review; production and hardware acceptance are not authorized.

## Authorized scope

- Enable normal MODBUS_OUTPUT Inspector authoring for FC06 and FC16 with contextual datatypes and one atomic Function Code/type edit plus one Undo snapshot.
- Present zero-based Coil/Register addresses, derived quantity/register spans and explicit overflow guidance. Preserve invalid saved parameters for Server validation; do not silently rewrite them.
- Select only existing SHARED_TAG definitions for optional read-back, with stable ID, definition metadata and existing mapping/device summary. Preserve unresolved IDs. Selection must not create Pollers, connect Devices, mutate definitions/mappings, or change Tag Runtime Store behavior.
- Present read-only MODBUS_OUTPUT Commanded/Effective/read-back diagnostics, queue/deadline and rejection/cancellation/error details; improve existing Audit event rendering and preserve RAW JSON.
- Normalize/display/copy existing Traffic `commandId` when present, retaining transport-only semantics.
- Document the deterministic Simulator hold/release expiry review and safe mismatched read-back review.
- Synchronize version surfaces/tests/docs to v1.4.0-dev.19.

## Functional locks

No change to dev.18 write admission, queue bound, internal five-second expiry, lifecycle/disconnect/reconnect fencing, Server validation, independent SHARED_TAG acquisition/read-back, `WorkflowRuntimeManager` authority, legacy HTTP 410 endpoint, `ALLOW_WRITES=false` default, O2-A/O2-B protected contracts, WebSocket/Snapshot protocol, Workflow CRUD/autosave/history semantics except one Undo entry for a Function Code transition, Overview Runtime/PREVIEW ONLY, or Modbus Monitor read-only behavior.

No new Server Audit event/schema is in scope. Production Server behavior is expected unchanged except version synchronization. No generic/public Write API, Overview direct write, commissioning screen, automatic mismatch retry, configurable expiry, Shared Tag Input, Workflow Variable/Signal, Published Workflow Output, O2-C/O2-D, FC15, dependency upgrade, or Production Device test.

## Acceptance evidence

See [v1.4.0-dev.19 Simulator Manual Review](../ACCEPTANCE_TESTS/O2-B-WORKFLOW-WRITE-MANUAL-REVIEW-v1.4.0-dev.19.md). It defines manual review steps, safe mismatch verification, and deterministic command expiry using a held first response, displayed expiry boundary, and explicit release. Owner Simulator Manual Review remains **PENDING** until Owner disposition.
