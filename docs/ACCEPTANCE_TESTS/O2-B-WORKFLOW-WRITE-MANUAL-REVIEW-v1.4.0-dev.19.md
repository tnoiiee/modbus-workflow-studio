# v1.4.0-dev.19 — Workflow MODBUS_OUTPUT Manual Testability Review

**Status: PENDING Owner Simulator Manual Review.** This is a development-only, Simulator-only manual review for guarded Workflow `MODBUS_OUTPUT` authoring and diagnostics. It does not certify a Write Foundation defect, authorize production devices, or authorize hardware, field, soak, or certification testing. Do not use a real endpoint or production configuration.

The approved v1.4.0-dev.18 Write Foundation remains the behavioral baseline. `WorkflowRuntimeManager` remains the sole write authority, `ALLOW_WRITES=false` remains the default, the legacy direct-write route remains HTTP 410, and no public replacement write API exists. This review adds only manual authoring/diagnostic presentation and documentation.

## Isolated setup and safety

1. Use a disposable Simulator and sacrificial Workflow. Confirm the endpoint is isolated and cannot route to plant equipment. Never use Production Device settings.
2. Keep `ALLOW_WRITES=false` except when the disposable Simulator process specifically requires it for these guarded Workflow tests. Do not expose that process to a shared environment.
3. Reserve Simulator Coil 0 and Coil 1 and any test registers. Capture sanitized frame counts, not credential-bearing/raw configuration logs.
4. Keep Overview PREVIEW ONLY, Overview Runtime read-only, and Modbus Monitor read-only. No write is initiated by configuring an Inspector field.
5. FC05 is Boolean only with NORMAL/ACTIVE_LOW; FC06 is UInt16/Int16; FC16 is UInt32/Int32/Float32/Float64. No FC15, silent truncation, direct-write route, or automatic retry is supported.

## A. Function Code authoring and address-span guidance

1. Add a `MODBUS_OUTPUT`; confirm the initial configuration is FC05 + Boolean, quantity one, and zero-based Coil address 0.
2. Select FC06 before changing datatype. Confirm it remains selectable from FC05 + Boolean and transitions atomically to UInt16, quantity one. Confirm one Undo restores the prior FC05+Boolean configuration; Redo reapplies the single FC06 transition.
3. With FC06 selected, choose Int16 and verify it is preserved when selecting FC06 again. Confirm no Device frame is emitted by changing configuration.
4. Select FC16 from FC06. Confirm the default becomes Float32 and quantity two. Test UInt32, Int32, Float32, Float64 and their derived quantities 2, 2, 2, and 4. Compatible types remain selected when switching among FC16-compatible settings; incompatible Function Code changes use the explicit documented fallback.
5. Confirm FC05 shows only Boolean and polarity; FC06 only UInt16/Int16 and a fixed read-only quantity of one; FC16 only the approved four types, read-only derived quantity, and applicable byte/word order.
6. Confirm labels explicitly say zero-based Coil, Register, or starting Register address. At FC16 address 65534 with width two, span 65534–65535 is valid. At 65535 with width two, the UI displays final occupied address 65536 and `ADDRESS_SPAN_EXCEEDS_MODBUS_RANGE`; it does not clamp or silently truncate. Server validation remains authoritative and blocks Workflow Start for invalid saved configuration.
7. Load a saved incompatible/invalid `MODBUS_OUTPUT` configuration. It must remain visible, show a validation finding, and not be silently rewritten until an intentional user edit. Use the Workflow Validation route to inspect configuration findings.

## B. Read-back SHARED_TAG selector

1. In Data Sources, note an existing SHARED_TAG Stable ID with an enabled acquisition mapping. Return to the Workflow Inspector; select it using the catalog selector.
2. Verify definition name, stable UUID, datatype, optional unit, enabled/disabled state, mapping state, and available Device/FC/address summary are shown. WORKFLOW_VARIABLE entries do not appear.
3. Verify selection only saves the existing `readBackSourceId`: it creates no mapping, Poller, Device connection, on-demand read, or SHARED_TAG mutation.
4. Select a definition with a missing/disabled Mapping or disabled definition. Verify a warning is displayed. Load an unresolved saved UUID and verify it remains selected/read-only-visible with a missing-definition warning; it is not cleared automatically.

## C. Safe read-back mismatch (Simulator-only, non-safety-rated)

1. Use an isolated Simulator. Configure an FC05 `MODBUS_OUTPUT` for Unit 1, zero-based Coil address 0, NORMAL polarity, commanded `true`.
2. Configure an existing SHARED_TAG acquisition mapping to read FC01, Unit 1, zero-based Coil address 1. Leave Simulator Coil address 1 untouched and `false`; do not alter the mapping after this setup.
3. Start the guarded Workflow and allow the independent acquisition to produce a new GOOD sample after the write.
4. Verify the MODBUS_OUTPUT diagnostics show Commanded `true`, Effective `true`, Read-back `false`, Read-back quality GOOD, and Write status MISMATCH. A missing/stale sample remains unavailable and must not be shown as false/zero.
5. Verify no second command, retry frame, SHARED_TAG mutation, extra Poller, or Device auto-connect occurs. Restore the correct read-back Mapping after the test and stop the Workflow.

This mismatch test is non-safety-rated and Simulator-only. A mismatch is observation, not a correction instruction.

## D. Deterministic five-second command expiry (no configurable expiry)

The expiry remains an internal fixed **5 seconds**. Do not add or configure an expiry field. Do not test this by arbitrary sleep alone.

1. Use a disposable Simulator with a controllable response hold/release mechanism. If the bundled Simulator harness cannot expose safe manual hold/release, use a disposable external Simulator with controllable response timing; do not add a Production endpoint or commissioning Write API.
2. Submit the first command on a Device and hold its response so the first command remains `ON_WIRE`.
3. Queue a second command on the same Device. Verify Runtime diagnostics show `QUEUED` and a specific expiry time.
4. Observe the displayed expiry boundary. Keep the first response held until that displayed boundary has passed; use the deadline display as the test condition, not a guessed sleep interval.
5. Release the first response explicitly. Verify the second command is dequeued and becomes `EXPIRED` / `COMMAND_EXPIRED` before transmission.
6. Count Simulator frames: verify no second Modbus frame was sent. Verify the expired command does not update Effective value.
7. Verify Runtime and existing Audit records expose the expiry status/reason. Traffic contains transport evidence only; a command that expired before transmission has no frame row.

## E. Runtime, Audit, and Traffic correlation

1. For an accepted write, inspect Command ID, Commanded, Admission result, Effective, Write status, queue state, Created time, Expiry time, rejection/cancellation reason, error and independent read-back value/quality/availability/timestamp/mismatch.
2. Confirm Commanded, Effective and Read-back are distinct. `WRITTEN` does not mean `VERIFIED`; missing read-back is unavailable, not false/zero; `MISMATCH` never retries.
3. In Audit, select existing write events and locate Command ID, Workflow/Node/Device, decision/result, reason, Commanded and Effective without opening RAW JSON. Confirm full RAW JSON remains available; absent fields are shown as unavailable/omitted, not invented. No mismatch Audit event is expected in dev.19.
4. In Traffic, locate the matching Command ID in event details and copy its full accessible value. Verify Workflow ID, Node ID, Device, FC and zero-based address remain visible, with TX/RX/error direction and result. Traffic is transport evidence only, not admission or read-back verification. An admission rejection that emitted no Modbus frame is absent from Traffic and visible in Runtime/Audit.

## Stop conditions

Stop if any unexpected frame is sent, an invalid saved configuration is silently rewritten, a configuration edit emits a Device write, a mismatch retries, a no-sample value is fabricated, any Poller/connection/mapping mutation occurs due to selection, a command survives lifecycle fencing, credentials/configuration leak, the endpoint is not isolated, or Overview/Modbus Monitor gains write behavior. Preserve sanitized evidence only.

## Owner disposition (complete after review)

- Owner / date / application commit:
- Simulator identity (non-sensitive label only):
- Scenarios passed / failed / not run:
- Sanitized frame/Runtime/Audit/Traffic evidence location:
- Production Device test: **NOT AUTHORIZED**
- Hardware certification: **PENDING**
- 24/7 soak certification: **PENDING**
- Owner decision: **PENDING**
