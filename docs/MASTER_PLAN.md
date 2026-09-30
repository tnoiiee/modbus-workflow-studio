# Master Plan — MODBUS WORKFLOW STUDIO

**Planning status:** practical, incremental product roadmap. This is not a certification plan and does not authorize production writes, hardware commissioning, or future scope by itself.

## Product and delivery principle

Build a dependable Modbus TCP workflow studio for solo development and internal OT deployment. Favor production-grade essentials, understandable failure modes, incremental owner-reviewed checkpoints, and risk-based validation over broad enterprise claims or exhaustive formal process.

Industrial standards, protocol specifications, and OT guidance may be used as examples, inspiration, and design guidance. They are **not current compliance targets, certification claims, or a promise of conformance**. Project checkpoints must state what was actually tested and must explicitly identify work not performed.

No roadmap item reserves a future version number. A roadmap entry is not implementation authorization; each checkpoint still needs an approved scope and base.

## Major roadmap

### 1. Stable Modbus I/O Foundation

- Maintain bounded, shared, read-oriented acquisition for configured Modbus inputs.
- Keep writes behind the guarded Workflow authority, disabled by default, strictly validated, bounded, expiring, and fenced across lifecycle changes.
- Keep commanded, effective, and independently observed values distinct; use Store-backed read-back without creating a hidden poller or retry loop.
- Validate with automated tests and an isolated TCP Simulator first. Representative hardware review is later work and requires explicit Owner authorization, a defined safe site plan, and a report of its limits.

### 2. Canonical Data Management

- Preserve stable identities for Definitions, mappings, and SHARED_TAG sources.
- Keep configuration, mappings, runtime quality, availability, timestamps, and last-good values explicit and separately diagnosable.
- Maintain data lineage from Device acquisition through canonical data to Workflow/operator consumers.
- Consider import/export, backup, and rollback for canonical configuration only under a separately approved scope.

### 3. Workflow and Logic Management

- Continue the visual Function Block workflow and its revision/lifecycle model.
- Add Shared Tag Input only in its own approved scope, with source identity, quality, availability, freshness, and blocked-reason semantics preserved.
- Add explicit state/latch lifecycle and diagnostics; add timers and edge blocks when supported by real use cases and tested lifecycle behavior.
- Add Published Workflow Output and Workflow Command Input as separate, owner-approved capabilities. Keep transport and external interfaces outside canonical signal identity.
- Show active paths, stale or blocked inputs, output ownership, and the reason an action did not proceed.

### 4. Operator HMI and UX

- Provide monitoring and Custom Elements without bypassing Workflow authority.
- Route any future operator intent through a Workflow-backed command path with explicit permissions and audit evidence.
- Present Commanded, Effective, and independent Read-back values as separate facts, with quality and timestamps.
- Support practical navigation from engineering diagnostics to the relevant Workflow and node.
- Do not add direct Register-write controls to Overview, Monitor, or other browser surfaces.

### 5. Reliability, Recovery, and Deployment

- Improve atomic persistence, backup/restore, corruption handling, and validation of `DATA_DIR`.
- Support a documented offline deployment path, production runtime/service setup, and visible health/version information.
- Define upgrade and rollback procedures that preserve configuration and expose failed recovery rather than silently discarding data.
- Add persistence/recovery and deployment tests proportionate to internal OT use.

### 6. Practical OT Access Boundary

- Document internal OT network and Firewall assumptions; restrict listening interfaces and request Origins to the deployment model.
- Keep writes disabled by default and require deliberate local configuration to enable an isolated development Simulator path.
- Do not hard-code secrets or place sensitive values in logs, Audit, Traffic, errors, screenshots, or test fixtures.
- Add basic roles when Operator controls are enabled, plus configuration-change and write-decision audit trails.
- Treat these controls as practical product safeguards, **not a formal cybersecurity certification target or claim**.

### 7. Practical Validation and Commissioning

- Run automated type, unit, integration, build, hygiene, and publish checks required by each approved checkpoint.
- Complete Owner Simulator review before treating the guarded write foundation as reviewed for that path.
- Perform representative hardware review only when explicitly authorized and justified by the use case; use a documented site plan and report which devices, conditions, and cases were not exercised.
- Conduct a site trial only when required. Run soak validation only when risk and deployment needs justify its duration and monitoring.
- Report every validation category as passed, failed, blocked, or not run. Never imply hardware acceptance, soak completion, safety qualification, or certification from Simulator results.

## Optional / future scopes

These are optional and are not current commitments or implementation authorization:

- Picture Box and Assets
- Alarm management
- Historian and Trends
- High Availability
- MQTT/Sparkplug Adapter
- OPC UA Adapter
- Reusable Subworkflows
- Versioned custom Function Blocks
- SFC/Sequence editor
- Recipe/Batch management
- Script/Expression blocks
- Collaborative editing
- Mobile/Tablet operation
- Formal compliance work
- Formal safety certification
- Enterprise cybersecurity program

### Transport and remote-command boundary

MQTT/Sparkplug is **not implemented** and is **not a committed requirement**, now or for a future checkpoint. Preserve adapter-ready, transport-agnostic boundaries: core signals and Published Workflow Outputs do not contain transport-specific identities. MQTT topics and Sparkplug identifiers do not belong in SHARED_TAG. Adapter configuration remains separate from canonical signal identity and Workflow definitions. Any future remote command must enter through the same Workflow Command authority; no adapter may write `DeviceConnection` directly.

## Current execution priority

1. Complete v1.4.0-dev.19 MODBUS_OUTPUT manual authoring/diagnostic testability on the approved dev.18 Write Foundation; do not alter write admission/lifecycle.
2. Owner Simulator Manual Review for dev.19.
3. Stop for Owner direction. Shared Tag Input, Published Workflow Output and other future capabilities require separate scope approval and are not authorized by this checkpoint.

No production Device, hardware or soak test is authorized by this sequence.

## Practical checkpoint Definition of Done

A checkpoint is complete only when all of the following applicable conditions are explicit and evidenced:

1. The Owner-approved scope, base, version, and exclusions match the final diff; no deferred or optional feature has slipped in.
2. Behavior has focused tests for the important success, rejection, lifecycle, persistence, and boundary cases. Tests do not rely on broad casts that hide production type errors.
3. Required Client/Server typechecks, targeted tests, full tests, build, hygiene, publish verification, and diff checks have real recorded exit codes; any authorized single retry is reported.
4. A controlled Simulator procedure is documented for protocol-facing changes. Simulator results are not described as hardware results.
5. Independent review/Owner disposition is recorded where required. Hardware/site/soak work is stated as not run until actually authorized and completed.
6. Version literals, package manifests, changelog, current state, roadmap, acceptance/scope documents, and lockfile are consistent. No dependency change is included unless separately approved.
7. The deployment and access boundary, default write state, auditability, and recovery/rollback limitations are documented for the checkpoint.
8. The final diff contains no credentials, real production endpoints, runtime data, generated logs, conflict markers, disabled tests, or unresolved in-scope TODOs.
9. A checkpoint is not called ready until the required local gates, Owner decision, and—if remote delivery is requested—commit parent, push destination, remote SHA, and clean working tree are verified.

## Current guardrails and deferred scope

- v1.4.0-dev.18 is an implementation-in-progress checkpoint for controlled Simulator validation. `ALLOW_WRITES=false` remains the default; production and hardware writes are not authorized.
- Overview remains PREVIEW ONLY; Overview and Modbus Monitor remain read-only. No direct Register-write UI is planned.
- O2-C Picture Box and Assets remains **DEFERRED, not cancelled**, at [the preserved scope gate](SCOPE_GATES/O2-C-PICTURE-BOX-ASSETS-DEFERRED.md). Do not implement O2-C/O2-D without explicit reactivation on an approved base.
- Standards and OT guidance remain design references only. No compliance, safety, cybersecurity, HA, or certification claim follows from this plan.
