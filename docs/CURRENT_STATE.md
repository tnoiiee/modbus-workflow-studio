# Current Project State

## Current application

`v1.3.0` — **Overview Designer Foundation**, release candidate based on
Owner-approved Final O1 checkpoint `58c3586e1f433b44fca53bf2c183be6065a796e5`
(`v1.3.0-dev.2`). O1-A through O1-D and Final O1 Owner Manual Review: PASS.

Includes Overview Page management, Editor, Element Library/Inspector, Draft,
Undo/Redo, Save/Cancel, View/Edit boundaries, independent Preview Control state,
savedViewport, accessibility/responsive baseline and Draft Tag binding configuration.

No Production Monitoring Runtime, live Modbus values in Overview, Production
Control Runtime, Modbus writes from Overview, Tag Runtime, Variable Blocks,
MQTT implementation or Sparkplug adapter. MQTT Sparkplug B is future planning only.

Release-preparation commit is version/documentation only. The PR intentionally
includes the approved O1 chain absent from `main` (`5c9a6a0`). Release PR Owner
review and manual merge remain PENDING. No tag, GitHub Release or ZIP is created;
v1.4 is NOT STARTED.

[Release notes](RELEASE_NOTES_v1.3.0.md) ·
[Final O1 acceptance](ACCEPTANCE_TESTS/O1-v1.3.0-dev.2.md) ·
[O1 evidence](ACCEPTANCE_EVIDENCE/O1-v1.3.0-dev.2.md).

## Historical source baseline

`v1.2.11` Monitor Scheduler & WebSocket Reliability source baseline.

The v1.2.11 implementation was delivered through follow-up PR #2 from source commit `a393cf3f2521abc41d21c13e5e6db02a481aa56a`, based directly on the documentation-only planning merge `9004125b8c9047136807d2d84b648135bb96e38e`.

Source/CI gates and the recorded reliability scenarios passed. The project owner intentionally deferred the remaining frontend regression, write-safety, mixed-load, soak, slow-consumer, frame-capture, and hardware acceptance to v1.2.12 because v1.2.12 will replace the frontend presentation. v1.2.11 therefore has no standalone final release acceptance, tag, or release ZIP.

## Publication and history state

- v1.2.10 remains the latest separately published release.
- The documentation-only v1.2.11 planning change was merged through PR #1 at `9004125b8c9047136807d2d84b648135bb96e38e`.
- The v1.2.11 reliability implementation is the source baseline for v1.2.12.
- Publication date recorded for the v1.2.10 baseline: `2026-09-21`.
- History remediation is complete; no further history rewrite is required.
- Operational backup material, if retained, must stay outside Git in access-controlled storage.
- Thai operational procedure: [docs/CLEAN_HISTORY_PUSH_RUNBOOK_TH.md](CLEAN_HISTORY_PUSH_RUNBOOK_TH.md)
- English operational procedure: [docs/CLEAN_HISTORY_PUSH_RUNBOOK.md](CLEAN_HISTORY_PUSH_RUNBOOK.md)

## Current capabilities

- React Flow workflow editor and workflow CRUD
- Concurrent isolated workflow runtime sessions
- Shared project-level Modbus connections and classified per-device queues
- FC01-FC04 reads and FC05/FC06/FC16 writes
- Single Modbus Input and Output
- Independent Modbus Multi Input with 1-8 sub-inputs
- Per-sub-input FC, address, data type, order, scale, offset, unit, scan interval, runtime, quality, lamp, and source port
- Manual Trigger and Timer blocks
- Boolean logic symbols and status lamps
- Linear Mapping
- Reliable auto-save and revision recovery
- Audit Viewer, Runtime Monitor, Traffic Monitor, and Validation
- Read-only Modbus Monitor with lists, Add Item, Add Range, continuous monitoring, and CSV export
- Single-flight monitor scans with one pending scan/list, generation invalidation, cancellation, queue diagnostics, and bounded per-device admission
- Bounded WebSocket client queues with telemetry coalescing/drop behavior and control/state resync signaling
- Client duplicate-socket prevention, jittered reconnect, and revision-safe resynchronization
- Output ownership conflict protection

## v1.2.11 validation and closure

Passed:

- `npm ci --include=optional`
- `npm run check`: server/client typecheck, 13 server tests, 3 client tests, and both production builds
- strict hygiene and publish verification
- GitHub Check and Hygiene
- version synchronization, diff validation, and runtime/generated-file policy
- REST health and snapshot smoke
- WebSocket initial snapshot and explicit resync smoke
- owner-run FC01 monitor, bounded/coalesced scan, Stop/Restart, disconnect/reconnect, repeated Start/Stop, persistence, and browser reconnect/resync scenarios

Explicit carryover to v1.2.12:

- full general UI behavior regression after the UI modernization
- visible `LIVE`, `RECONNECTING`, and `OFFLINE` presentation
- write-disabled and isolated simulator-write safety
- multiple monitor lists plus workflow reads
- WebSocket slow-consumer pressure
- 30-minute and 2-to-8-hour soak, memory, and handle trends
- frame capture and approved hardware acceptance
- security advisory remediation or documented reviewed risk acceptance

Detailed evidence: [docs/ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md](ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md).

## Security disposition

Audit observation on 2026-09-22:

- full dependency graph: 5 moderate, 1 high, 1 critical
- production-only graph: 2 moderate findings in the Express/qs path
- no `npm audit fix` or forced major upgrade was applied

The findings are unresolved and do not receive implicit acceptance. Because v1.2.11 will not be released independently, remediation or explicit reviewed risk acceptance is mandatory before the v1.2.12 release.

## Historical version plan

v1.2.12 planning is complete and approved (owner decisions 2026-09-22). Source of truth:
[SCOPE_v1.2.12.md](SCOPE_v1.2.12.md), [UI_DESIGN_SYSTEM_v1.2.12.md](UI_DESIGN_SYSTEM_v1.2.12.md),
[PHASE_PLAN_v1.2.12.md](PHASE_PLAN_v1.2.12.md),
[SCOPE_TRACEABILITY_v1.2.12.md](SCOPE_TRACEABILITY_v1.2.12.md),
[UI_INVENTORY_v1.2.12.md](UI_INVENTORY_v1.2.12.md), and
[ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md). Implementation has not started; no
source code has been modified yet.

v1.2.12 is a behavior-preserving UI/UX modernization:

- restrained dark-first Industrial Cyberpunk design system with shared tokens and reusable primitives
- desktop and tablet-landscape support with WCAG AA targets
- segmented Workflow command bar (management / editing / mode-safety / runtime)
- visible Undo, Redo, and Fit View controls built on the existing history and viewport logic, with
  shortcuts, history semantics, and React Flow state ownership preserved
- application modals/toasts/inline validation replacing all 15 native browser dialog sites
- redesigned Block Library, central bilingual (EN + TH) block metadata, block duplication, Device
  page, and all operational tabs
- Project Settings redesigned UI-only: no settings API, no persistence, no false successful-save state
- Traffic Monitor keeps the baseline behavior: no Traffic Clear action is added
- Block Library search/filter is an optional, non-blocking enhancement and not a release gate
- visible `LIVE`, `RECONNECTING`, and `OFFLINE` connection status derived from the existing reconnect state
- version bumped to `1.2.12` in the first implementation commit and kept synchronized across
  root/client/server/lockfile/UI/startup banner/health API; no tag or release ZIP before the final gate
- every acceptance row classified as mandatory-for-merge, mandatory-for-release,
  conditional-on-environment, or non-blocking evidence
- no cross-workflow variables and no runtime, Modbus, queue, or write-safety semantic changes

Cross-workflow `Publish Variable` / `Read Variable` behavior remains a separate v1.3.0 scope. The
requirement is **deferred, not cancelled**.

## Remaining operational boundary

Authentication remains outside the application. Keep deployment on a trusted local or industrial LAN and use an authenticated reverse proxy before broader exposure.

## Publishing controls

- `.gitignore` and `.gitattributes` keep secrets, runtime data, build output, logs, databases, archives, and editor artifacts out of Git.
- `scripts/hygiene-check.mjs` audits the worktree, staged index, tracked tree, reachable history, and the combined `--all` mode with masked evidence.
- `.githooks/pre-commit` and `.githooks/pre-push` block unsafe publication after `npm run hooks:install` registers them in a clone.
- `.github/workflows/hygiene.yml` applies the hygiene gate on pushes and pull requests.
- Approved tags and release ZIPs remain immutable; no v1.2.11 tag or ZIP is authorized by this closure.
