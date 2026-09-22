/**
 * Overview O1-A scaffold state helpers (pure).
 *
 * The page list is a local editor scaffold only — it is NOT persisted
 * production data. Persistence arrives with checkpoint O1-B.
 */

export type OverviewMode = 'VIEW' | 'EDIT';

/** Save pipeline states required by the Overview product contract. */
export type OverviewSaveState = 'SAVED' | 'UNSAVED' | 'SAVING' | 'ERROR';

export interface OverviewScaffoldPage {
  id: string;
  name: string;
  description: string;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
}

/** Local placeholder page list for O1-A — editor scaffold, never persisted. */
export const OVERVIEW_SCAFFOLD_PAGES: readonly OverviewScaffoldPage[] = [
  {
    id: 'overview-main',
    name: 'Main Overview',
    description: 'Local editor scaffold page — not persisted',
    designWidth: 1920,
    designHeight: 1080,
    backgroundColor: '#050b12',
  },
];

export const OVERVIEW_DEFAULT_PAGE_ID = 'overview-main';

/** Badge text marking the scaffold page list as non-production data. */
export const OVERVIEW_SCAFFOLD_BADGE = 'EDITOR SCAFFOLD · NOT PERSISTED';

/** Default fixed design resolution for new Overview pages. */
export const OVERVIEW_DEFAULT_WIDTH = 1920;
export const OVERVIEW_DEFAULT_HEIGHT = 1080;

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
  }
}

export interface OverviewEditSession {
  mode: OverviewMode;
  saveState: OverviewSaveState;
  /** Baseline snapshot id restored by Cancel Changes. */
  baselinePageId: string;
}

/** View -> Edit: capture the baseline snapshot before editing begins. */
export function beginOverviewEdit(currentPageId: string): OverviewEditSession {
  return { mode: 'EDIT', saveState: 'SAVED', baselinePageId: currentPageId };
}

/** Save & Exit succeeds: draft is flushed (O1-A: client only) and View resumes. */
export function finishOverviewSave(): { mode: OverviewMode; saveState: OverviewSaveState } {
  return { mode: 'VIEW', saveState: 'SAVED' };
}

/** Cancel Changes: restore the baseline snapshot and return to View. */
export function cancelOverviewEdit(baselinePageId: string): OverviewEditSession {
  return { mode: 'VIEW', saveState: 'SAVED', baselinePageId };
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
