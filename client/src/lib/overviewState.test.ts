import { describe, expect, it } from 'vitest';

import {
  OVERVIEW_DEFAULT_HEIGHT,
  OVERVIEW_DEFAULT_PAGE_ID,
  OVERVIEW_DEFAULT_WIDTH,
  OVERVIEW_SCAFFOLD_PAGES,
  beginOverviewEdit,
  cancelOverviewEdit,
  finishOverviewSave,
  overviewSaveLabel,
  requiresPageSwitchConfirm,
} from './overviewState.js';

describe('overview O1-A scaffold', () => {
  it('exposes a single local placeholder page at 1920 x 1080', () => {
    expect(OVERVIEW_SCAFFOLD_PAGES).toHaveLength(1);
    const page = OVERVIEW_SCAFFOLD_PAGES[0]!;
    expect(page.id).toBe(OVERVIEW_DEFAULT_PAGE_ID);
    expect(page.name).toBe('Main Overview');
    expect(page.designWidth).toBe(OVERVIEW_DEFAULT_WIDTH);
    expect(page.designHeight).toBe(OVERVIEW_DEFAULT_HEIGHT);
    expect(OVERVIEW_DEFAULT_WIDTH).toBe(1920);
    expect(OVERVIEW_DEFAULT_HEIGHT).toBe(1080);
  });

  it('uses unique scaffold page ids', () => {
    const ids = OVERVIEW_SCAFFOLD_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('overview save pipeline labels', () => {
  it('maps every save state to a non-empty label', () => {
    expect(overviewSaveLabel('SAVED')).toBe('SAVED');
    expect(overviewSaveLabel('UNSAVED')).toBe('CHANGES PENDING');
    expect(overviewSaveLabel('SAVING')).toBe('SAVING…');
    expect(overviewSaveLabel('ERROR')).toBe('SAVE FAILED');
  });

  it('never reuses "saved" wording for the unsaved state', () => {
    expect(overviewSaveLabel('UNSAVED').toLowerCase()).not.toContain('saved');
  });
});

describe('overview view/edit transitions', () => {
  it('enters edit mode with a baseline snapshot and SAVED state', () => {
    const session = beginOverviewEdit('overview-main');
    expect(session).toEqual({ mode: 'EDIT', saveState: 'SAVED', baselinePageId: 'overview-main' });
  });

  it('returns to view with SAVED after a successful save & exit', () => {
    expect(finishOverviewSave()).toEqual({ mode: 'VIEW', saveState: 'SAVED' });
  });

  it('restores the baseline page on cancel', () => {
    const session = beginOverviewEdit('overview-main');
    const cancelled = cancelOverviewEdit(session.baselinePageId);
    expect(cancelled.mode).toBe('VIEW');
    expect(cancelled.saveState).toBe('SAVED');
    expect(cancelled.baselinePageId).toBe('overview-main');
  });
});

describe('page switch confirmation', () => {
  it('confirms when the draft is not cleanly saved', () => {
    expect(requiresPageSwitchConfirm('UNSAVED', 'other', 'overview-main')).toBe(true);
    expect(requiresPageSwitchConfirm('SAVING', 'other', 'overview-main')).toBe(true);
    expect(requiresPageSwitchConfirm('ERROR', 'other', 'overview-main')).toBe(true);
  });

  it('skips confirmation for a clean draft or the same page', () => {
    expect(requiresPageSwitchConfirm('SAVED', 'other', 'overview-main')).toBe(false);
    expect(requiresPageSwitchConfirm('UNSAVED', 'overview-main', 'overview-main')).toBe(false);
  });
});
