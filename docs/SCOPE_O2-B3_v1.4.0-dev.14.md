# O2-B3 dev.14 — HMI Authoring UX and Presentation Schema

Owner FINAL APPROVAL controls. Base **20ba4edc09592f230d3a9ad3c2c687a1a05746b1 /
v1.4.0-dev.13**; target **v1.4.0-dev.14**; branch `arena/01a0d291-modbus-workflow-studio`.
Owner approved dev.13 functionality and Edit/View HMI parity. Dev.14 manual review PENDING.

## Approved implementation

- Only optional style fields `captionFontSize?: number`, `valueFontSize?: number`,
  `backgroundOpacity?: number`, `showBorder?: boolean`. No other persisted additions.
- Caption/Value override finite 8–96 px, Inherited/Custom and explicit Reset to Inherited.
  Missing overrides leave DOM font-size unset, preserving exact dev.13 CSS typography.
  Base Font Size is unchanged: caption clamp(11px, .65em, 15px), micro .65em;
  value inherits base, Light text .75em. Unit .6em and lamp sizing remain base-derived.
  New Monitoring captions 11px; Number/Badge values 16px; Light visible text 12px.
  Text Label remains unsupported String Runtime, not a decoder or active Value formatting UI.
- Shared Edit/View rendering. Numeric and opacity preview are transient rendering overlays;
  Enter/blur/pointer-up or keyboard slider completion commits once through existing style
  mutation/history. Escape/pointer-cancel cancels the gesture. Opening does not dirty a Page.
- Background Opacity stored 0–1, displayed 0–100%; missing = 1. It multiplies existing color
  alpha on an isolated outer-background paint layer only. Factor 1/absence keeps original
  background painting; factor 0/.5 does not change text, Unit, Light, icon, border, focus,
  selection or Control warning opacity. Legacy whole-element opacity is retained separately
  in Advanced; when below 1 it still dims the whole Element, exactly as before.
- Show Border missing/new = On; Off uses transparent border color while keeping width/space.
  Applies to the outer frame of all 13 types. It never hides intrinsic lamp/track/button/link,
  Image/Picture placeholders, Divider line, abnormal indication or Preview warnings. No assets.
- Inspector groups Content, Typography, Appearance, Border, Layout, Binding/Navigation,
  Preview information, Actions. Legacy Base Font/Overall Opacity and geometry remain available
  in native disclosures. Hidden groups use native details behavior, not opacity-only hiding.
- Decorative Lucide Info SVG, scoped grid centering, 24×24 action target and stable right
  gutter. Inline eligibility: inner width >=112px and inner height >=32px after frame width.
  Independent of Runtime sample/value. Smaller Elements point to existing Page Element Details
  list. No stored geometry enlargement or change to Details/selection eligibility.
- Replace in-flow safety details with a UI-only non-modal portal. Fixed/bounded panel,
  internal scroll, Escape/Close, no Tab trap, no-scroll focus entry/return, 140ms entry animation
  disabled for reduced motion; closed panel unmounts. Close panel first, focus stable trigger,
  then open existing Runtime Details. Panel layer remains below existing modal layer.
  Only the UI action is Page-keyed; no Provider/Canvas remount, new Runtime hooks, fitView,
  setViewport, scroll lock, persistence calls or geometry/history/revision mutation.
  Existing transport/health/error/recovery/disabled/limit callouts remain outside the panel.

## Persistence compatibility

No bulk migration or read-time normalization. Existing clone/spread/JSON Save paths retain
unknown supported style fields; explicit reset writes no numeric fallback. Existing Server
Element passthrough already supports metadata, so no Server schema/API changes. Binding/Source
identity strict validation stays unchanged. Runtime samples/preview gesture/panel state are
never saved. Unchanged Save remains a no-op; normal changes follow existing revision rules.

## Protected scope

B1 acquisition/codecs; B2 Snapshot/Tag WS/cursors/ACK/replay/backpressure/Origin; B3 provider,
session/store/adapter/selection/Catalog/focus hotfix; Binding/quality/availability; Device and
Manual Disconnect; Page/history/Save/Cancel/revision/geometry/savedViewport; Control Preview,
Navigation; Workflow/Monitor/Traffic/legacy /ws/live/write safety remain unchanged.
Production Server version-only. Dependency versions/resolutions/integrities and scanner unchanged.

Defer separate weights/alignments, padding, unit visibility/size, configurable overflow and
small-Element mode. Exclude Production Control/Overview writes/WVar Runtime/String decoding,
alarms/runtime-driven styling/visibility/animation, Historian/Trends/PictureBox/assets/O2-C/O2-D,
MQTT/Sparkplug/auth/users/dependency upgrades. Necessary additional Server/API/protocol change
is a Material Blocker requiring Owner approval before edit.

## Delivery contract

Stage 1 targeted/persistence/protected tests, both standalone typechecks/builds; Full Client,
Full Server, root check, strict hygiene, verify:publish and diff. One correction/retry per
failed command, then stop if retry fails. Explicit scope/hash audit and staged strict scan.
One commit `fix(overview): expand HMI authoring presentation controls`, normal push on fixed
branch, verify Actual Remote/HEAD/clean/staged-zero/version; no amend/rebase/force/main/PR/
tag/release/ZIP. Owner local manual review, Browser geometry and screen-reader behavior PENDING
unless actually exercised. No O2-C/O2-D work.
