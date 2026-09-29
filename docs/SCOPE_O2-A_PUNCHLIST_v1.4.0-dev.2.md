# O2-A punchlist — v1.4.0-dev.2

Owner review of O2-A: **APPROVED WITH PUNCHLIST**.
Base Remote checkpoint: `fa2ac89e1f4582df5f6cdda7fe8b6de40fd91390` (`v1.4.0-dev.1`).
Branch: `arena/01a0d291-modbus-workflow-studio`. Target: **v1.4.0-dev.2**.
This is an O2-A correction checkpoint, not authorization to begin O2-B/C/D.

## Approved changes

1. First-class **Data Sources** page in the Build group of the left sidebar. Manage both
   WORKFLOW_VARIABLE and SHARED_TAG definitions without entering Overview Edit Mode.
2. Keep an optional Data Sources shortcut in Overview, available in View and Edit. App keeps
   the Overview session mounted so navigation does not discard its Draft/history/Preview state.
3. Add **Delete** on the Data Sources page, alongside the existing metadata/Enable/Disable editor.
   Delete opens a confirmation dialog, initially focused on Keep definition. No deletion on open,
   cancel, backdrop or Escape. Disable remains a reversible alternative.
4. Read-only impact inspection for the exact immutable Source identity:
   `GET /api/source-definitions/shared-tags/:sourceId/references` and
   `GET /api/source-definitions/workflow-variables/:workflowId/:variableId/references`.
   Returns `scope: SAVED_OVERVIEW_PAGES`, saved Page/binding counts and Page/Element IDs/names/types.
   This is configuration metadata, not a Runtime snapshot API.
5. Impact uses full identity, never display names, free-text legacy fields or navigation targets.
   It includes retained Source references even when direction is NONE. Source type and owning
   Workflow are isolated. Unsaved browser Drafts are not on the Server and are explicitly excluded.
   Counts are point-in-time, may change before confirmation, and can be manually refreshed.
6. Confirm remains disabled while loading, after failed impact retrieval, or during deletion.
   Failure keeps the dialog open; no success notice is emitted. Deletion itself uses the existing
   DELETE API and never rewrites any Page identity, config, revision or history. Resolver remains
   unchanged: deleted source → MISSING after Catalog refresh. Same-name recreation gets another ID.
7. Pull forward **only real-time Font Size Draft rendering** from O2-C, for every text-bearing
   Overview Element (including existing picture/image placeholder text; no Picture Box behavior).
   Valid input in 8–96 previews immediately through an Edit-only canvas overlay. It does not mutate
   the saved Page, stored Draft, revision or Undo during typing/spinner input. Enter/blur commits the
   final changed property into the existing Draft/history pipeline once; Enter followed by blur is
   not a second commit. Escape/invalid input discards the current field preview; selection changes
   or unmount clear it. Page Save persists committed Draft style; Page Cancel restores baseline.
8. Element content now inherits the configured Font Size instead of overriding it with fixed
   control/label/value sizes. Safety/status badges retain their separate small typography.
9. Preserve **BOUND + EDITOR PREVIEW**. BOUND is still configuration compatibility, not live values.
   No Control Runtime. Navigation uses targetWorkflowId only and never Start/Stop/Trigger.

## Expected implementation areas

- Client App and Sidebar navigation; new DataSourcesPage/DeleteDefinitionDialog components.
- Existing DefinitionCatalogEditor (reused for create/edit) and Overview shortcut/API helpers.
- Server definitionRoutes and new read-only definitionReferences helper; index registration only.
- ElementInspector/OverviewPage, dedicated FontSizeField and pure font transaction/overlay helper;
  scoped Overview/Data Sources CSS. No Workflow Canvas or Runtime implementation changes.
- Targeted tests and synchronized version surfaces/documentation, without dependency changes.

## Protected areas

Existing stable identity/catalog persistence/resolver; Overview revision/Draft/Save/Cancel/Undo;
O1 Page CRUD/selection/drag/resize/collision/savedViewport/accessibility and React Flow lifecycle;
Workflow selector/CRUD/Canvas/Runtime isolation; Devices, Modbus queues/guards/acquisition;
WebSocket behavior; independent Overview Preview Control state.

## Exclusions

O2-B Monitoring Runtime, all Runtime Tag values or transport, new Modbus acquisition/polling,
MQTT/Sparkplug, Historian, Production commands, and O2-C Picture Box upload/storage/modes.
Only the expressly approved Font Size subset is pulled forward; other O2-C and O2-D work is not started.
No dependency upgrade, audit fix or vulnerability risk acceptance. Latest Owner delivery authority
permits exactly one commit (`fix(overview): complete O2-A definition and editor punchlist`) and a normal
push to the existing branch only after Full Gates and final diff verification. No PR, Tag, Release or ZIP.
Owner Manual Review remains PENDING; multi-Element browser interaction is an accepted review item.

[Validation and manual review checklist](ACCEPTANCE_TESTS/O2-A-v1.4.0-dev.2.md).
