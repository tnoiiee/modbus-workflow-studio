# O2-A — Tag/Variable Binding Foundation

Owner approved configuration-only implementation and targeted App navigation wiring.
Base: merged `main` at `eed588481ae7e7376f9926e58dbd37f9076b5c2e`, v1.3.0.
Session branch: `arena/01a0d291-modbus-workflow-studio`. Target: **v1.4.0-dev.1**.
O2-B, O2-C and O2-D remain planned, NOT authorized for implementation.

## Definition catalogs

Two logical catalogs share the versioned, atomic `DATA_DIR/source-definitions.json` store.
No production seed/synthetic sources. Restart loads definitions, not Runtime state.

- WORKFLOW_VARIABLE identity: `{sourceType, workflowId, variableId}`.
- SHARED_TAG identity: `{sourceType, sourceId}`.
- IDs are server-generated UUIDs, immutable after creation. Parent workflow UUID must exist.
- Definition metadata: `name`, `dataType`, `capability`, `description`, `unit`, `enabled`.
- No metadata is inferred from names, Modbus addresses, node type or Monitor items.
- Names may repeat; selectors show IDs and owning Workflow to disambiguate.
- Deleted workflows leave definitions on disk, excluded from read/list/resolution. No Workflow
  implementation is modified, no cascade rewrites Overview pages.
- Strict create/update validation rejects ID injection, unknown fields and Runtime payloads.
- Atomic temporary-write/rename; failed writes do not publish in-memory changes. Corrupt catalog
  fails explicitly rather than being silently replaced. Single-process metadata edits are
  last-write-wins; distributed catalog arbitration is not implemented.

### Metadata API (not a Runtime snapshot API)

| Operation | Endpoint |
|---|---|
| List / Create | GET / POST `/api/source-definitions` |
| Read / Update / Delete shared definition | GET / PATCH / DELETE `/api/source-definitions/shared-tags/:sourceId` |
| Read / Update / Delete variable definition | GET / PATCH / DELETE `/api/source-definitions/workflow-variables/:workflowId/:variableId` |

PATCH accepts metadata only; renaming is a name patch. HTTP 400 = malformed configuration,
404 = absent source/parent, 500 = storage failure. No Run/Stop/Trigger/Write routes.

**Delete policy:** UI uses Enable/Disable, not hard deletion. DELETE API is supported and tested:
references remain unchanged, resolve MISSING, and same-name recreation receives a new ID.
Disable retains identity and resolves INCOMPATIBLE with an explicit disabled reason.

## UI and persistence boundary

Overview Edit Mode → **Manage Source definitions** opens a configuration dialog. Save creates
or updates a real definition independently of the Page. Close discards only unsaved form input;
Page Cancel does not undo a separately saved catalog change. A notice explains this boundary.

Inspector provides type/Workflow/source selectors, read-only stable identity, current name/type/
capability/unit/description/enabled metadata, intended type/direction, status/reason and Clear.
Missing choices remain visible by ID. Each source selection/clear is one Draft mutation/Undo entry.
Existing Page Save/Cancel/Undo/Redo apply only to binding configuration, not Catalog persistence.

Definitions refresh on Overview activation, browser focus, explicit Refresh, and catalog save.
This is configuration retrieval, not periodic polling or Monitoring transport. Loading/failure is
not MISSING or BOUND: resolution is temporarily DRAFT with unavailable/refreshing feedback.
Catalog refresh changes no Page config, revision, dirty state, geometry or history.
Presentation resolution objects are memoized across geometry changes, bounded to current elements.

## Explicit compatibility matrix

The normalized Overview model already has Boolean, Number, String and legacy Unknown.
New definitions accept **Boolean / Number / String** only. `Unknown` is legacy/intended Draft
metadata, never a new source data type. Raw Modbus types (UInt16/Float32/etc.) are not implicitly
converted or mapped in this phase; a future acquisition adapter must normalize them separately.

| Element | Accepted definition types |
|---|---|
| NUMERIC_LABEL | Number |
| TEXT_LABEL | String |
| STATUS_LIGHT | Boolean |
| VALUE_BADGE | Boolean, Number, String |
| SWITCH / PUSH_BUTTON | Boolean |
| NAVIGATION_LINK | None — uses targetWorkflowId |
| PICTURE_BOX | No data binding compatibility in O2-A; modes deferred to O2-C |
| STATIC_TEXT / RECTANGLE / PANEL / DIVIDER / STATIC_IMAGE | No data interaction |

Intended binding type must equal definition type **and** appear in the Element row.
No name-based matching, JS coercion or value conversion. Missing type/capability metadata and
Unknown legacy intended type have distinct explanatory incompatibility reasons.

| Direction, from Element perspective | Compatible capabilities |
|---|---|
| MONITOR (consume) | MONITOR_ONLY, MONITOR_AND_COMMAND |
| COMMAND (configuration target only) | COMMAND_ONLY, MONITOR_AND_COMMAND |
| NONE | No resolution; any retained identity remains DRAFT |

Monitoring category allows MONITOR/NONE; Control allows COMMAND/NONE; Display allows NONE.
Navigation is the special Control case with no Tag selector and new defaults set to NONE.

## Resolution statuses

- NOT_BOUND: no identity or legacy free text; navigation has no Tag interaction.
- DRAFT: legacy tagId **or tagName** only; incomplete identity; NONE with retained identity;
  or unavailable Catalog. Never automatically matches names, node IDs or Monitor item IDs.
- BOUND: exact identity exists, enabled, metadata and intended Element type/direction compatible.
- MISSING: complete interacting identity is absent from a successfully loaded current catalog.
- INCOMPATIBLE: present but disabled, missing/unknown type metadata, type/capability mismatch.

`resolveOverviewBinding` is pure. Derived resolution is never written back into elements.
New binding configuration persists `source` plus intended type/direction and existing legacy text
fields, but **omits status**. Server rejects derived status/Runtime fields in new Source bindings.
O1 free-text payloads remain readable without automatic migration or load-time writes; existing
legacy status is a configuration hint only. Name-only legacy references remain DRAFT (Owner O2-A
decision supersedes O1's tagId-only display rule).

## Control and navigation boundaries

BOUND is **configuration compatibility, not Runtime availability or authorization**. COMMAND
controls show **CONTROL RUNTIME NOT ENABLED**. Existing Switch independent Preview persistence
and transient Push Button preview remain separate. No control event uses Source identity to issue
commands. No Commanded/Effective/Read-back or LIVE ARMED behavior is added.

NAVIGATION_LINK stores only `targetWorkflowId` for navigation, outside binding. View click checks
the current Workflow list by ID, invokes the existing `selectWorkflow` path, then opens Workflow.
Missing target/list errors show feedback and do not select a fallback. Edit renders a selectable
Element, never a navigation control. App wiring only supplies a stable callback; selector, autosave,
Workflow APIs, revision and Runtime implementations are unchanged. No Run/Stop/Trigger/mode calls.
Explicitly changing an Element type to navigation clears the incompatible binding in that same
undoable user action; merely loading or refreshing a legacy navigation Element never rewrites it.
Picture Box navigation/upload/modes are not implemented.

## Transport-neutral future boundary (documentation only)

Future acquisition → normalized Tag Runtime → stable identity → Overview / Workflow consumers.
Future Runtime has separate initial REST snapshot and WebSocket deltas with sequence, quality,
source/receive timestamps and reconnect/gap recovery. It must not persist process values into
Page config or advance Page revisions. Existing Workflow/Monitor values and WebSocket revisions
are **not** advertised as implementing this contract.

Definitions/identity use no MQTT or Sparkplug types. A future adapter maps into the neutral Runtime
boundary; no Broker, payload encoder, topics, Browser MQTT, credentials/config or commands here.
No new quality/timestamp/sequence Runtime interfaces or services are implemented in O2-A.

## Protected areas / exclusions

Protect O1 View/Edit, Preview state, Page CRUD, Save/Cancel, Undo/Redo, selection/drag/resize and
performance, collision/delete confirmation, savedViewport, accessibility/responsive baseline,
React Flow lifecycle, Workflow CRUD/Canvas/runtime isolation, Devices, shared connections/queues,
Modbus guards, Audit, read-only Monitor and WebSocket reliability.

Excluded: O2-B/C/D, Runtime values, continuous Shared Tag acquisition/new polling, Runtime snapshot/
delta/quality/timestamps/sequence, MQTT/Sparkplug/Historian, production commands/Modbus writes,
command injection/authorization/interlocks/queues, LIVE ARMED changes, Picture Box, live font-size
improvement, Permissions, User Management, dependency upgrades, release/commit/push/PR.

[Acceptance and Stage 1 evidence](ACCEPTANCE_TESTS/O2-A-v1.4.0-dev.1.md).
