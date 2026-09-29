# Current Project State

## Current application — v1.4.0-dev.16

Approved base **e3f606765c8d8b83a4c30b0b861e5f90d762050e / dev.15**, branch
`arena/01a0d291-modbus-workflow-studio`. **Dev.16 Owner Local Manual Review PENDING.**
Scope: O2-B3 Optional Inline Runtime Details Action only.

One optional persisted field, `style.showRuntimeDetails?: boolean` (absent = false at read time;
no migration, no read-time write; new eligible Monitoring Elements are created false). Inspector
checkbox **Show Runtime Details** (Appearance group; Numeric Label, Value Badge, Status Light,
Text Label only). True renders the dev.15 button/slot when the existing size gate passes; false
renders no button, no gutter and no focusable control, and Caption/Value/Unit/status reclaim the
space. Edit/View share one layout helper. Page-level `Runtime details & safety → Element Runtime
Details` fallback, Details eligibility/overlay, projection, subscriptions, geometry, savedViewport,
revision, Draft/Save/Cancel/history, O2-B1/B2, Controls/Navigation, Workflow/Monitor/Traffic,
`/ws/live` and write safety are unchanged. Production Server changed only for version sync.

Validation: Stage 1 targeted Client 1032/51 + Server 14/4; Full Client **1162/66**, Full Server
**327/25**, `npm run check` PASS. Browser/screen-reader review PENDING. No PR/tag/release/ZIP;
O2-C/O2-D NOT STARTED. [Scope](SCOPE_O2-B3_v1.4.0-dev.16.md) ·
[Acceptance](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.16.md).

## Previous checkpoint — v1.4.0-dev.15

Approved base **0d4147d61fe89b875caa425b148ae94c636036c5 / dev.14**, branch
`arena/01a0d291-modbus-workflow-studio`. Owner dev.14 local manual review **PASS**.
Selected direction **A+B**: industrial HMI with compact low-noise Canvas Element composition.
**Dev.15 Owner Local Manual Review PENDING.** No application-shell or Page-background redesign.

Runtime rail paint removed in both modes; existing abnormal 2px allocation preserved, no new
normal inset. Selection/resize/Binding chrome remain. Monitoring displays projected values and
one concise operator status, explicit Historical/Cached; stable status row or separate marker
slot determined only by geometry/configuration. Light remains passive and symbol-distinct.
Switch/Push Button show PREVIEW ONLY once plus full accessible no-command description; original
handlers/state path unchanged. Navigation glyph/link-like appearance, original handler unchanged.
Empty Text has no generic visible fallback. Image/Picture remain placeholders; no assets/O2-C.

No persisted field added. dev.14 style model/defaults/validation/Inspector/base-font fallback,
background alpha and legacy whole-element opacity preserved. No migration or read-time writes.
No automatic color correction, opaque fill injection, autosize or new small-mode property.
Details eligibility/overlay, Page fallback, Page status and all protected Runtime functions unchanged.

Recovery verified Actual Remote, compared and preserved **294 files byte-identical** to approved
archive, then CAS update-ref/read-tree without -u changed only metadata. Dependencies restored
once. External backups/logs are ephemeral; docs/commit/final handoff are durable evidence.

Stage 1 **1428 tests / 89 unique files PASS**: Canvas/HMI 304/16; Runtime/Catalog 179/9;
protected editor 378/18; remaining Client 244/22; Server 323/24. A final paint/Preview review
recheck passed 54/2 (not counted again). Both standalone typechecks/builds PASS. Full Client
**1105/65**, Full Server **323/24**, root check PASS. No failed command or correction/retry.
Strict hygiene **614/0/0**, complete worktree **300/0/0**, verify:publish/diff checks **PASS**.
Final scope **29 files: 23 modified / 6 new**. Final staged scan/Remote/clean-tree evidence
belongs in the delivery handoff.

Protected: Page background/shell/header/command bar/status, dev.14 schema/Inspector, Canvas
engine/geometry/savedViewport, Page revision/Draft/history/Save/Cancel, B1/B2/B3, Focus/Catalog,
Binding/quality/availability, Device/Manual Disconnect, Controls/Navigation, Workflow/Monitor/
Traffic/legacy WS/write safety. Server production version-only; scanner/dependencies unchanged.

Browser bounding-box/contrast measurements, mounted keyboard and screen-reader observations
remain **PENDING**. SSR/CSS/callback evidence is not Browser, hardware, performance or soak proof.
Arbitrarily small geometry and extreme fonts/colors/legacy opacity cannot guarantee readable
text. Accessible descriptions/eligible Page fallback retained; future contrast/minimum-size
advice only, no enforcement or automatic correction. Existing 66 SSR warnings per full Client
run and Vite chunk warning remain. Build: 1818 modules, JS 765.47 kB / gzip 220.96 kB, CSS
164.12 kB / gzip 25.39 kB. Advisories 5 moderate / 1 high / 1 critical unresolved/unaccepted.
No PR/tag/release/ZIP; O2-C/O2-D NOT STARTED.

[Scope](SCOPE_O2-B3_v1.4.0-dev.15.md) · [Acceptance](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.15.md).
Final staged/Remote/clean-tree verification belongs in the delivery handoff. Historical pending
states below do not override the latest Owner review.

## Historical dev.14 checkpoint (Owner local manual review subsequently PASS)

Approved base **20ba4edc09592f230d3a9ad3c2c687a1a05746b1 / dev.13**; branch
`arena/01a0d291-modbus-workflow-studio`. Owner approved dev.13 functionality and HMI parity.
Dev.14 scope is HMI authoring/presentation only. **Owner dev.14 local manual review PENDING**.

Only four optional persisted style fields: captionFontSize/valueFontSize (8–96 px),
backgroundOpacity (finite 0–1 alpha multiplier), showBorder (outer frame only). New defaults
11px caption, 16px Number/Badge value, 12px Light text, opacity factor 1, border On.
Legacy absent fields retain dev.13 typography/paint/frame; Base Font Size and whole-element
Overall Opacity remain independent. No migration/default writes on inspection. Existing
Server passthrough and strict Binding/Source identity validation unchanged.

Live Edit preview is a rendering overlay; one completed gesture commits via existing history.
Inspector groups Content/Typography/Appearance/Border/Layout/Binding or Navigation/Preview/
Actions. Details SVG is centered in a 24px fixed slot where it fits; small Elements use Page
Details. Safety uses a non-modal fixed portal with internal scroll and no in-flow expansion,
no-scroll focus return and close-before-Details handoff. UI leaf only; Provider/Canvas unchanged.

Stage 1 **1329 tests / 86 unique files PASS**: presentation 200/12, Runtime/Catalog 179/9,
editor/protected 383/19, remaining Client 244/22, Server 323/24. Focused first run had two
legacy Unicode-glyph expectations; one targeted test correction/retry passed 200/12.
A subsequent bounded-reading CSS review was verified by 45/1 presentation tests (not counted
again). Client/Server typechecks/builds PASS. Full Client **1006/62**, Full Server **323/24**,
root `npm run check` PASS first attempt. Strict hygiene **592/0/0**, complete worktree
**294/0/0**, verify:publish and diff check **PASS**. Final scope **37 files: 26 modified /
11 new**. Final explicit staging/staged hygiene and Remote verification belong in the handoff.

Recovery verified approved Actual Remote and all **283 preserved files identical** to its
archive, then CAS update-ref/read-tree without -u preserved all hashes. Missing dependencies
restored once. Ephemeral external logs are not durable truth; docs/commit/handoff record results.

Protected: B1/B2, Catalog/focus/Runtime lifecycle, Binding/quality/availability, history/revision/
Save/Cancel/geometry/savedViewport, Device/Manual Disconnect, Controls/Navigation, Workflow/
Monitor/Traffic/legacy WS/write safety. Server production version-only; scanner/dependencies
unchanged. No deferred presentation fields, O2-C/O2-D, Picture Box/assets or production commands.

Browser geometry/mounted focus/screen-reader behavior **PENDING Owner review**. Automated
SSR/CSS/callback/headless evidence is not hardware/performance/soak certification. Known
66 SSR warnings per full Client execution, chunk warning (1817 modules; JS 762.48 kB / gzip
220.08 kB; CSS 160.86 kB / gzip 25.00 kB) remain. Advisories 5 moderate / 1 high / 1 critical
remain unresolved/unaccepted. No PR/tag/release/ZIP; O2-C/O2-D NOT STARTED.

[Scope](SCOPE_O2-B3_v1.4.0-dev.14.md) · [Acceptance](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.14.md).
Final explicit staging/Remote/clean-tree evidence belongs in the delivery handoff.
Historical pending states below do not supersede the latest Owner approval.

## Historical dev.13 checkpoint (Owner subsequently approved functionality/Edit-View parity)

Approved base `742543b2c23b783fd085d0e0f917159943ffa6bb` / dev.12, branch
`arena/01a0d291-modbus-workflow-studio`. Owner manual review approved dev.12 Runtime
functionality, lifecycle and View HMI simplification; dev.13 manual review remains PENDING.

Approved scope: shared Edit/View Monitoring presentation, Status Light Show Text, Runtime
Details information hierarchy, compact Page status and version/tests/docs. No O2-C/O2-D.
Edit uses representative `8888.88`/`FALSE`, never live Runtime; configured caption or none.
New light Show Text Off; absent legacy field On. Optional boolean `style.showText` is the
only new persisted property, carried by existing Server passthrough. No Server behavior change.
Details preserve every diagnostic field; GOOD full precision is primary, historical Last-good
is disclosed on demand. Page failures/recovery/limits/disabled remain visible; safety accessible.

UInt16 0xB1E0 = 45536; Int16 = -20000. Existing Float32/Float64 codecs support decimals.
No Client reinterpretation; Mapping controls byte/word order. Codec and acquisition unchanged.

Stage 1 **1233/81 PASS**: HMI 120/8; Runtime/Catalog 179/9; editor 372/19; protected Client
244/22; Server 318/23. Full Client **915/58**, Server **318/23**, root `npm run check`
(typechecks/tests/builds) **PASS first attempt**. Scanner **91 PASS**; strict **578/0/0**,
worktree **283/0/0**, verify:publish and diff check **PASS**. Final scope is **31 paths:
24 modified / 7 new**. Final explicit staging/staged hygiene and Remote/clean-tree evidence
belong in the delivery handoff, not inferred from tests.
Fresh recovery compared all 276 preserved files to approved Remote archive byte-for-byte;
CAS update-ref and read-tree without -u changed metadata only. Dependencies restored once.

Catalog/focus/runtime lifecycle, B1/B2, Binding/quality/availability, Page/history/revision,
geometry/viewport, Device/Manual Disconnect, Controls/navigation, Workflow/Monitor/Traffic
remain locked. Server version-only. Hygiene scanner unchanged from approved dev.12.
No dependency graph changes or new dependencies. No PR/Tag/Release/ZIP. O2-C/O2-D NOT STARTED.
Advisories 5 moderate / 1 high / 1 critical remain unresolved/unaccepted. Existing SSR/chunk
warnings remain (66 SSR warnings; JS 752.84 kB / gzip 217.43 kB; CSS 158.23 kB / gzip
24.53 kB; 1813 modules). No browser/screen-reader/hardware/soak certification.

[Scope](SCOPE_O2-B3_v1.4.0-dev.13.md) · [Acceptance](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.13.md).
Final Remote SHA and clean-tree evidence belong in the delivery handoff, not inferred from tests.

The entries below are historical; their pending states do not override the latest Owner review.

## Historical dev.12 checkpoint (Owner subsequently approved Runtime/lifecycle/View HMI)

O2-B3 HMI Presentation Polish, approved base
`2e90a03c75259f7e0e3cc0f2afd372ac87c478fd` / dev.11, branch
`arena/01a0d291-modbus-workflow-studio`. Owner approved dev.11 functionality/lifecycle,
including focus without new Snapshot/socket, Edit/inactive disposal and clean View re-entry.

View Monitoring now prioritizes configured caption, value/unit and concise abnormal status.
Empty Text has no invented caption. Detailed Binding/identity/transport/reason/timestamps
remain on demand; last-good/current sample full precision and accessible Details retained.
Page status compacted with health counts, visible failures/limits/disabled/trust boundary.

Only presentation changes. Catalog/lifecycle, B2, Binding matrix, Store, acquisition, Device,
quality/availability semantics, Page/Draft/history/geometry/viewport and Preview controls
are locked. Production Server version-only. No dependency upgrades. O2-C/O2-D NOT STARTED.

[Scope](SCOPE_O2-B3_v1.4.0-dev.12.md) · [Acceptance](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.12.md).
Stage 1 **981/65 PASS**; Full Client **872/55**, Server **305/21**, root check **PASS**.
Owner accepted these results and authorized only a narrow scanner correction plus focused
regressions to resolve the counter-expression false positive. Focused scanner suite **91 PASS**
on first attempt. No allowlist/suppression/bypass added. Catalog, lifecycle and accepted HMI
production/tests unchanged during continuation; accepted application gates not rerun.
Strict retry **568 files / 0 errors / 0 warnings**, complete worktree scan **276/0/0**,
verify:publish and diff check **PASS**. Final explicit staging/staged hygiene and Remote
verification are required before declaring delivery. **Owner Local Manual Review for
dev.12 PENDING**. Final Remote SHA/clean-tree verification belongs in the delivery handoff.
Headless/SSR/callback checks are not browser, screen-reader, hardware or soak certification.
Known SSR/chunk warnings and advisories 5 moderate / 1 high / 1 critical remain unresolved.
Trusted network or authenticated proxy only; no PR/Tag/Release/ZIP.

The entries below are historical; their pending states do not override the latest Owner review.

## Historical dev.11 checkpoint (Owner subsequently approved Runtime/manual lifecycle)

Approved O2-B3 Client focus/Catalog-refresh hotfix, base
`64746ff670abce0539a844afe8f8c254f342b77e` / dev.10; branch
`arena/01a0d291-modbus-workflow-studio`. Owner authorized Stage 1, Full Gates,
one commit and normal push. [Current acceptance](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.11.md).

Initial metadata readiness is separate from last confirmed Catalog, background pending and
background failure. Pending/failed refresh keeps BOUND/selection and the healthy Runtime;
accessible warning is non-blocking. Semantic selection/compatibility/Number-unit changes
fence and reconcile; reference-only changes do not restart. No extra reconnect loop.
Edit/inactive/navigation/visibility/offline/StrictMode fences and Preview-only controls remain.
No B2 protocol or Server behavior changes except version literals. Dependencies unchanged.

Owner confirmed dev.10 Origin configuration-only resolution and read-only presentation;
Origin validator/proxy/Client bypass changes are not authorized. O2-D backlog only:
Origin setup guidance, environment-loading path/restart, template guidance and regression
coverage. None of that follow-up is implemented here. O2-C/O2-D NOT STARTED.

Stage 1 **871/56 PASS** (one targeted workspace test-harness correction/retry).
Full Client **809/52**, Server **305/21**, root check, strict hygiene **558/0/0**,
verify:publish and diff check **PASS**, Full Gates all first attempt. Exact commands/groups
and evidence limits are in current acceptance. Final Remote verification is reported in
the delivery handoff; no PR/Tag/Release/ZIP. Existing SSR warnings 66; chunk-size warning remains.
**Owner Local Manual Review PENDING.** Automated headless/SSR tests are not browser,
hardware or soak certification. Advisories 5 moderate / 1 high / 1 critical remain
unresolved/unaccepted; trusted network or authenticated proxy only. No PR/Tag/Release/ZIP.

The following entries are historical, not the authority for dev.11.

## Historical dev.10 application

**O2-B3 Overview Read-only Live Rendering — Owner ACCEPTED Stage 1 / development checkpoint delivery.**
Base `9d73d96ee910ac3ad1ad2a83a5572dbe77c1b309` / dev.9, branch
`arena/01a0d291-modbus-workflow-studio`. O2-B2 APPROVED AS TRANSPORT FOUNDATION.

Read-only Number/Boolean monitoring in active Overview View only; String producer unsupported.
Edit remains EDITOR PREVIEW and unsubscribed. SWITCH/PUSH_BUTTON remain independent Preview controls;
CONTROL RUNTIME NOT ENABLED. No commands/writes, WVar producer, persisted Runtime formatting or
Runtime mutation of Page/Draft/history/geometry/viewport/Definition/Preview Control state.

One stable external store + adapter, unchanged B2 protocol, keyed rendering, bounded publication,
age and recovery, explicit lifecycle fencing. No global App Tag startup or Canvas semantics change.
Production Server changes are version literals only. Dependencies unchanged. O2-C/O2-D NOT STARTED.

[Scope and limits](SCOPE_O2-B3_v1.4.0-dev.10.md) ·
[Stage 1 results and exact changes](ACCEPTANCE_TESTS/O2-B3-v1.4.0-dev.10.md).
Stage 1 **PASS: 997 tests / 63 files** (new B3 120/8, protected Client 568/33, protected Server
305/21, boundary docs 4/1). Both typechecks and Client→Server builds PASS. Corrections/retries and
evidence limits are documented in acceptance. Existing SSR warnings 66; JS 744.72 kB / gzip 215.21 kB.
Owner now authorizes Full Gates, exactly one commit and normal push. Fresh Full Client **760/50 PASS**,
Full Server **305/21 PASS**, root `npm run check` **PASS** (normal typechecks/tests/builds).
Strict hygiene, verify:publish and final diff verification are required before committing; final
commit/push/Actual Remote results are recorded in the delivery handoff. No PR/Tag/Release/ZIP.
**Owner Local Manual Review PENDING (not performed).** Automated harness/SSR evidence is not browser,
hardware, real-browser performance or soak certification.
Advisories 5 moderate / 1 high / 1 critical remain unresolved and unaccepted.

The following dev.9/dev.8 entries are historical. Current authority is the Owner's dev.10 approval;
prior “O2-B3 NOT STARTED” and “no Overview values” statements describe their checkpoints only.


## Historical dev.9 transport checkpoint

**v1.4.0-dev.9 — O2-B2 Tag Runtime Delivery Foundation**.
Approved base `86b342b2eec5377773be45d3744d29509c2a64ce` / dev.8.
Branch `arena/01a0d291-modbus-workflow-studio`.
O2-B1 dev.8 **Owner ACCEPTED / Manual PASS**. Owner has now **ACCEPTED O2-B2 Stage 1** and
authorized Full Gates, exactly one commit and a normal push to this development branch.
Owner Local Manual Review for dev.9 remains **PENDING**; this is not production certification.

Read-only REST snapshot + dedicated Tag WS, canonical selections, atomic cursor boundary,
epoch/selection/coverage-bound replay, bounded ACK/backpressure and explicit resync. One Store
observer and read-only metadata invalidations. Headless client is opt-in, with bounded cache/apply,
reconnect/resume, request/socket/generation fences and complete disposal. No App/Overview activation.

**EDITOR PREVIEW / CONTROL RUNTIME NOT ENABLED**. O2-B3/C/D NOT STARTED. Store/acquisition/Device
policy, writes/guards, queues/framing, Definitions/Binding, Page/Draft/UndoRedo, Acquisition UX and
Traffic remain protected. Traffic FUNCTIONAL PASS; polish stays O2-D. Existing duplicate reads
across Workflow/Monitor/Shared Tags remain disclosed. No new producer or persistence contract.

[Scope / protocol / bounds / deployment](SCOPE_O2-B2_v1.4.0-dev.9.md) ·
[Stage 1 results / exact changes / limitations](ACCEPTANCE_TESTS/O2-B2-v1.4.0-dev.9.md).
Stage 1 **PASS**: REST 19/1, broker 14/1, Tag WS 18/1, dispatcher/legacy 9/3, headless 26/2;
protected Server 245/15, Client 545/32, boundary docs 4/1. Both typechecks and server→client builds
PASS. Final selected total **880 tests / 56 files**, now **Owner ACCEPTED**.
Full Client **640/42**, Full Server **305/21**, `npm run check` **PASS** in the checkpoint environment.
Strict hygiene, verify:publish, final diff and actual Remote verification are required before declaring
the checkpoint ready; final execution status and SHA are recorded in the delivery handoff.
Existing warnings: 66 SSR useLayoutEffect; JS 659.90 kB / gzip 193.10 kB. No suppressions.

Validation is automated harness/HTTP/WS/SSR evidence, not new Owner browser, hardware or soak certification.
Advisories **5 moderate / 1 high / 1 critical** remain unresolved, unaccepted and outside scope.
No dependency upgrades or functionality added during Full-Gate delivery. No PR, Tag, Release or ZIP.
Owner Local Manual Review **PENDING**; the complete checklist is in the dev.9 acceptance report.

The dev.8 status below is retained as history; its pending Owner review is now superseded by
Owner acceptance above. Its “O2-B2 NOT STARTED” statements describe that historical checkpoint only.

## Historical dev.8 checkpoint (superseded status)

**v1.4.0-dev.8 — Acquisition editor UX and persistence-boundary closure**.
Base `3e3c4e54d782515c7de1802956197fb2d138e321` / dev.7.
Branch `arena/01a0d291-modbus-workflow-studio`.
Owner dev.7 **APPROVED WITH PUNCHLIST**. Confirmed PASS: Acquisition validation/options,
Traffic normalization, Disconnect/queue/poller shutdown, no Shared Tag writes, existing Workflow/
Monitor, Overview runtime invisibility and disabled Control Runtime.

Frontend-only Acquisition layout/save-return/Enabled/readability/derived Width refinement.
DataSourcesPage changes only mapping-save row acknowledgment and focus restoration; filters retained.
No production Server changes except existing version values. No API/persistence/lifecycle changes.
Traffic FUNCTIONAL PASS, untouched; header/timestamp/payload/error/scroll polish deferred to O2-D.
Runtime persistence procedure now covers actual nested files/revisions, optional files and readable
After/Unchanged output. Owner before hashes confirmed; after comparison remains PENDING.
Canonical Browser Tag value/Quality/Sequence/last-good: NOT DIRECTLY OBSERVABLE BY DESIGN IN O2-B1.
File hashes do not directly prove Browser Draft/UndoRedo. No diagnostics or delivery added.

[Scope](SCOPE_O2-B1_v1.4.0-dev.8.md) · [acceptance/results](ACCEPTANCE_TESTS/O2-B1-v1.4.0-dev.8.md) ·
[Owner-local persistence procedure](ACCEPTANCE_TESTS/O2-B1-RUNTIME-BOUNDARY-v1.4.0-dev.8.md).
Stage 1 PASS: UX 96/4 (one test-only ref correction/retry), boundary docs 4/1, protected Client
520/37; both typechecks/builds PASS. Full Client **616/41**, Server **250/17**, check PASS.
Strict hygiene and verify:publish PASS (478 files, 0 errors/warnings); diff check PASS.
22 changed files. Existing warnings: 66 SSR useLayoutEffect; JS 659.90 kB / gzip 193.10 kB.
No PowerShell/browser/hardware execution claimed; Owner after hashes and UI review remain pending.
New Owner Local Manual Review **PENDING**. O2-B2/B3/C/D **NOT STARTED**.
Advisories 5 moderate / 1 high / 1 critical: not resolved, not accepted, outside punchlist.
No dependency changes, PR, Tag, Release or ZIP.

## Historical dev.7 checkpoint

**v1.4.0-dev.7 — O2-B1 validation and Traffic UX punchlist**.
Approved base: `55335b00ff7cf20c3fee14a09ebd46e52fb476d1` / dev.6.
Branch: `arena/01a0d291-modbus-workflow-studio`.
Owner **O2-B1 APPROVED WITH PUNCHLIST**, Manual Disconnect **PASS**.
Owner confirms A/B were changing UI columns: **CLIENT NORMALIZATION DEFECT**.

Frontend inline acquisition validation/compatibility and dedicated Traffic presentation only;
Server production differences are version literals only. Runtime acceptance evidence extends
existing tests and a private test-only child harness, not an app observer or delivery contract.
No production persistence/Store/lifecycle/queue/WS/REST change. Browser Tag values remain absent.
Overview stays EDITOR PREVIEW / CONTROL RUNTIME NOT ENABLED; Variable producer deferred.
No cross-owner dedup, producer identity, transaction grouping, runtime API or console observer.

New [scope](SCOPE_O2-B1_v1.4.0-dev.7.md) and
[acceptance/evidence](ACCEPTANCE_TESTS/O2-B1-v1.4.0-dev.7.md) supersede the historical checkpoint
for this punchlist. Execution gate results are recorded there after running, not inferred.
**dev.7 validation complete — Owner Local Manual Review PENDING.**
Stage 1 all PASS (Client 59/3 + 29/3 + 517/35; Server 140/7 + 110/10), both typechecks/builds PASS.
Previously completed Full Client **605/41**, Full Server **250/17**, `npm run check` PASS.
Those accepted application gates were not rerun for the final fixture-only correction.
Owner-authorized contextual scanner correction removes 14 ordinary-code false positives without
new allowlists, bypasses or production-runtime edits. Initial focused run stopped at 55/56 because
one positive JSON fixture was stored literally in test source. Owner-authorized runtime string
assembly now preserves the same positive case without a self-scan collision: **56/56 PASS**.
Strict hygiene retry **PASS (445 files, 0 errors, 0 warnings)**; verify:publish and diff check PASS.
Complete change set: **31 files**. No dependency graph change; Server production diff is version
literals only. One normal development-branch commit/push authorized; no PR, Tag, Release or ZIP.
Historical failed attempts and exact current evidence are preserved in the acceptance document.
Client bundle 657.32 kB (gzip 192.52); 66 existing SSR useLayoutEffect warnings remain.
Owner Local Manual Review **PENDING** (runtime boundary, browser/keyboard/layout, simulator/soak).
O2-B2/B3/C/D **NOT STARTED**. No PR, Tag, Release or ZIP.
Dependencies restored once with `npm ci --include=optional --ignore-scripts`, no graph change.
Advisories: **5 moderate / 1 high / 1 critical — not resolved, not accepted, not in punchlist**.

## Historical dev.6 checkpoint

**v1.4.0-dev.6 — O2-B1 Acquisition and Tag Runtime Foundation**.
Approved base: `20b929bb5bdd82673173764efab1effc98c2aa5a`, v1.4.0-dev.5.
Branch: `arena/01a0d291-modbus-workflow-studio`.
Owner **O2-A APPROVED / Local Manual Review PASS** supersedes older pending-review text.

O2-B1 includes TCP framing hardening, separate acquisition configuration/UI/API, independent
Shared Tag acquisition and a normalized memory-only Tag Runtime Store. No auto-connect or
cross-owner read broker. Store update observers are transport-neutral; no Tag delivery protocol.
WORKFLOW_VARIABLE producers remain deferred without changing Definition resolution.
Overview remains EDITOR PREVIEW / CONTROL RUNTIME NOT ENABLED, with no live rendering or
Page/Draft/revision/state persistence change.

Stage 1 final: TCP **36/1**, configuration **50/1**, scheduler/runtime/lifecycle **47/3**,
server regression **114/11**, client targeted regression **372/18** (tests/files), both typechecks
and both builds PASS. Two initial test commands failed on test-only matcher/version assertions,
then passed after corrections; details and exact selectors in acceptance documentation.
Client bundle warning: **645.10 kB**; SSR `useLayoutEffect` warnings remain. No browser/manual interaction or hardware/soak PASS claimed.
Owner **ACCEPTED Stage 1** and authorized Full Gates, one commit and normal development-branch push.
Full Client **523/36**, Full Server **247/16**, `npm run check` PASS (both typechecks, tests and builds).
Strict hygiene and verify:publish **PASS — 411 files, 0 errors, 0 warnings** each; diff check PASS.
No production/test source correction was required for these Full Gates; no passing gate was retried.
Owner Local Manual Review **PENDING**, including hardware/simulator and extended/soak review.
Development checkpoint only; no PR, Tag, Release or ZIP.

[Approved O2-B1 scope](SCOPE_O2-B1_v1.4.0-dev.6.md) ·
[Stage 1 acceptance/evidence](ACCEPTANCE_TESTS/O2-B1-v1.4.0-dev.6.md).
O2-B2, O2-B3, O2-C and O2-D remain NOT IMPLEMENTED / NOT AUTHORIZED.
Dependency advisory baseline: **5 moderate, 1 high, 1 critical — Not resolved / Not accepted /
Not part of this checkpoint**. The one authorized dependency restore (`npm ci --include=optional --ignore-scripts`) reported
these same advisories. No audit fix or upgrade was performed.

### Approved dev.5 checkpoint (historical)

O2-A Inspector motion/focus and automatic saved-reference batch/count/details UX were delivered
at `20b929bb5bdd82673173764efab1effc98c2aa5a`. Owner subsequently supplied Manual Review PASS.
Historical full Client **517/35**, Server **110/10**, typechecks/builds/check and hygiene/publish
passed. Those are not dev.6 Full Gates results.

### Previous checkpoint validation (historical)

Dev.4: Stage 1 Client 403 tests / 21 files; Full Client 481 / 32, Server 84 / 9; both typechecks,
builds/check, strict hygiene/publish and diff checks PASS. These are historical, not dev.5 results.

## Approved historical baseline

v1.3.0 Overview Designer Foundation is merged (not merge-pending). Final O1 Owner Review PASS
at `58c3586e1f433b44fca53bf2c183be6065a796e5`; released-version source is the merge above.
Historical release-preparation documents may still describe the earlier PR-pending checkpoint.

[Release notes](RELEASE_NOTES_v1.3.0.md) · [O1 acceptance](ACCEPTANCE_TESTS/O1-v1.3.0-dev.2.md).

## Historical record — not current implementation authorization

The following older plans/status/security observations are retained for traceability. Old version
assignments (including cross-workflow execution under v1.3.0) do not override current Owner scope.
The O2-A dependency installation reports 7 advisories (5 moderate, 1 high, 1 critical); no audit fix
or risk acceptance was applied. This is not a fresh full security assessment.

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
