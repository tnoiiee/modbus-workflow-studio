/**
 * Overview state helpers (pure) — checkpoints O1-A/O1-B.
 *
 * Drafts stay client-side until Save & Exit. Persistence and revision
 * handling live in `/api/overview-pages`; element editing arrives in O1-C.
 */

export type OverviewMode = 'VIEW' | 'EDIT';

/** Save pipeline states required by the Overview product contract. */
export type OverviewSaveState = 'SAVED' | 'UNSAVED' | 'SAVING' | 'ERROR' | 'CONFLICT';

/** Monitoring element Type IDs (stable identifiers, checklist 7). */
export const OVERVIEW_MONITORING_TYPES: ReadonlySet<string> = new Set([
  'NUMERIC_LABEL',
  'TEXT_LABEL',
  'STATUS_LIGHT',
  'VALUE_BADGE',
  'PICTURE_BOX',
]);

/** Control element Type IDs (stable identifiers, checklist 7). */
export const OVERVIEW_CONTROL_TYPES: ReadonlySet<string> = new Set([
  'SWITCH',
  'PUSH_BUTTON',
  'NAVIGATION_LINK',
]);

export interface OverviewElementStub {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface OverviewPageRecord {
  id: string;
  name: string;
  description: string;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
  backgroundImage: string | null;
  elements: OverviewElementStub[];
  layerOrder: string[];
  revision: number;
  createdAt: string;
  modifiedAt: string;
}

export interface OverviewPageSummary {
  id: string;
  name: string;
  description: string;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
  revision: number;
  elementCount: number;
  createdAt: string;
  modifiedAt: string;
}

/** Default fixed design resolution for new Overview pages. */
export const OVERVIEW_DEFAULT_WIDTH = 1920;
export const OVERVIEW_DEFAULT_HEIGHT = 1080;
/** Matches the `--color-canvas` design token. */
export const OVERVIEW_DEFAULT_BACKGROUND = '#050b12';

/** Label rendered by the save indicator for each save pipeline state. */
export function overviewSaveLabel(state: OverviewSaveState): string {
  switch (state) {
    case 'SAVED':
      return 'SAVED';
    case 'UNSAVED':
      return 'CHANGES PENDING';
    case 'SAVING':
      return 'SAVING…';
    case 'ERROR':
      return 'SAVE FAILED';
    case 'CONFLICT':
      return 'CONFLICT — NOT SAVED';
  }
}

/** True when a local draft exists that Cancel/switch would discard. */
export function isDraftDirty(saveState: OverviewSaveState): boolean {
  return saveState === 'UNSAVED' || saveState === 'ERROR' || saveState === 'CONFLICT';
}

/** Cancel Changes opens the confirm dialog only when a draft must be discarded. */
export function shouldConfirmCancel(saveState: OverviewSaveState): boolean {
  return isDraftDirty(saveState);
}

/** Classify a failed Save & Exit response into a save pipeline state. */
export function classifySaveFailure(status: number): 'CONFLICT' | 'ERROR' {
  return status === 409 ? 'CONFLICT' : 'ERROR';
}

/**
 * Page switching requires the shared ConfirmDialog when the local draft is
 * not cleanly saved. Same-page navigation never confirms.
 */
export function requiresPageSwitchConfirm(
  saveState: OverviewSaveState,
  nextPageId: string,
  currentPageId: string,
): boolean {
  if (nextPageId === currentPageId) return false;
  return saveState !== 'SAVED';
}

/** Command bar group order for the combined Overview Command Bar. */
export function overviewCommandBarGroups(mode: OverviewMode): readonly string[] {
  return mode === 'EDIT'
    ? ['PAGE', 'MODE', 'EDIT ACTIONS', 'SAVE STATUS']
    : ['PAGE', 'MODE', 'SAVE STATUS'];
}

/** SAVE STATUS must remain the logically last group in both modes. */
export function isSaveStatusLastGroup(mode: OverviewMode): boolean {
  const groups = overviewCommandBarGroups(mode);
  return groups[groups.length - 1] === 'SAVE STATUS';
}

/**
 * Workflow Command Bar mounts only on the Workflow page.
 * Every other page (Overview, Devices, monitors, assurance, settings)
 * must not mount the Workflow chrome at all — no CSS hiding.
 */
export function showWorkflowCommandBar(page: string): boolean {
  return page === 'Workflow';
}

/** Overview page shell (and its Overview Command Bar) mounts only on Overview. */
export function showOverviewShell(page: string): boolean {
  return page === 'Overview';
}

/** Highest-priority tooltip while Overview Edit Mode is active. */
export const OVERVIEW_CRUD_EDIT_TOOLTIP = 'Exit Edit Mode to manage pages';

export const OVERVIEW_CRUD_LAST_PAGE_TOOLTIP = 'The last Overview page cannot be deleted';

/**
 * Page CRUD actions are locked while Edit Mode owns the draft:
 * disabled buttons must not open modals, fire keyboard clicks, or call APIs.
 */
export function pageCrudDisabledInMode(mode: OverviewMode): boolean {
  return mode === 'EDIT';
}

export type OverviewCrudAction = 'new' | 'rename' | 'duplicate' | 'delete';

/**
 * Tooltip priority for page CRUD controls:
 * 1. Edit Mode lock (highest)
 * 2. Last-page delete guard
 * 3. Default action label
 */
export function pageCrudTooltip(
  mode: OverviewMode,
  action: OverviewCrudAction,
  canDeletePage: boolean,
): string {
  if (pageCrudDisabledInMode(mode)) return OVERVIEW_CRUD_EDIT_TOOLTIP;
  if (action === 'delete' && !canDeletePage) return OVERVIEW_CRUD_LAST_PAGE_TOOLTIP;
  switch (action) {
    case 'new':
      return 'New Overview page';
    case 'rename':
      return 'Rename Overview page';
    case 'duplicate':
      return 'Duplicate Overview page';
    case 'delete':
      return 'Delete Overview page';
  }
}

/** Read-only revision pill text for the SAVE STATUS group. */
export function overviewRevisionLabel(revision: number): string {
  return `REV ${revision}`;
}

/**
 * Last known persisted revision shown by the indicator.
 * Baseline is only replaced by a successful load/create/rename/save —
 * never by entering/exiting Edit Mode, panel toggles, or a conflict.
 */
export function displayedOverviewRevision(baselineRevision: number | undefined): number {
  return Math.max(1, Math.trunc(baselineRevision ?? 1));
}

/** True when the local draft equals the baseline (Save & Exit is a no-op). */
export function overviewDraftMatchesBaseline(
  baseline: OverviewPageRecord | null,
  draft: OverviewPageRecord | null,
): boolean {
  if (!baseline || !draft) return false;
  return JSON.stringify(draft) === JSON.stringify(baseline);
}

/** Shared Overview-scoped class for every Library/Inspector collapse/expand control. */
export const OVERVIEW_PANEL_TOGGLE_CLASS = 'overview-panel-toggle';

export interface OverviewEditSession {
  mode: OverviewMode;
  saveState: OverviewSaveState;
  baseline: OverviewPageRecord;
  draft: OverviewPageRecord;
}

/** View -> Edit: capture the baseline snapshot and an identical draft. */
export function beginOverviewEdit(page: OverviewPageRecord): OverviewEditSession {
  return {
    mode: 'EDIT',
    saveState: 'SAVED',
    baseline: structuredClone(page),
    draft: structuredClone(page),
  };
}

/**
 * Apply a local edit to the draft and recompute the save state.
 * Pure: returns the next draft plus SAVED/UNSAVED.
 */
export function applyOverviewDraftPatch(
  baseline: OverviewPageRecord,
  draft: OverviewPageRecord,
  patch: Partial<Pick<OverviewPageRecord, 'name' | 'description' | 'designWidth' | 'designHeight' | 'backgroundColor' | 'elements' | 'layerOrder'>>,
): { draft: OverviewPageRecord; saveState: OverviewSaveState } {
  const next: OverviewPageRecord = { ...draft, ...structuredClone(patch) };
  const dirty = JSON.stringify(next) !== JSON.stringify(baseline);
  return { draft: next, saveState: dirty ? 'UNSAVED' : 'SAVED' };
}

/** Save & Exit succeeded: accept the server page, replace baseline, return View. */
export function finishOverviewSave(saved: OverviewPageRecord): {
  mode: OverviewMode;
  saveState: OverviewSaveState;
  baseline: OverviewPageRecord;
  draft: OverviewPageRecord;
} {
  return {
    mode: 'VIEW',
    saveState: 'SAVED',
    baseline: structuredClone(saved),
    draft: structuredClone(saved),
  };
}

/** Cancel Changes: restore the baseline snapshot and return to View. */
export function cancelOverviewEdit(baseline: OverviewPageRecord): {
  mode: OverviewMode;
  saveState: OverviewSaveState;
  draft: OverviewPageRecord;
} {
  return { mode: 'VIEW', saveState: 'SAVED', draft: structuredClone(baseline) };
}

/** Facts shown by the Save Overview Page ConfirmDialog. */
export function buildSaveConfirmDescription(pageName: string): string {
  return `Save changes to "${pageName}" and return to View Mode?`;
}

export function buildSaveConfirmFacts(
  page: { name: string; revision: number; elementCount?: number; elements?: readonly OverviewElementStub[] },
  saveState: OverviewSaveState,
): string[] {
  const elementCount =
    typeof page.elementCount === 'number'
      ? page.elementCount
      : Array.isArray(page.elements)
        ? page.elements.length
        : 0;
  return [
    `Page name: ${page.name}`,
    `Element count: ${elementCount}`,
    `Current revision: ${page.revision}`,
    `Next revision: ${page.revision + 1}`,
    `Unsaved state: ${isDraftDirty(saveState) ? 'Unsaved changes' : 'No unsaved changes'}`,
    'Page will return to View Mode after a successful save',
  ];
}

/** Facts shown by the Delete Overview Page ConfirmDialog. */
export function countOverviewElements(
  elements: readonly OverviewElementStub[],
): { elementCount: number; monitoringCount: number; controlCount: number } {
  let monitoringCount = 0;
  let controlCount = 0;
  for (const element of elements) {
    if (OVERVIEW_MONITORING_TYPES.has(element.type)) monitoringCount += 1;
    else if (OVERVIEW_CONTROL_TYPES.has(element.type)) controlCount += 1;
  }
  return { elementCount: elements.length, monitoringCount, controlCount };
}

export function buildDeleteConfirmFacts(page: {
  name: string;
  elements?: readonly OverviewElementStub[];
  elementCount?: number;
}): string[] {
  const counts = countOverviewElements(page.elements ?? []);
  const elementCount = typeof page.elementCount === 'number' ? page.elementCount : counts.elementCount;
  return [
    `Page name: ${page.name}`,
    `Element count: ${elementCount}`,
    `Monitoring element count: ${counts.monitoringCount}`,
    `Control element count: ${counts.controlCount}`,
    'This cannot be undone',
  ];
}

/** Page name validation: required, trimmed, unique (case-insensitive). */
export function validateOverviewPageName(
  name: string,
  pages: ReadonlyArray<{ id: string; name: string }>,
  ignoreId?: string,
): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'Page name is required';
  if (trimmed.length > 100) return 'Page name must be 100 characters or fewer';
  if (pages.some(page => page.id !== ignoreId && page.name.trim().toLowerCase() === trimmed.toLowerCase())) {
    return 'An Overview page with this name already exists';
  }
  return undefined;
}

/** Design size validation: integers greater than zero. */
export function validateOverviewDimensions(
  width: number,
  height: number,
): string | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 'Design size must be a number';
  if (width <= 0 || height <= 0) return 'Design Width and Design Height must be greater than 0';
  if (!Number.isInteger(width) || !Number.isInteger(height)) return 'Design size must be whole pixels';
  if (width > 16384 || height > 16384) return 'Design size must be 16384 pixels or less';
  return undefined;
}

/** Unique name for Duplicate: "<base>", "<base> 2", "<base> 3", … */
export function uniqueOverviewPageName(
  base: string,
  pages: ReadonlyArray<{ name: string }>,
): string {
  const trimmed = base.trim() || 'Overview Page';
  const taken = new Set(pages.map(page => page.name.trim().toLowerCase()));
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${trimmed} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${trimmed} ${Date.now()}`;
}

/** Session-scoped panel collapse (in-memory only — never server/localStorage). */
let sessionLibraryCollapsed = false;
let sessionInspectorCollapsed = false;

export function getSessionPanelCollapsed(panel: 'library' | 'inspector'): boolean {
  return panel === 'library' ? sessionLibraryCollapsed : sessionInspectorCollapsed;
}

export function setSessionPanelCollapsed(panel: 'library' | 'inspector', collapsed: boolean): void {
  if (panel === 'library') sessionLibraryCollapsed = collapsed;
  else sessionInspectorCollapsed = collapsed;
}

export function toggleOverviewPanel(collapsed: boolean): boolean {
  return !collapsed;
}

/** Reset session panel state (tests). */
export function resetOverviewPanelSession(): void {
  sessionLibraryCollapsed = false;
  sessionInspectorCollapsed = false;
}
