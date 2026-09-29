# O2-B3 dev.16 — optional inline Runtime Details action

Owner final approval. Base **e3f606765c8d8b83a4c30b0b861e5f90d762050e / v1.4.0-dev.15**
(`fix(overview): refine React Flow HMI element visuals`), target **v1.4.0-dev.16**,
branch `arena/01a0d291-modbus-workflow-studio`. Owner dev.16 manual review PENDING.

## Problem

The inline Runtime Details button competed visually with process values and should not be
mandatory on every Operator HMI Element.

## Change (exactly one optional persisted presentation field)

`style.showRuntimeDetails?: boolean` on eligible Monitoring Elements.

| Value | Meaning |
|---|---|
| `false` / absent | No inline Details action, no action gutter, no focusable control |
| `true` | Existing dev.15 button/behavior, subject to the unchanged geometry gate |

- Absent resolves to **false** at read time. Nothing writes the fallback: opening a Page or the
  Inspector never dirties the draft; there is no bulk migration.
- New NUMERIC_LABEL / VALUE_BADGE / STATUS_LIGHT / TEXT_LABEL Elements are created with an
  explicit `false` (same convention as `showText`/`showBorder`); other types get no field.
- Inspector: checkbox **Show Runtime Details** in the existing Appearance group (no new
  group), labelled, `aria-describedby` supporting text, native keyboard/Tab semantics, hidden for
  every ineligible type. Edit preview updates immediately through the existing draft style path
  (one edit = one Undo entry; Save/Cancel/Undo/Redo/revision unchanged).
- Layout: the action slot (26px) is reserved only when the field is true **and** the existing
  `hasInlineRuntimeAction` size gate and status-row gate pass. When off the button is not
  rendered (not hidden by CSS), `has-page-action` padding applies and Caption/Value/Unit/status
  use the released width. Edit and View share the same helper and the same saved setting.
- Page-level fallback: `Runtime details & safety → Element Runtime Details` continues to list every
  eligible Element and open the same Details overlay. Eligibility (`isRuntimeMonitoring`,
  `overviewRuntimeSelection`), subscriptions, Snapshot/WebSocket protocol, Binding, quality and
  availability are untouched by the setting.

## Not changed

Runtime eligibility, Runtime projection, geometry/rotation, savedViewport, Page revision,
Draft/Save/Cancel/history, Controls, Navigation, Left rail removal, concise status, Status Light,
dev.14/dev.15 fields and behavior, O2-B1/B2, Device lifecycle, Workflow, Monitor, Traffic,
`/ws/live`, write safety. Production Server changes are version synchronization only.

## Exclusions

No Picture Box, assets, O2-C, O2-D, Production Control, alarms, historian/trends, Runtime-driven
styling, String decoding, WORKFLOW_VARIABLE Runtime, shell/Page-status redesign, MQTT/Sparkplug,
authentication, or dependency change.
