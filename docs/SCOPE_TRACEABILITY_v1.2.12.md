# v1.2.12 Scope Traceability Matrix

Status: **planning control document.** Every approved scope item is traced to its design rule, its
acceptance rows, the milestone that delivers it, the source files expected to change, and the tests
that will prove it. Nothing in v1.2.12 may be implemented without a row here.

- Scope: [SCOPE_v1.2.12.md](SCOPE_v1.2.12.md)
- Design contract: [UI_DESIGN_SYSTEM_v1.2.12.md](UI_DESIGN_SYSTEM_v1.2.12.md)
- Acceptance: [ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md)
- Baseline inventory: [UI_INVENTORY_v1.2.12.md](UI_INVENTORY_v1.2.12.md)
- Phase plan: [PHASE_PLAN_v1.2.12.md](PHASE_PLAN_v1.2.12.md)

Classification codes: `M-MERGE` mandatory for merge · `M-REL` mandatory for release ·
`COND` conditional on environment · `NB` non-blocking evidence.

## 1. Scope item to acceptance trace

| Scope item | Design rule | Acceptance rows | Class | Milestone |
| --- | --- | --- | --- | --- |
| 1. Design tokens and reusable primitives | §2, §2.1, §2.2, §5 | B01, B04, B05, B06, I03 | M-MERGE | 1 |
| 1. Typography and Thai rendering | §3 | B02, F08 | M-MERGE | 1 |
| 1. Selective glass with solid fallback | §4 | B03, F07 | M-MERGE | 1 |
| 1. Offline fonts/assets preserved | §3 | B08 | M-MERGE | 1 |
| 1. Behavior-preserving decomposition of `App.tsx` | §5 | D12, D13, G01-G08 | M-MERGE | 1-4 |
| 2. App shell, sidebar, navigation | §7, §11 | C01, C02 | M-MERGE | 1 |
| 2. Visible `LIVE` / `RECONNECTING` / `OFFLINE` | §7 (status pill) | C03, G08, H08 | M-MERGE | 1 |
| 2. Relative URLs, no browser localhost | §11 | C09 | M-MERGE | 1 |
| 3. Segmented command bar (4 groups) | §7 | D01, D03 | M-MERGE | 2 |
| 3. `Stop All` separated danger action | §7 | D02, C07 | M-MERGE | 2 |
| 3. **Visible Undo / Redo / Fit View (decision C)** | §7 (editing controls) | D14, D15, D16, D17, D18 | M-MERGE | 2 |
| 4. Replace all native dialogs (15 sites) | §6 | C04, C05, C06, C07, C08, C10 | M-MERGE | 2 |
| 4. No false success state | §6, §10 | C11, E11 | M-MERGE | 2, 4 |
| 5. Block Library categorized collapsible cards | §9 | D04, D05 | M-MERGE | 3 |
| 5. Library search/filter — **optional, non-blocking (decision D)** | §9 | D19 | NB | 3 (only if approved) |
| 6. Central bilingual block metadata (EN + TH) | §3, §9 | D06, B02 | M-MERGE | 3 |
| 7. Duplicate Block (inspector + node quick action) | §8 | D07, D08, D09, D10 | M-MERGE | 3 |
| 8. Function Block layout without overlap | §8 | D11, F04, F08 | M-MERGE | 3 |
| 9. Devices page redesign, all functions/APIs kept | §5, §12 | E01, E02, E03 | M-MERGE | 4 |
| 10. Modbus Monitor redesign | §5, §12 | E04, E05, E06 | M-MERGE | 4 |
| 10. Runtime Monitor redesign | §12 | E07 | M-MERGE | 4 |
| 10. **Traffic Monitor redesign, no clear action (decision B)** | §12 | E08 | M-MERGE | 4 |
| 10. Audit Log redesign | §12 | E09 | M-MERGE | 4 |
| 10. Validation redesign | §12 | E10 | M-MERGE | 4 |
| 10. **Project Settings UI-only, non-persistent (decision A)** | §10 | E11, C11 | M-MERGE | 4 |
| 11. Responsive 1024 / 1366 / 1920 | §11 | F01, F02, F03 | M-MERGE (F03 M-REL) | 5 |
| 11. Zoom 90 / 100 / 110 / 125% | §8, §11 | F04 | M-MERGE | 5 |
| 11. Keyboard, focus, contrast, reduced motion | §6, §12 | F05, F06, F07, B07 | M-MERGE | 5 |
| 11. Empty / loading / error / long content states | §5, §12 | F08, F09 | M-MERGE | 5 |
| Protected: React Flow semantics, ports, edges | §8 | D09, D11, D12, G02, G03 | M-MERGE | all |
| Protected: workflow CRUD, revision, save/reload | §7 | D13, G01, G02 | M-MERGE | all |
| Protected: runtime blocks (Manual Trigger, logic, mapping) | - | G04, G05, G06 | M-MERGE | 3, 6 |
| Protected: concurrent workflow isolation | - | G07 | M-MERGE | 6 |
| Protected: monitor scheduler reliability (carryover H1-H7) | - | H01-H07 | COND | 6 |
| Protected: reconnect/resync without duplicates (carryover H8) | §7 | H08, G08, C03 | M-MERGE | 6 |
| Protected: write safety (carryover H9-H10) | - | H09, H10 | COND | 6 |
| Protected: load/pressure/soak/hardware (carryover H11-H16) | - | H11-H16 | COND | 6 |
| Security disposition | - | I01, I02, I04 | M-REL / M-MERGE | 6, 7 |
| Dependency additions justified | - | I03 | M-MERGE | 1 (when proposed) |
| Hygiene and runtime-data policy | - | I05, J07, J08 | M-MERGE | every milestone |
| Version bump and synchronization (decision F) | - | J06 | M-MERGE | 1 (first implementation commit) |
| Release gates and tag/ZIP hold | - | J01-J05, J09-J11 | M-MERGE / M-REL | 7 |

## 2. Exclusion trace (must stay absent)

| Excluded item | Verification | Acceptance row |
| --- | --- | --- |
| Publish Variable / Read Variable, cross-workflow signal runtime (deferred to v1.3.0, not cancelled) | code search for new block types, library still 48 types | D04 |
| Traffic Monitor clear action | code search: no UI caller of `DELETE /api/traffic` | E08 |
| Project Settings API / persistence / migration | network trace shows zero settings requests; no server change | E11, C11 |
| Modbus FC/address/frame/retry/timeout/queue semantic changes | `server/src/modbus.ts`, `monitor.ts`, `reliability.ts` unchanged | H01-H13 |
| Workflow runtime/evaluation changes | `server/src/engine.ts`, `runtimeSessions.ts`, `workflowManager.ts` unchanged | G04-G07 |
| WebSocket queue/reconnect/resync/revision changes | `server/src/liveTransport.ts`, `client/src/reconnect.ts` unchanged | H08, G08 |
| Write-safety guard changes (`ALLOW_WRITES`, modes, ownership, write-on-change, read-back) | server guard code unchanged | H09, H10 |
| Writes from Modbus Monitor | monitor remains read-only, FC01-FC04 only | H13 |
| Authentication/authorization | no auth code added | C01 (shell review) |
| Persistence schema change | `server/src/store.ts` and data file shapes unchanged | G02, H07 |
| Release tag or ZIP before final gate | `git tag` list unchanged; no ZIP artifact | J11 |

## 3. Decision trace (owner decisions 2026-09-22)

| Decision | Effect on documents | Effect on implementation |
| --- | --- | --- |
| Version split: v1.2.12 UI/UX only | SCOPE §Version split; ROADMAP v1.3.0 section | No variable blocks, no runtime work |
| Variables deferred to v1.3.0 (not cancelled) | SCOPE §v1.3.0 boundary; ROADMAP keeps v1.3.0 | v1.3.0 planning PR later |
| A. Project Settings baseline truth | SCOPE §10; E11 rewritten; design §10 | UI-only redesign, visible non-persistent notice |
| B. Traffic Monitor has no clear | SCOPE §10; E08 rewritten | No clear button; `DELETE /api/traffic` stays unused |
| C. Visible Undo/Redo/Fit View | SCOPE §3; design §7; new rows D14-D18 | Buttons wired to existing `restoreSnapshot` and React Flow viewport |
| D. Library search optional/non-blocking | SCOPE §5; design §9; D19 classified NB | Not in Milestone 3 unless separately approved |
| E. Design document encoding | design §Encoding note, §2.1 full ASCII token list | Token names copied verbatim into `tokens.css` |
| F. Version bump at first implementation commit | SCOPE §Version timing; J06 | `1.2.12` in root/client/server/lockfile/UI/banner/health from Milestone 1 |
| G. Acceptance classification | ACCEPTANCE legend + `Class` column on every row | Merge/release gating is explicit per row |
| H. v1.2.11 carryover preserved and rerun | SCOPE §Acceptance carryover; ACCEPTANCE §H rewritten (H01-H16) | Milestone 6 executes every available row; unavailable stay `NOT RUN` |

## 4. Expected source file changes by milestone

| Milestone | Expected files |
| --- | --- |
| 1 | `package.json`, `client/package.json`, `server/package.json`, `package-lock.json` (version only); new `client/src/styles/tokens.css`, `client/src/styles/components.css`, `client/src/styles/responsive.css`; `client/src/styles.css` (becomes a thin entry or is replaced by the three files); new `client/src/components/ui/*`; new `client/src/components/shell/*`; `client/src/App.tsx` (shell/status wiring only); `server/src/index.ts` (version string in health + banner only) |
| 2 | new `client/src/components/workflow/CommandBar.tsx`, `client/src/components/ui/Modal.tsx`, `ConfirmDialog.tsx`, `Toast.tsx` (if not landed in M1), `client/src/hooks/useDialogs.ts`; `client/src/App.tsx` (dialog replacement, Undo/Redo/Fit View buttons) |
| 3 | new `client/src/metadata/blocks.ts`, `client/src/components/workflow/BlockLibrary.tsx`, `client/src/components/workflow/BlockNode.tsx`, `client/src/components/workflow/Inspector/*`; `client/src/App.tsx` (duplicate block logic, library/inspector extraction) |
| 4 | new `client/src/components/devices/*`, `client/src/components/monitor/*`, `client/src/components/operational/*`; `client/src/App.tsx` (page extraction) |
| 5 | `client/src/styles/responsive.css`, `client/src/styles/components.css`, affected components |
| 6 | no source change expected (execution and evidence only); `docs/ACCEPTANCE_EVIDENCE/v1.2.12-*.md` |
| 7 | `README.md`, `CHANGELOG.md`, `docs/CURRENT_STATE.md`, `docs/KNOWN_ISSUES.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE_CHECKLIST.md`, acceptance evidence |

Server source files under `server/src/` other than the version strings in `index.ts` are **not
expected to change at all** in v1.2.12. Any need to touch them is a stop-and-report event.

## 5. Planned test additions

| Test | Kind | Proves |
| --- | --- | --- |
| `client/src/metadata/blocks.test.ts` | automated (node env) | Every one of the 48 block types has central EN + TH metadata, title, I/O behavior, and safety note where required (D06, D04) |
| `client/src/duplicateNode.test.ts` | automated (node env) | Pure duplicate-node helper: new ID, copied params, unique `Copy` name, offset position, no edges, dynamic port counts preserved (D07-D10) |
| `client/src/editingControls.test.ts` | automated (node env or DOM env if approved) | Undo/Redo enabled/disabled derivation and parity with `restoreSnapshot`; Fit View produces no node-position mutation (D14-D18) |
| `client/src/styles/tokens.test.ts` | automated (node env) | Token file declares the full required token list; no duplicate or missing token names (B01) |
| `client/src/nativeDialogs.test.ts` | automated (source scan) | No `window.prompt` / `window.confirm` / `window.alert` / bare `alert(` / `confirm(` / `prompt(` remains in `client/src` (C04) |
| Modal focus-trap and restoration | manual browser + recording | C05, C06, C10 |
| Destructive confirm resource naming | manual browser | C07 |
| Connection-state pill across kill/restart of the server | manual browser + recording | C03, G08, H08 |
| Viewport matrix 1024x768 / 1366x768 / 1920x1080 and zoom 90/100/110/125% | manual browser screenshots | F01-F04, D11 |
| Keyboard-only pass and focus visibility | manual browser recording | F05, F06, D05 |
| Contrast measurement of tokens and text pairs | tool-assisted report | F07, B03 |
| Page-by-page functional regression (Devices, Monitor, Runtime, Traffic, Audit, Validation, Settings) | manual browser + API/network trace | E01-E11 |
| CSV export byte-level check (BOM, CRLF, columns) | scripted file inspection | E06, E09 |
| Project Settings network trace showing zero settings requests | manual browser network trace | E11, C11 |
| Simulator/carryover rows H01-H07, H09-H16 | owner environment (simulator, capture, hardware) | carryover decision H |

If DOM-level automated tests are approved (phase plan Q4), `jsdom` plus `@testing-library/react`
become dev-only dependencies and must satisfy I03 with justification, lockfile diff, audit impact,
and coverage before use.
