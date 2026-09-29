# O2-B3 dev.15 — React Flow Canvas HMI visual refinement

Owner FINAL DESIGN DECISION selects **A+B**. Base **0d4147d61fe89b875caa425b148ae94c636036c5 /
v1.4.0-dev.14**, branch `arena/01a0d291-modbus-workflow-studio`, target **v1.4.0-dev.15**.
Owner dev.14 manual review PASS. Dev.15 Owner manual review PENDING.

## Canvas/Element-only presentation

1. Industrial reading hierarchy with compact low-noise composition. No mandatory card style;
   Owner Background/Border properties remain authoritative. Page background is intentionally
   configured, not a defect. No sidebar/header/Page CRUD/command bar/Runtime status-bar redesign.
2. Rail source was `.overview-runtime-value.has-abnormal` in overview-runtime.css. Change only
   its paint to transparent while retaining the original 2px allocation in both modes. Do not
   add an inset to normal readings, remove selection/resize/Binding chrome or affect the separate
   Page/Details callout rails. Geometry, position, width/height and rotation are unchanged.
3. Shared Monitoring renderer, empty Caption has no node/reserved Caption gap. Current/historical/
   placeholder choice, numeric precision, valid zero/false and quality/availability remain canonical.
   Canvas-only helper changes wording: No data, Uncertain, Stale, BAD, Disconnected, Unsupported,
   Historical/Cached qualifiers. Age stays in Details; roomy surfaces may show it. No raw reason
   code, GOOD badge, full-card quality tint, alarm model, color-only meaning or per-sample aria-live.
4. Primary reading/Light, critical state, Caption, Unit, inline Details in priority order. Pure
   geometry/configuration helper chooses stable status row versus a separate critical-marker
   column, optional text visibility and action slot. No live value/quality input to layout decisions.
   Tight readings clip within their own slot rather than covering the marker. Full configured
   Caption/value/unit/status remain in the group's accessible name; visual-only duplicates are
   aria-hidden. Empty status slot retains allocation without a visible GOOD marker.
5. Light filled/dot TRUE, hollow/minus FALSE, dashed/question unavailable. Use existing lamp
   projection; historical/cached do not become confirmed TRUE/FALSE. Show Text Off hides words,
   not accessible or abnormal state. On displays words where the geometry permits; very small
   layouts prioritize the lamp and critical marker. No switch/command behavior.
6. One visible PREVIEW ONLY per Switch/Push Button. A hidden description referenced by the native
   Preview button explains Runtime is not enabled and no Device/Workflow command is sent.
   Existing Preview state path, pending guard, pointer pressed/cancel and callbacks unchanged.
   Switch configured Caption is available in its accessible name and shown on sufficiently roomy
   controls. Binding/EDITOR PREVIEW is external, Edit-only. Existing Page warning is unchanged.
7. Navigation has directional glyph/link-like styling, no PREVIEW ONLY or Monitoring decoration.
   Configured Text only; empty Text retains the existing non-visual accessible action name.
   Native button/handler/target feedback unchanged, no Start/Stop/Trigger behavior.
8. Static Text uses configured Text only. Rectangle/Panel preserve paint/Text, Divider its intrinsic
   line. Image/Picture preserve dashed placeholder plus decorative glyph and configured Text,
   with non-visual placeholder descriptions. No generic visible type-name fallback, upload/assets,
   Runtime producer or expanded Details eligibility.
9. Details stays top-right in a fixed 24px slot when it fits the reading/status layout; otherwise
   use the unchanged dev.14 Page-level fallback. No hover-only route, provider remount, new hooks,
   subscriptions, persistence/viewport calls or geometry changes. Details/safety overlay untouched.
10. Preserve all Owner color/alpha/frame/legacy opacity properties. No automatic color correction,
    opaque surface injection or persisted contrast/size field. Meaningful status is text/symbol,
    not color alone; Element action focus uses inset two-tone paint. Caption/Unit legacy .8 opacity
    and font/base fallback rules remain; any future contrast guidance needs separate scope.

## Persistence and protected boundaries

No persisted field added; overviewElements.ts, overviewPresentationStyle.ts, dev.14 Inspector/
preview helpers, defaults/fallbacks/validation and Page clone/save paths unchanged. No migration,
read rewrite or preview/runtime sample persistence. Unknown supported style fields preserved.
B1 acquisition/codec/Device/manual-disconnect/write-safety, B2 protocol/transport/Origin/ACK/
backpressure/recovery, B3 session/provider/store/adapter/selection/Catalog/focus, Binding/
quality/availability, Page revision/history/Save/Cancel, Canvas geometry/savedViewport, Controls/
Navigation behavior, Workflow/Grid/Monitor/Traffic/legacy WS unchanged. Server version-only.

Exclude application shell/routes/kiosk/full-screen, Production Control/Overview writes, Alarms/
Historian/Trends/runtime-driven styling/visibility/animation, String decoding/WVar Runtime,
Picture Box/assets/O2-C/O2-D, MQTT/Sparkplug/auth/users/dependency upgrades. Necessary Server,
protocol, persistence or semantic change is a Material Blocker: stop before editing.

## Evidence and delivery

Stage 1 targeted/protected suites and standalone typechecks/builds; Full Client/Server/root
check, strict hygiene, verify:publish and diff. One correction/retry per failed command, stop
if retry fails. Final scope/hash/dependency audit, staged-zero before explicit staging, staged
strict scan. One commit `fix(overview): refine React Flow HMI element visuals`, normal push on
fixed branch, verify Actual Remote/HEAD/clean/staged-zero/version. No PR/tag/release/ZIP.
Browser geometry/contrast/screen-reader observations PENDING unless actually exercised.

Physical limits remain: 8px geometry, extreme configured fonts, transparent surfaces and near-zero
legacy Overall Opacity cannot guarantee legible text. No automatic enlargement/recoloring or
behavior change to conceal this. Full accessible information and eligible Page Details remain;
Owner checks minimum usable sizes/contrast locally. Guidance is future documentation, not a feature.
