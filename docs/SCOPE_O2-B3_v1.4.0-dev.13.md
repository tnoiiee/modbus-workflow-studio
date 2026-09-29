# O2-B3 dev.13 — Editor Parity and HMI Information Polish

Owner FINAL APPROVAL is controlling. Base **742543b2c23b783fd085d0e0f917159943ffa6bb** /
**v1.4.0-dev.12**; target **v1.4.0-dev.13**; branch `arena/01a0d291-modbus-workflow-studio`.
Owner approved dev.12 Runtime functionality, lifecycle and simplified View HMI.

## Implementation boundary

1. Edit/View share the same Monitoring markup and CSS: caption, font family/size/weight,
   alignment, value/unit hierarchy, padding/line-height, lamp size and Badge proportions.
   Number preview 8888.88 and Boolean FALSE are representative only. No new formatting,
   font or preview-state persistence. Unsupported String still has no process value.
   EDITOR PREVIEW and Binding chrome is positioned outside the Element's layout box;
   selection/selected-only drag/resize/Inspector/Save/Cancel/history/viewport remain unchanged.
2. Only configured Text becomes caption; empty Text has no fallback in either mode.
3. Narrow optional `OverviewElementStyle.showText?: boolean`, STATUS_LIGHT only. New lights
   explicitly false (Off); absence on legacy lights reads as true (On), without a migration
   or read-time mutation. Inspector patches only style through existing draft/history code.
   Client validation rejects non-booleans and use on other types. Existing Server Element
   passthrough already retains this metadata: no Server schema/behavior change is needed.
   Light uses dot/filled, minus/hollow and question/dashed distinctions, not color alone.
   Off hides visible TRUE/FALSE but preserves accessible status. No switch/command semantics.
4. Details uses logical sections, one prominent projected value and a native historical
   Last-good disclosure. Failed/raw sample is diagnostic, never promoted to current GOOD.
   Identity/Binding/availability/quality/reason/timestamps/age/full precision and safety remain.
   Existing Modal, portal, Escape/close/focus return and keyboard handling are unchanged.
5. Page status compact row: transport, Tags, relevant health counts; BAD is an explicit
   subset of existing unavailable classification. Safety and tiny-Element Details access are
   in the disclosure. Failure/recovery/limits/disabled callouts remain outside. Cache summary
   still uses the existing 1 Hz clock, with no extra per-Tag subscriptions or new quality rules.
6. Signed/decimal tests/docs use the existing codec. UInt16 of 0xB1E0 is 45536; Int16 is -20000.
   Float32/Float64 decimals and byte/word order stay Mapping/codec responsibilities. No Client
   signed conversion, decoder change or custom persisted formatting.
7. Version-only changes across manifests/lock application entries/UI/health/banner/tests;
   README/CHANGELOG/CURRENT_STATE and this scope/acceptance synchronization.

## Expected source and test areas

- ElementNode, RuntimeMonitoring, ElementInspector, overviewElements: common preview and
  narrowly approved Show Text presentation field; no editor/lifecycle engine changes.
- RuntimeDetails, OverviewRuntimeStatus, overviewRuntimePresentation health count only,
  overview-runtime.css; canonical sample projection and formatting remain byte-identical.
- Focused parity/Inspector/Details/Page tests, updated affected presentation expectations,
  and Server tests exercising unchanged codecs and existing Page persistence.
- Required version surfaces and five documentation paths only.

## Functional lock and exclusions

Catalog/focus refresh/runtime session/provider/adapter/store/selection; B1 acquisition/B2
Snapshot/WS/ACK/replay/backpressure/Origin; Binding matrix; quality/availability; Page
persistence except optional showText; history/revision/geometry/savedViewport; Device and
Manual Disconnect; Controls/navigation; Workflow/Monitor/Traffic/legacy /ws/live/write-safety
remain unchanged. Server production version synchronization only. Necessary additional
Server/protocol/persistence change is a Material Blocker, requiring Owner approval.

No Production Control/Overview writes/WVar Runtime/String decoding/custom formatting,
Alarm/Historian/Trends/PictureBox/assets/O2-C/O2-D/MQTT/Sparkplug/auth/users/dependency upgrades.
No hygiene scanner changes, suppressions or bypasses. No PR/tag/release/ZIP.

## Validation / delivery

Stage 1 standalone HMI, lifecycle/Catalog, editor/protected Client and protected Server groups;
then root `npm run check` (both typechecks, full Server/Client suites, both builds), focused
scanner regression, strict all/worktree hygiene, verify:publish, diff and staged strict scan.
Exact commands/results and manual/evidence limits are in acceptance. Explicit paths only,
staged zero before staging. One commit `fix(overview): align editor and HMI presentation`,
normal push to the fixed branch, Remote/clean/staged-zero/version verification. Rejected push
stops without retry. Owner local manual review PENDING; O2-C/O2-D NOT STARTED.
