# v1.2.12 Milestone 0 — Frontend Inventory (read-only baseline)

Status: **baseline inventory recorded before any UI edit**.

- Recorded: 2026-09-22
- Repository: `tnoiiee/modbus-workflow-studio`
- Session branch: `arena/01a0c748-modbus-workflow-studio`
- Inspected commit: `efcd15bda9608a6d68cfbf944b1599d50ff65306` (= `origin/main`, merge of PR #2)
- Toolchain used for inspection: Node v22.22.3, npm 10.9.8 (CI runs Node 20)

This document is the factual starting point for the v1.2.12 UI/UX modernization. It records
what exists today so that "behavior-preserving" can be verified instead of assumed. It does not
approve any change by itself.

## 1. Frontend file inventory

| Path | Size | Lines | Note |
| --- | ---: | ---: | --- |
| `client/src/App.tsx` | 92,682 B | 306 | Entire application UI in one file; lines are extremely dense (longest line ≈ 10,021 characters) |
| `client/src/styles.css` | 14,389 B | 103 | Single stylesheet, dense one-line rules, exactly one custom property (`--accent`, set inline per node) |
| `client/src/main.tsx` | 245 B | 1 | Mounts `<App/>`, imports `@xyflow/react/dist/style.css` and `./styles.css` |
| `client/src/reconnect.ts` | 807 B | 25 | `DEFAULT_RECONNECT_POLICY` (250 ms / 30 s / 0.2 jitter) and `reconnectDelay()` |
| `client/src/reconnect.test.ts` | 1,220 B | 26 | 2 tests |
| `client/src/basic.test.ts` | 119 B | 1 | 1 placeholder test |
| `client/src/assets/fonts/*.woff2` | ≈ 2.0 MB | — | Google Sans Regular / Medium / Bold / Italic, bundled and offline-capable |
| `client/index.html` | 254 B | 1 | Title `MODBUS WORKFLOW STUDIO`, no external assets |
| `client/vite.config.ts` | 227 B | 1 | Dev port 5173, proxies `/api` and `/ws` to `http://localhost:8080` (server-side proxy only) |

There is no `client/src/components/`, `hooks/`, `metadata/`, or `styles/` directory yet.

### Top-level units inside `App.tsx`

`api()`, type aliases (`Mode`, `WorkflowSummary`, `AuditEntry`, `MultiInputConfig`, `MonitorItem`,
`MonitorList`, `Page`, `Device`, `WNode`, `WEdge`, `NodeRuntime`), `palette`, `LogicSymbol`,
`StatusLamp`, `LOGIC_SYMBOL_TYPES`, `Block`, `ManualTriggerControl`, `LIB`, `App`, `WNodes`,
`WEdges`, `THAI_PARAM_DESCRIPTIONS`, `ParamDescription`, `Inspector`, `Devices`, `Runtime`,
`ModbusMonitor`, `AuditViewer`, `Table`, `Settings`.

## 2. Pages and navigation

Sidebar (`<aside>`) with 8 pages, icon per page from `lucide-react`, active page via `.active` class:

1. Workflow — library + React Flow canvas + inspector
2. Devices — list, connection settings form, diagnostics
3. Modbus Monitor — lists, items, ranges, read/start/stop, CSV export, diagnostics
4. Runtime Monitor — generic table, polls `/api/runtime` every 1000 ms
5. Traffic Monitor — generic `Table` over the `traffic` state
6. Audit Log — filters, pagination, live/pause, JSON + CSV export, clear, detail pane
7. Validation — findings list, click navigates to Workflow page and selects the node
8. Project Settings — **static mock** (see §7)

Header (`<header>`) holds the page title, the workflow selector, workflow CRUD buttons, the mode
`<select>`, `STOP ALL`, `RUN`/`STOP`, a status dot, the save indicator, and the notice text.

## 3. Native browser dialogs (all must be replaced)

15 call sites, no application modal/toast/inline-validation primitive exists today:

| # | API | Location | Trigger |
| ---: | --- | --- | --- |
| 1 | `window.prompt` | `createWorkflow` | New workflow name |
| 2 | `window.prompt` | `renameWorkflow` | Rename workflow (prefilled with current name) |
| 3 | `window.prompt` | `duplicateWorkflow` | Duplicate workflow as (prefilled `<name> Copy`) |
| 4 | `window.confirm` | `changeInputCount` | Reducing input count removes connections on removed ports |
| 5 | `window.confirm` | `changeMultiInputCount` | Reducing Multi Input sub-inputs removes connections |
| 6 | `window.confirm` | `deleteNodeById` | Delete block (+ attached connection count) |
| 7 | `window.confirm` | `deleteWorkflow` | Delete workflow (nodes/edges/running warning) |
| 8 | `window.confirm` | `stopAllWorkflows` | Stop all running workflows |
| 9 | `window.confirm` | `Devices.removeDevice` | Remove device (+ workflow reference warning) |
| 10 | `window.confirm` | `ModbusMonitor.removeList` | Delete monitor list |
| 11 | `window.confirm` | `AuditViewer.clearAudit` | Clear all audit records |
| 12 | `window.alert` | `ManualTriggerControl` | Manual trigger request failure |
| 13 | `alert` | `Devices` | `TEST TCP` success |
| 14 | `alert` | `Devices` | `TEST TCP` failure |
| 15 | `alert` | `Devices` | `CONNECT` failure |

Feedback today is otherwise limited to: `saved` string (`Saving...`, `Saved`, `Save failed`,
`Pending changes`, `Not saved`, `Conflict, reloading...`, `Changing mode...`) and `notice` string
rendered inside `.mode-error` (red pill, `text-overflow: ellipsis`, also used for connection state).

## 4. Connection state presentation (carryover requirement)

The reconnect mechanism exists and works, but presentation is text-only inside the header notice:

- `Live updates: CONNECTING` on socket creation
- `Live updates: LIVE` on `onopen`
- `Live updates: RECONNECTING (<delay> ms)` and `Live updates: OFFLINE · retrying (<delay> ms)` from attempt ≥ 5
- error strings such as `Live resync failed: <message>`

There is no dedicated `LIVE` / `RECONNECTING` / `OFFLINE` status pill, icon, or `aria-live` region.
WebSocket URL is derived from `location.host` (`ws`/`wss`), duplicate-socket guarded, and `resync`
is requested on open; `resync-required` triggers a REST reload. Handled message types: `hello`,
`workflow`, `workflow-list`, `workflow-state`, `devices`, `runtime`, `traffic`, `audit`, `monitor`,
`resync-required`.

## 5. Workflow editor inventory

- React Flow custom node types: **one** — `nodeTypes = { block: Block }`
- Dynamic ports: `inputCount` / `outputCount` per node, `useUpdateNodeInternals` refreshed on
  `requestAnimationFrame` when counts change; node height computed from type and port counts
- `MODBUS_MULTI_INPUT` renders 1–8 sub-input rows with per-row live value/quality
- Node zones today: delete quick action (absolute top-right), `block-head` (logic symbol + type +
  name), value area, runtime line, footer, absolutely positioned port labels
- Node quick actions: **delete only** — a `.node-delete` button dispatching the window event
  `mws:delete-node`; no duplicate action exists
- Edge/node selection through `onNodeClick` / `onEdgeClick` / `onPaneClick`
- Position persistence on `onNodeDragStop`
- Keyboard: `Delete`/`Backspace` removes the selection, `Ctrl|Cmd+Z` undo, `Ctrl|Cmd+Shift+Z` and
  `Ctrl|Cmd+Y` redo, `Escape` deselects; input/textarea/select/contentEditable are excluded
- Undo/Redo implementation: `undoHistoryRef` / `redoHistoryRef` snapshot stacks + `restoreSnapshot()`
- **No Undo, Redo, or Fit View buttons exist**; Fit View is reachable only through the React Flow
  `<Controls/>` widget; `fitView`, `snapToGrid`, `snapGrid=[16,16]`, `Background`, `MiniMap` are on.
  *Owner decision C (2026-09-22): visible Undo, Redo, and Fit View controls are added to the v1.2.12
  scope on top of the existing logic only — keyboard shortcuts, history semantics, and React Flow
  state ownership are preserved, and Fit View must not mutate persisted node positions. Acceptance
  rows v1.2.12-D14 to D18 cover enabled/disabled states and button/shortcut parity.*
- Auto-save: debounced `persist()` with per-workflow promise chaining, revision conflict detection
  and reload, `parameterSaveTimerRef` (500 ms) for inspector edits

### Block Library (`LIB`) — 6 categories, 48 block types

| Category | Count | Types |
| --- | ---: | --- |
| Modbus | 3 | `MODBUS_INPUT`, `MODBUS_MULTI_INPUT`, `MODBUS_OUTPUT` |
| Boolean Logic | 10 | `AND`, `OR`, `XOR`, `NAND`, `NOR`, `NOT`, `SR_LATCH`, `RS_LATCH`, `RISING_EDGE`, `FALLING_EDGE` |
| Compare | 8 | `EQUAL`, `NOT_EQUAL`, `GREATER_THAN`, `GREATER_EQUAL`, `LESS_THAN`, `LESS_EQUAL`, `IN_RANGE`, `OUT_OF_RANGE` |
| Math | 12 | `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `MINIMUM`, `MAXIMUM`, `AVERAGE`, `ABSOLUTE`, `CLAMP`, `LINEAR_MAPPING`, `SCALE`, `OFFSET` |
| Timer | 6 | `TON`, `TOF`, `PULSE`, `DEBOUNCE`, `MIN_ON_TIME`, `MIN_OFF_TIME` |
| Utility | 9 | `BOOLEAN_CONSTANT`, `NUMERIC_CONSTANT`, `SELECTOR`, `MANUAL_TRIGGER`, `MEMORY`, `DATA_CONVERTER`, `BIT_EXTRACT`, `BIT_COMBINE`, `RATE_LIMITER` |

Rendered as `<details open>` + `<summary>` with one plain button per type
(`addBlock(type)` → `crypto.randomUUID()`, `counts(type)`, `defaultParams(type)`, random position
in a 350×350 area). No icons, no descriptions, no search/filter, no disabled state, no
drag-to-canvas.

### Parameters inspector

- Headings: `PARAMETERS` (node), `CONNECTION` (edge), empty state `Select a block or connection`
- Field helpers: `textField`, `numberField`, `selectField`; 16 `node.type ===` branches
- `ParamDescription` renders an English line plus a Thai line; Thai text comes from
  `THAI_PARAM_DESCRIPTIONS` (60 entries) with a generic fallback string
- Only 16 `<ParamDescription>` usages exist, i.e. most fields have an English `description`
  argument but no block-level explanation, and there is **no per-block-title / purpose / safety
  metadata block** today
- Block Name field is rendered below the parameter fields; the requested v1.2.12 order is
  metadata → `PARAMETERS` → Block Name
- Actions: `DELETE BLOCK` only (no Duplicate)

## 6. Client → server surface used by the UI

29 fetch call sites in `App.tsx` against these routes (server exposes 45 routes in total):

- Workflows: `GET/POST /api/workflows`, `GET/PUT /api/workflows/:id`,
  `POST /api/workflows/:id/activate|rename|duplicate|mode|run|stop`,
  `DELETE /api/workflows/:id`, `GET /api/workflows/:id/runtime`,
  `POST /api/workflows/:id/runtime/nodes/:nodeId/manual-trigger`
- Devices: `GET/POST /api/devices`, `PUT/DELETE /api/devices/:id`,
  `POST /api/devices/test`, `POST /api/devices/:id/connect|disconnect`
- Monitor: `GET/POST /api/monitor-lists`, `PUT/DELETE /api/monitor-lists/:id`,
  `POST /api/monitor-lists/:id/read|start|stop`
- Runtime/traffic/audit/validation: `GET /api/runtime`, `POST /api/runtime/stop-all`,
  `GET /api/traffic`, `GET/DELETE /api/audit`, `GET /api/validation`
- Not used by the UI today: `GET/PUT /api/workflow` (legacy active-workflow document, also carries
  `settings`), `GET /api/runtime/nodes/:id`, `GET /api/runtime/summary`,
  `GET /api/workflows/:id/runtime/nodes/:nodeId`, `POST /api/nodes/:id/write`,
  `DELETE /api/traffic`, `GET /api/health`, and the `410 Gone` legacy
  `POST /api/workflow/mode|run|stop`

`api()` wrapper: 10 s `AbortController` timeout, JSON content type, non-2xx throws with the server
`error` message. All URLs are relative — no hard-coded browser host.

## 7. Known presentation gaps found during inventory

1. **Project Settings is a non-functional mock.** Nine labels rendered from a string array with
   `defaultValue` (only `Project Name` prefilled), one `defaultChecked` checkbox
   (`Require Live Armed confirmation`), and a `SAVE SETTINGS` button with **no handler and no API
   call**. Nothing loads and nothing persists. `PUT /api/workflow` accepts a `settings` object, but
   the UI never calls it.
   *Owner decision A (2026-09-22): this is the accepted baseline. v1.2.12 redesigns the page
   UI-only, preserves the displayed fields/defaults, adds no settings API, no persistence schema,
   migration, or backend storage, shows no false successful-save state, and clearly communicates the
   non-persistent behavior. Acceptance row v1.2.12-E11 was rewritten to match.*
2. **Traffic Monitor has no clear action** in the UI even though `DELETE /api/traffic` exists.
   *Owner decision B (2026-09-22): the absence of Traffic Clear is the accepted baseline and adding
   a Clear button is not approved for v1.2.12. Acceptance row v1.2.12-E08 was corrected to drop the
   "clear behavior" criterion; existing events, ordering, columns, values, timestamps, filters,
   links, and display behavior must be preserved.*
3. **Runtime Monitor** uses the generic `Table` (first 10 keys of the first row become columns) and
   polls every second regardless of page visibility.
4. **Devices form is generated from `Object.entries(form)`**, so labels are raw field names
   (`defaultUnitId`, `interRequestDelay`, …), every field is always editable (including `id`),
   `enabled` is edited as a text input compared against the string `'true'`, and diagnostics are a
   raw `JSON.stringify` `<pre>` block.
5. **No shared UI primitives**: buttons, inputs, selects, tables, panels, badges, empty states are
   styled by element selectors and a handful of classes; there is no modal, toast, tooltip,
   focus-trap, or `aria-live` implementation.
6. **Design tokens are absent**: colors are literal hex values repeated across `styles.css` and
   `App.tsx` (`palette`, inline `--accent`), spacing/radius/shadow are literals.
7. **Accessibility gaps**: icon-only buttons rely on `title` (no accessible name in several cases),
   severity/state is partly color-only (`.dot`, `.status-lamp`, `.good`), no visible focus ring
   definition beyond browser default, no `prefers-reduced-motion` block, tables use
   `white-space: nowrap` with horizontal scroll, no skip link, sidebar buttons are not a
   `nav`/`aria-current` structure.
8. **Responsive breakpoints** are `max-width: 1200px`, `1100px`, and `760px`; at ≤ 1200 px the
   inspector becomes an absolutely positioned overlay. There is no 1024 px tablet-landscape
   breakpoint, which is the v1.2.12 minimum planning target.

## 8. Automated test inventory

| Suite | Files | Tests | Coverage |
| --- | ---: | ---: | --- |
| server (`vitest`) | 3 | 13 | Modbus codec, Boolean output polarity, logic engine, workflow validation, bounded live transport queue, reliability defaults, device monitor queue, monitor scheduler |
| client (`vitest`) | 2 | 3 | reconnect backoff bounds (2), placeholder baseline (1) |

There is no DOM environment (`jsdom`), no `@testing-library/*`, and therefore no component,
focus-management, or interaction test capability in the repository today.

## 9. Dependency and audit snapshot (2026-09-22)

Client runtime: `react` 18.3.1, `react-dom` 18.3.1, `@xyflow/react` 12.4.2, `lucide-react` 0.468.0,
`zod` 3.24.1, `@vitejs/plugin-react` 4.3.4. Client dev: `vite` 6.0.5, `vitest` 2.1.8,
`typescript` 5.7.2. Server runtime: `express` 4.21.2, `ws` 8.18.0, `cors` 2.8.5, `dotenv` 16.4.7,
`zod` 3.24.1.

`npm audit` reproduced the handoff snapshot exactly:

- Full graph: 5 moderate, 1 high, 1 critical (7 total). Critical = `vitest`
  (GHSA-5xrq-8626-4rwp, dev-only, requires a major upgrade to vitest 5); high = `vite`
  (GHSA-fx2h-pf6j-xcff, dev-only); moderate = `@vitest/mocker`, `esbuild`, `vite-node`, `express`,
  `qs`.
- Production-only (`npm audit --omit=dev`): 2 moderate — `express` (direct) and `qs` (transitive
  through express). Both report a non-major fix available.
- No `npm audit fix` or `npm audit fix --force` was run.

## 10. Version strings that must stay synchronized

`1.2.11` currently appears in: root/client/server `package.json`, server health payload
(`GET /api/health` → `version`), server startup banner, client sidebar text (`v1.2.11 · LOCAL/LAN`),
`README.md`, `CHANGELOG.md`, `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`,
`docs/KNOWN_ISSUES.md`, and the acceptance/evidence documents.

## 11. Protected behavior mapping

Every item below is implemented in `server/src/*` and/or the React Flow wiring in `App.tsx` and is
mapped to a v1.2.12 acceptance row in [ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md):
React Flow node/edge/dynamic-port semantics, workflow CRUD + revision + save/reload + Undo/Redo,
workflow runtime evaluation and concurrent isolation, REST/WebSocket paths and authoritative
resync, Modbus FC/address/frame semantics, monitor single-flight/pending/generation/cancellation/
queue policy, `ALLOW_WRITES` + modes + ownership + priority writes + write-on-change + read-back,
read-only Modbus Monitor, and persistence schema/runtime restoration.
