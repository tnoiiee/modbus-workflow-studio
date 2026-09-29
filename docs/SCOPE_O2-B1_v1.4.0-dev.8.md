# O2-B1 Acquisition editor UX and persistence-boundary closure — dev.8

Owner FINAL APPROVAL; base `3e3c4e54d782515c7de1802956197fb2d138e321` / dev.7.
Branch `arena/01a0d291-modbus-workflow-studio`; target v1.4.0-dev.8.
Owner dev.7 APPROVED WITH PUNCHLIST: validation, zero-based Address, supported selects,
Traffic normalization, Disconnect/queue/poller stop, no Shared Tag writes, existing Workflow/Monitor,
no Overview live Runtime and disabled Control Runtime are PASS.

## Included frontend work

Existing accessible Modal retained, scoped responsive editor styles using the existing tokens.
Connection/addressing, decoding and value/timing groups; 4/2/1-column layout; a single scrollable
body with stable footer. Technical details are secondary disclosure. Readable body/section token
sizes, aligned field labels, nearby helper/error text, wrapping and visible focus. No new design system.
Enabled is one native checkbox/label/help setting with On/Off text and accepted connection semantics.
Wire data type updates derived read-only Width visibly; Scale/Offset/FC retain accepted meaning.
No separate Codec selector. Legacy invalid Width retains an explicit correction action.
String/COMMAND_ONLY show read-only producer unavailability without changing Definition validity.

Successful PUT reports the response to the parent and closes/unmounts immediately. DataSourcesPage
has minimal necessary save-return wiring: retain the invoking button, update only the matching
Definition row's saved mapping configuration status, preserve search/type/status filters and return
focus with a toolbar fallback. No catalog refresh or identity mutation on mapping Save. This local
row acknowledgment is not live quality or a new persistent cache; a page reload does not restore it.
Failed PUT preserves edits and stays open: local invalid fields focus first, otherwise the Server
summary gets focus after pending clears. No automatic retry. Cancel/Escape/backdrop do not persist;
closing during an in-flight save is guarded. Remove is separated from primary Save and confirmed.
The dev.7 validation helper and API remain unchanged.

## Evidence and docs

Read-only PowerShell before/after SHA256 procedure uses actual file-per-page persistence layout,
explicit optional files, existence changes, nested Page files and separate revision comparisons.
Compact FileName/Unchanged plus Format-List avoids column truncation. After-only adapter preserves
Owner's already captured Get-FileHash records without inventing missing nested/revision evidence.
Owner after-hash review remains PENDING. Browser canonical samples/Quality/Sequence/last-good:
NOT DIRECTLY OBSERVABLE BY DESIGN IN O2-B1. File hashes do not prove Browser Draft/UndoRedo.
Documentation/source tests are not PowerShell execution or Browser accessibility/layout proof.

## Locked boundaries

No production Server behavior changes; version literals/version expectations only. No mapping API,
schema, validation, persistence, acquisition/Store/Device lifecycle, Modbus framing, queue priority,
Definition CRUD/bindings, Overview persistence, Workflow or Monitor changes. No Traffic file edits:
FUNCTIONAL PASS; header density, compact timestamps, payload/error/empty-error density, scrolling
and responsive polish deferred to O2-D. No retention, pagination, producer, REST/WS or coalescing change.
No O2-B2/B3/C/D, String decoding, Codec selector, Variable Runtime, commands/controls, cross-owner
broker, diagnostics/API/console observer, MQTT/Sparkplug, Historian/HA, assets or permissions.
No dependency upgrades or hygiene scanner changes. No PR/main push/tag/release/ZIP.

## Delivery

Stage 1 targeted Acquisition UX, documentation evidence, protected Client regression, both typechecks
and builds; then Full Client/Server/check, strict hygiene, verify:publish and diff check. One targeted
correction/retry per failed command. One commit `fix(acquisition): refine mapping editor UX`, normal
push on the session branch, Actual Remote verification, then Owner Local Manual Review PENDING.
