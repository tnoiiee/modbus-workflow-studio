import { beforeEach, describe, expect, it } from 'vitest';

import {
  OVERVIEW_DEFAULT_BACKGROUND,
  OVERVIEW_DEFAULT_HEIGHT,
  OVERVIEW_DEFAULT_WIDTH,
  applyOverviewDraftPatch,
  beginOverviewEdit,
  buildDeleteConfirmFacts,
  buildSaveConfirmDescription,
  buildSaveConfirmFacts,
  cancelOverviewEdit,
  classifySaveFailure,
  countOverviewElements,
  finishOverviewSave,
  getSessionPanelCollapsed,
  isDraftDirty,
  overviewCommandBarGroups,
  overviewSaveLabel,
  requiresPageSwitchConfirm,
  resetOverviewPanelSession,
  setSessionPanelCollapsed,
  shouldConfirmCancel,
  toggleOverviewPanel,
  uniqueOverviewPageName,
  validateOverviewDimensions,
  validateOverviewPageName,
  type OverviewPageRecord,
  type OverviewSaveState,
} from './overviewState.js';

function makePage(overrides: Partial<OverviewPageRecord> = {}): OverviewPageRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Main Overview',
    description: '',
    designWidth: OVERVIEW_DEFAULT_WIDTH,
    designHeight: OVERVIEW_DEFAULT_HEIGHT,
    backgroundColor: OVERVIEW_DEFAULT_BACKGROUND,
    backgroundImage: null,
    elements: [],
    layerOrder: [],
    revision: 1,
    createdAt: '2026-09-23T00:00:00.000Z',
    modifiedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetOverviewPanelSession();
});

describe('overview defaults', () => {
  it('uses 1920 x 1080 and the canvas background token', () => {
    expect(OVERVIEW_DEFAULT_WIDTH).toBe(1920);
    expect(OVERVIEW_DEFAULT_HEIGHT).toBe(1080);
    expect(OVERVIEW_DEFAULT_BACKGROUND).toBe('#050b12');
  });
});

describe('combined command bar group order', () => {
  it('lists PAGE, MODE, SAVE STATUS in View Mode', () => {
    expect(overviewCommandBarGroups('VIEW')).toEqual(['PAGE', 'MODE', 'SAVE STATUS']);
  });

  it('inserts EDIT ACTIONS between MODE and SAVE STATUS in Edit Mode', () => {
    expect(overviewCommandBarGroups('EDIT')).toEqual(['PAGE', 'MODE', 'EDIT ACTIONS', 'SAVE STATUS']);
  });
});

describe('save pipeline labels and states', () => {
  it('maps every save state to a non-empty label', () => {
    expect(overviewSaveLabel('SAVED')).toBe('SAVED');
    expect(overviewSaveLabel('UNSAVED')).toBe('CHANGES PENDING');
    expect(overviewSaveLabel('SAVING')).toBe('SAVING…');
    expect(overviewSaveLabel('ERROR')).toBe('SAVE FAILED');
    expect(overviewSaveLabel('CONFLICT')).toBe('CONFLICT — NOT SAVED');
  });

  it('never reuses "saved" alone for dirty or conflict states', () => {
    expect(overviewSaveLabel('UNSAVED').toLowerCase()).not.toBe('saved');
    expect(overviewSaveLabel('CONFLICT').toLowerCase()).toContain('not saved');
  });

  it('classifies HTTP failures into CONFLICT vs ERROR', () => {
    expect(classifySaveFailure(409)).toBe('CONFLICT');
    expect(classifySaveFailure(500)).toBe('ERROR');
    expect(classifySaveFailure(0)).toBe('ERROR');
  });

  it('marks dirty drafts that Cancel must confirm', () => {
    expect(isDraftDirty('UNSAVED')).toBe(true);
    expect(isDraftDirty('ERROR')).toBe(true);
    expect(isDraftDirty('CONFLICT')).toBe(true);
    expect(isDraftDirty('SAVED')).toBe(false);
    expect(isDraftDirty('SAVING')).toBe(false);
    expect(shouldConfirmCancel('SAVED')).toBe(false);
    expect(shouldConfirmCancel('UNSAVED')).toBe(true);
  });

  it('handles View/Edit transitions with baseline and draft snapshots', () => {
    const page = makePage();
    const session = beginOverviewEdit(page);
    expect(session.mode).toBe('EDIT');
    expect(session.saveState).toBe('SAVED');
    expect(session.baseline).toEqual(page);
    expect(session.draft).toEqual(page);
    expect(session.baseline).not.toBe(page);

    const dirty = applyOverviewDraftPatch(session.baseline, session.draft, { description: 'changed' });
    expect(dirty.saveState).toBe('UNSAVED');

    const finished = finishOverviewSave({ ...page, revision: 2, description: 'changed' });
    expect(finished.mode).toBe('VIEW');
    expect(finished.saveState).toBe('SAVED');
    expect(finished.baseline.revision).toBe(2);

    const editAgain = beginOverviewEdit(finished.baseline);
    const cancelled = cancelOverviewEdit(editAgain.baseline);
    expect(cancelled.mode).toBe('VIEW');
    expect(cancelled.saveState).toBe('SAVED');
    expect(cancelled.draft).toEqual(editAgain.baseline);
  });

  it('returns to SAVED when a draft patch matches the baseline', () => {
    const page = makePage({ description: 'keep' });
    const session = beginOverviewEdit(page);
    const same = applyOverviewDraftPatch(session.baseline, session.draft, { description: 'keep' });
    expect(same.saveState).toBe('SAVED');
  });
});

describe('save confirmation flow helpers', () => {
  it('builds the required description', () => {
    expect(buildSaveConfirmDescription('Line A')).toBe('Save changes to "Line A" and return to View Mode?');
  });

  it('builds facts with revisions and unsaved state', () => {
    const page = makePage({ revision: 3 });
    const facts = buildSaveConfirmFacts({ name: page.name, elements: page.elements, revision: page.revision }, 'UNSAVED');
    expect(facts).toEqual([
      'Page name: Main Overview',
      'Element count: 0',
      'Current revision: 3',
      'Next revision: 4',
      'Unsaved state: Unsaved changes',
      'Page will return to View Mode after a successful save',
    ]);
    const clean = buildSaveConfirmFacts({ name: page.name, elements: page.elements, revision: page.revision }, 'SAVED');
    expect(clean[4]).toBe('Unsaved state: No unsaved changes');
  });
});

describe('cancel confirmation flow helpers', () => {
  it('skips the dialog on a clean draft and prompts when dirty', () => {
    expect(shouldConfirmCancel('SAVED')).toBe(false);
    expect(shouldConfirmCancel('CONFLICT')).toBe(true);
    const restored = cancelOverviewEdit(makePage({ description: 'baseline' }));
    expect(restored.draft.description).toBe('baseline');
    expect(restored.mode).toBe('VIEW');
  });
});

describe('unsaved page-switch guard', () => {
  it('confirms when the draft is not cleanly saved', () => {
    expect(requiresPageSwitchConfirm('UNSAVED', 'other', 'page-1')).toBe(true);
    expect(requiresPageSwitchConfirm('SAVING', 'other', 'page-1')).toBe(true);
    expect(requiresPageSwitchConfirm('ERROR', 'other', 'page-1')).toBe(true);
    expect(requiresPageSwitchConfirm('CONFLICT', 'other', 'page-1')).toBe(true);
  });

  it('skips confirmation for a clean draft or the same page', () => {
    expect(requiresPageSwitchConfirm('SAVED', 'other', 'page-1')).toBe(false);
    expect(requiresPageSwitchConfirm('UNSAVED', 'page-1', 'page-1')).toBe(false);
  });
});

describe('page validation', () => {
  const pages = [
    { id: 'a', name: 'Main Overview' },
    { id: 'b', name: 'Line B' },
  ];

  it('requires a non-empty trimmed name', () => {
    expect(validateOverviewPageName('', pages)).toBe('Page name is required');
    expect(validateOverviewPageName('   ', pages)).toBe('Page name is required');
  });

  it('rejects duplicate names case-insensitively', () => {
    expect(validateOverviewPageName('main overview', pages)).toMatch(/already exists/i);
    expect(validateOverviewPageName('  Line B  ', pages)).toMatch(/already exists/i);
    expect(validateOverviewPageName('Line B', pages, 'b')).toBeUndefined();
    expect(validateOverviewPageName('Line C', pages)).toBeUndefined();
  });

  it('rejects non-positive and non-integer design sizes', () => {
    expect(validateOverviewDimensions(1920, 1080)).toBeUndefined();
    expect(validateOverviewDimensions(0, 1080)).toMatch(/greater than 0/);
    expect(validateOverviewDimensions(1920, -1)).toMatch(/greater than 0/);
    expect(validateOverviewDimensions(1.5, 1080)).toMatch(/whole pixels/);
    expect(validateOverviewDimensions(99999, 1080)).toMatch(/16384/);
  });
});

describe('unique page naming', () => {
  const pages = [{ name: 'Main Overview' }, { name: 'Main Overview Copy' }];

  it('appends numeric suffixes until the name is free', () => {
    expect(uniqueOverviewPageName('Main Overview', pages)).toBe('Main Overview 2');
    expect(uniqueOverviewPageName('Fresh', pages)).toBe('Fresh');
    expect(uniqueOverviewPageName('Main Overview Copy', pages)).toBe('Main Overview Copy 2');
    expect(uniqueOverviewPageName('   ', pages)).toBe('Overview Page');
  });
});

describe('element counts for delete facts', () => {
  it('separates monitoring and control element types', () => {
    const counts = countOverviewElements([
      { id: '1', type: 'NUMERIC_LABEL' },
      { id: '2', type: 'STATUS_LIGHT' },
      { id: '3', type: 'SWITCH' },
      { id: '4', type: 'PUSH_BUTTON' },
      { id: '5', type: 'RECTANGLE' },
    ]);
    expect(counts).toEqual({ elementCount: 5, monitoringCount: 2, controlCount: 2 });
  });

  it('builds delete facts with all four counts', () => {
    const facts = buildDeleteConfirmFacts({
      name: 'Line B',
      elements: [
        { id: '1', type: 'NUMERIC_LABEL' },
        { id: '2', type: 'SWITCH' },
      ],
    });
    expect(facts[0]).toBe('Page name: Line B');
    expect(facts[1]).toBe('Element count: 2');
    expect(facts[2]).toBe('Monitoring element count: 1');
    expect(facts[3]).toBe('Control element count: 1');
  });
});

describe('library and inspector collapse state', () => {
  it('toggles independently and survives View/Edit within the session', () => {
    expect(getSessionPanelCollapsed('library')).toBe(false);
    expect(getSessionPanelCollapsed('inspector')).toBe(false);

    setSessionPanelCollapsed('library', toggleOverviewPanel(false));
    setSessionPanelCollapsed('inspector', toggleOverviewPanel(false));
    expect(getSessionPanelCollapsed('library')).toBe(true);
    expect(getSessionPanelCollapsed('inspector')).toBe(true);

    setSessionPanelCollapsed('library', toggleOverviewPanel(true));
    expect(getSessionPanelCollapsed('library')).toBe(false);
    expect(getSessionPanelCollapsed('inspector')).toBe(true);
  });
});
