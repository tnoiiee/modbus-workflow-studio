# v1.2.12 UI Design System Contract

Status: **approved direction (owner handoff 2026-09-22, confirmed with edits A-H on 2026-09-22).
Final token values must be contrast-tested before acceptance.**

Encoding: this file is UTF-8 without BOM. All CSS custom property names below are written out in
full ASCII form so they can be copied into source without transformation. No escaped, shortened, or
ellipsis-compressed token names are used.

This is the visual, layout, interaction, and accessibility contract for the v1.2.12 UI/UX
modernization. It is binding for implementation review: a change that contradicts this document
requires a new owner decision, not an in-PR compromise.

## 1. Design intent

The product must look like modern industrial operations software with restrained cyberpunk
character - not a neon demo, not a generic pile of generated cards.

Principles:

1. Operational clarity before decoration
2. Consistent hierarchy and density
3. Safety actions visually distinct from routine actions
4. Glass only where depth or context benefits the operator
5. State conveyed by text and icon as well as color
6. Motion explains change; it does not decorate every interaction

## 2. Tokens

All color, spacing, radius, elevation, border, focus, state, and motion values must be CSS custom
properties defined once and consumed everywhere. Literal hex values inside component styles are a
review defect.

Starting direction (to be contrast-verified):

| Role | Direction |
| --- | --- |
| canvas | near-black navy |
| elevated surface | blue/slate with controlled transparency |
| solid fallback surface | opaque equivalent for reduced transparency or unsupported blur |
| primary accent | cyan |
| secondary accent | restrained violet |
| success | emerald |
| warning | amber |
| danger | coral/red |
| primary text | cool near-white |
| secondary text | desaturated blue-gray |
| borders | low-contrast blue-gray, stronger on focus/selection |

### 2.1 Required token names (complete list, ASCII)

```css
/* color - surfaces */
--color-canvas
--color-surface-1
--color-surface-2
--color-surface-glass
--color-surface-solid-fallback

/* color - lines */
--color-border
--color-border-strong

/* color - text */
--color-text
--color-text-muted

/* color - semantic */
--color-accent
--color-accent-secondary
--color-success
--color-warning
--color-danger

/* focus */
--focus-ring

/* spacing scale (8 steps, each declared explicitly) */
--space-1
--space-2
--space-3
--space-4
--space-5
--space-6
--space-7
--space-8

/* radius */
--radius-sm
--radius-md
--radius-lg

/* elevation */
--shadow-sm
--shadow-md
--shadow-panel

/* motion */
--motion-fast
--motion-normal
```

Additional tokens may be added during implementation, but only in the same naming style and only in
`client/src/styles/tokens.css`.

### 2.2 Block accent palette

The existing per-block-type accent semantics stay meaningful and must be re-expressed as tokens so
node borders, library icons, and status colors remain consistent:

| Existing literal | Meaning | Token direction |
| --- | --- | --- |
| `#15a9e8` | Modbus input / multi input | `--block-accent-modbus-read` |
| `#f58b23` | Modbus output (write path) | `--block-accent-modbus-write` |
| `#25b46b` | Timer family | `--block-accent-timer` |
| `#8795a1` | Constant family | `--block-accent-constant` |
| `#9b6de3` | Logic / compare / math / utility fallback | `--block-accent-logic` |

## 3. Typography

- Keep the bundled Google Sans faces and the existing Thai fallback chain
  (`"Google Sans", "Noto Sans Thai", "Leelawadee UI", "Segoe UI", Arial, sans-serif`); offline
  operation is mandatory and no web font may be fetched at runtime.
- Thai block descriptions are first-class content. If system Thai fallback renders inconsistently on
  the target displays, bundling a Thai face becomes an asset decision that requires owner approval
  (see phase plan Q3).
- Define explicit styles for: display, page title, section title, body, field label, metadata,
  numeric, and status text.
- Avoid all-uppercase body text; reserve uppercase for compact operational labels
  (`LIVE`, `STOP ALL`, `FC01`, severity tags).
- Use tabular numerals (`font-variant-numeric: tabular-nums`) for addresses, timing, counters, and
  live numeric values.
- Long names must truncate with an accessible full-name affordance (visible truncated label plus a
  programmatic name), never overlap.

## 4. Glass usage

Appropriate: top command bar, modal surface, floating status/inspector shell, selected or
high-priority contextual layer.

Avoid: every table row, every small button, deeply nested glass-on-glass cards, strong blur behind
dense operational text, glow around normal body text.

Every glass surface needs an opaque fallback (`--color-surface-solid-fallback`) so content stays
readable when `backdrop-filter` is unavailable or transparency is reduced.

## 5. Required shared primitives

Minimum set, all keyboard operable with visible focus:

- `Button` (primary, secondary, ghost, danger) with hover, focus, disabled, and pending states
- `IconButton` with accessible name and tooltip
- `Input`, `NumberInput`, `Select`, `Switch`/`Checkbox`, `Textarea`
- `Field`, `HelpText`, `ErrorText`
- `Badge` / `StatusPill` (text plus icon plus color)
- `Panel` / `Card`
- `Modal`, `ConfirmDialog` (including destructive variant)
- `Toast` / notification region with a polite `aria-live` assertion region and an assertive region
  for errors
- `Tabs` where appropriate
- `DataTable` shell (header, empty, loading, error states)
- `EmptyState`, `LoadingState`, `ErrorState`
- `CommandGroup` and command separators for the segmented command bar

## 6. Modal contract

- Accessible name and description (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`,
  `aria-describedby`)
- Initial focus chosen deliberately (first field for forms, cancel for destructive confirms)
- Focus stays inside while open and returns to the trigger on close
- Submit disabled while invalid or pending; pending state is visible and cannot double-fire
- Destructive dialogs name the affected resource and the consequence
- `Escape` and backdrop close are disabled while a destructive submission is pending
- While a modal is open, canvas keyboard shortcuts (`Delete`, `Backspace`, `Ctrl/Cmd+Z`,
  `Ctrl/Cmd+Y`, `Escape` deselect) must be suppressed so a dialog cannot trigger an editor mutation
- No `window.prompt`, `window.confirm`, or `window.alert` remains anywhere in the application

## 7. Workflow command bar hierarchy

Four visibly separated groups, in this order:

1. **Workflow management** - selector, Add, Rename, Duplicate, Delete
2. **Editing** - Undo, Redo, Fit View, save/revision status
3. **Mode and safety** - `DESIGN`, `SIMULATION`, `LIVE_LOCKED`, `LIVE_ARMED` plus relevant warnings
   (including the `ALLOW_WRITES=false` block on `LIVE_ARMED`)
4. **Runtime** - Run, Stop, and a separately emphasized `Stop All` danger action

Rules:

- Separation must be achieved with spacing, labels, surfaces, or dividers. `Stop All` must never
  visually merge with `Run` or with workflow CRUD.
- The bar must remain usable with long workflow names (truncate the label, never clip controls).
- **Editing controls are visible buttons**, not keyboard-only: Undo, Redo, and Fit View must be
  rendered with accessible names, tooltips, and correct enabled/disabled state derived from the
  existing history stacks and React Flow instance.
- Undo/Redo buttons call the existing snapshot history logic; they must not introduce a second
  history model. Existing shortcuts stay active and must produce identical results (parity).
- Fit View only changes the viewport transform. It must not mutate or persist node positions and
  must not create a save/revision side effect.
- Connection state (`LIVE`, `RECONNECTING`, `OFFLINE`) is presented as a dedicated status pill with
  text plus icon, separate from the save/revision indicator and separate from error notices.

## 8. React Flow node contract

Zones, in order:

1. Header - type icon and quick actions
2. Identity - node name
3. Primary value / status
4. Optional metadata / error
5. Ports and port labels in dedicated edge-safe areas

Requirements:

- Quick actions cannot overlap handles; keep them inside a reserved header action zone
- Quick actions are Duplicate and Delete, each with a tooltip and accessible name
- Long labels truncate rather than collide
- Selected, focused, running, and error states remain distinguishable without color alone
- Dynamic port counts remain exact (`MODBUS_MULTI_INPUT` 1-8 sub-inputs, `inputCount` 2-16)
- Live values, status lamps, animated flow, logic symbols, and Manual Trigger controls are preserved
- Readable at 90%, 100%, 110%, and 125% browser zoom

## 9. Block Library

- Categorized, collapsible interactive cards: icon, block title, concise purpose
- Accessible hover, active, focus, and disabled states; category disclosure operable by keyboard
- All 48 existing block types appear exactly once, and adding a block keeps the existing behavior
- **Search/filter is an optional enhancement and non-blocking.** It is not mandatory scope and not a
  release gate. If implemented, it must be purely client-side, must not change add behavior, and
  must not become a dependency of any acceptance row.

## 10. Non-persistent surfaces

Project Settings has no settings API and no persistence in v1.2.12 (owner decision A). The design
must therefore:

- preserve the existing displayed fields and defaults
- never present a successful-save state (no "Saved" toast, no saved indicator, no persisted badge)
- clearly and permanently communicate that changes are not stored, using a visible notice in the
  page and an explicit description on the save control
- keep the safety notice about no authentication and `ALLOW_WRITES`

The same honesty rule applies to any other surface that cannot persist: the UI must not imply a
state change that the backend does not perform.

## 11. Responsive behavior

Desktop (1366x768 up to large displays): persistent navigation, segmented command bar, canvas plus
library and inspector arrangement.

Tablet landscape (about 1024 px and above): navigation may compact, command groups may wrap or move
into an overflow menu **without hiding safety state**, library/inspector may become drawers or
resizable panels, canvas remains the primary surface.

Mobile-portrait workflow editing is out of scope. No dialog may be clipped at 1024x768.

## 12. Accessibility checks

- WCAG AA contrast for text and actionable controls; disabled state remains distinguishable
- Keyboard access to every action; logical tab order
- Visible focus ring on every surface and state
- Icons have accessible names/tooltips
- Status is never conveyed by color alone
- `prefers-reduced-motion` disables non-essential animation
- Zoom verified at 90%, 100%, 110%, 125%

## 13. Anti-patterns (reject in review)

Excessive gradients or glow; a card around every text group; inconsistent radius or spacing; hidden
safety state; icon-only destructive actions without accessible labels; modal forms without
validation; controls whose position changes unpredictably between pages; dense tables with
low-contrast text; any visual change that silently alters behavior; any UI that reports success for
an operation the backend did not perform.
