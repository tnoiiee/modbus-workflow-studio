# v1.2.12 UI Design System Contract

Status: **approved direction from the owner handoff; final token values must be contrast-tested
before acceptance**.

This is the visual, layout, interaction, and accessibility contract for the v1.2.12 UI/UX
modernization. It is binding for implementation review: a change that contradicts this document
requires a new owner decision, not an in-PR compromise.

## 1. Design intent

The product must look like modern industrial operations software with restrained cyberpunk
character — not a neon demo, not a generic pile of generated cards.

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
| solid fallback surface | opaque equivalent for reduced transparency / unsupported blur |
| primary accent | cyan |
| secondary accent | restrained violet |
| success | emerald |
| warning | amber |
| danger | coral/red |
| primary text | cool near-white |
| secondary text | desaturated blue-gray |
| borders | low-contrast blue-gray, stronger on focus/selection |

Required token groups:

```text
--color-canvas, --color-surface-1, --color-surface-2, --color-surface-glass
--color-border, --color-border-strong
--color-text, --color-text-muted
--color-accent, --color-accent-secondary
--color-success, --color-warning, --color-danger
--focus-ring
--space-1 … --space-8
--radius-sm, --radius-md, --radius-lg
--shadow-sm, --shadow-md, --shadow-panel
--motion-fast, --motion-normal
```

The existing per-block-type accent palette (`MODBUS_INPUT` cyan, `MODBUS_OUTPUT` orange, timer
green, constant gray, logic violet) stays semantically meaningful but must be re-expressed as
tokens so node borders, library icons, and status colors remain consistent.

## 3. Typography

- Keep the bundled Google Sans faces and the existing Thai fallback chain
  (`"Google Sans","Noto Sans Thai","Leelawadee UI","Segoe UI",Arial,sans-serif`); offline operation
  is mandatory and no web font may be fetched at runtime.
- Define explicit styles for: display, page title, section title, body, field label, metadata,
  numeric, and status text.
- Avoid all-uppercase body text; reserve uppercase for compact operational labels
  (`LIVE`, `STOP ALL`, `FC01`, severity tags).
- Use tabular numerals (`font-variant-numeric: tabular-nums`) for addresses, timing, counters, and
  live numeric values.
- Long names must truncate with an accessible full-name affordance (`title` plus a visible
  truncated label, never overlap).

## 4. Glass usage

Appropriate: top command bar, modal surface, floating status/inspector shell, selected or
high-priority contextual layer.

Avoid: every table row, every small button, deeply nested glass-on-glass cards, strong blur behind
dense operational text, glow around normal body text.

Every glass surface needs an opaque fallback so content stays readable when
`backdrop-filter` is unavailable or transparency is reduced.

## 5. Required shared primitives

Minimum set, all keyboard operable with visible focus:

- `Button` (primary, secondary, ghost, danger) with hover/focus/disabled/pending states
- `IconButton` with accessible name and tooltip
- `Input`, `NumberInput`, `Select`, `Checkbox`/`Switch`, `Textarea`
- `Field`, `HelpText`, `ErrorText`
- `Badge` / `StatusPill` (text + icon + color)
- `Panel` / `Card`
- `Modal`, `ConfirmDialog` (including destructive variant)
- `Toast` / notification region with `aria-live`
- `Tabs` where appropriate
- `DataTable` shell (header, sticky columns where needed, empty/loading/error states)
- `EmptyState`, `LoadingState`, `ErrorState`
- `CommandGroup` and command separators for the segmented command bar

## 6. Modal contract

- Accessible name and description (`role="dialog"`, `aria-modal`, `aria-labelledby`,
  `aria-describedby`)
- Initial focus chosen deliberately (first field for forms, cancel for destructive confirms)
- Focus stays inside while open and returns to the trigger on close
- Submit disabled while invalid or pending; pending state is visible and cannot double-fire
- Destructive dialogs name the affected resource and the consequence
- `Escape` and backdrop close are disabled while a destructive submission is pending
- No `window.prompt`, `window.confirm`, or `window.alert` remains anywhere in the application

## 7. Workflow command bar hierarchy

Four visibly separated groups, in this order:

1. **Workflow management** — selector, Add, Rename, Duplicate, Delete
2. **Editing** — Undo, Redo, Fit View, save/revision status
3. **Mode and safety** — `DESIGN`, `SIMULATION`, `LIVE_LOCKED`, `LIVE_ARMED` plus relevant warnings
   (including the `ALLOW_WRITES=false` block on `LIVE_ARMED`)
4. **Runtime** — Run, Stop, and a separately emphasized `Stop All` danger action

Separation must be achieved with spacing, labels, surfaces, or dividers. `Stop All` must never
visually merge with `Run` or with workflow CRUD. The bar must remain usable with long workflow
names (truncate, do not clip controls).

## 8. React Flow node contract

Zones, in order:

1. Header — type icon and quick actions
2. Identity — node name
3. Primary value / status
4. Optional metadata / error
5. Ports and port labels in dedicated edge-safe areas

Requirements:

- Quick actions cannot overlap handles; keep them inside a reserved header action zone
- Long labels truncate rather than collide
- Selected, focused, running, and error states remain distinguishable without color alone
- Duplicate and Delete buttons have tooltips and accessible names
- Dynamic port counts remain exact (`MODBUS_MULTI_INPUT` 1–8 sub-inputs, `inputCount` 2–16)
- Live values, status lamps, animated flow, logic symbols, and Manual Trigger controls are preserved
- Readable at 90%, 100%, 110%, and 125% browser zoom

## 9. Responsive behavior

Desktop (1366×768 → large displays): persistent navigation, segmented command bar, canvas plus
library and inspector arrangement.

Tablet landscape (≈1024 px and above): navigation may compact, command groups may wrap or move into
an overflow menu **without hiding safety state**, library/inspector may become drawers or resizable
panels, canvas remains the primary surface.

Mobile-portrait workflow editing is out of scope. No dialog may be clipped at 1024×768.

## 10. Accessibility checks

- WCAG AA contrast for text and actionable controls; disabled state remains distinguishable
- Keyboard access to every action; logical tab order
- Visible focus ring on every surface and state
- Icons have accessible names/tooltips
- Status is never conveyed by color alone
- `prefers-reduced-motion` disables non-essential animation
- Zoom verified at 90%, 100%, 110%, 125%

## 11. Anti-patterns (reject in review)

Excessive gradients or glow · a card around every text group · inconsistent radius/spacing ·
hidden safety state · icon-only destructive actions without accessible labels · modal forms without
validation · controls whose position changes unpredictably between pages · dense tables with
low-contrast text · any visual change that silently alters behavior.
