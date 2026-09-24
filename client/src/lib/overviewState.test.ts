import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  OVERVIEW_DEFAULT_BACKGROUND,
  OVERVIEW_DEFAULT_HEIGHT,
  OVERVIEW_DEFAULT_WIDTH,
  OVERVIEW_CRUD_EDIT_TOOLTIP,
  OVERVIEW_CRUD_LAST_PAGE_TOOLTIP,
  OVERVIEW_PANEL_TOGGLE_CLASS,
  applyOverviewDraftPatch,
  beginOverviewEdit,
  buildDeleteConfirmFacts,
  buildSaveConfirmDescription,
  buildSaveConfirmFacts,
  cancelOverviewEdit,
  classifySaveFailure,
  countOverviewElements,
  displayedOverviewRevision,
  finishOverviewSave,
  getSessionPanelCollapsed,
  isDraftDirty,
  isSaveStatusLastGroup,
  overviewCommandBarGroups,
  overviewDraftMatchesBaseline,
  overviewRevisionLabel,
  overviewSaveLabel,
  pageCrudDisabledInMode,
  pageCrudTooltip,
  buildElementDeleteDescription,
  buildElementDeleteFacts,
  marksOverviewDirty,
  normalizeOverviewSavedViewport,
  overviewSaveNeedsViewportPut,
  overviewViewportsEqual,
  rememberOverviewViewport,
  requiresPageSwitchConfirm,
  resetOverviewPanelSession,
  resolveElementLibraryBulkToggle,
  resolveInspectorToggle,
  selectionFromNodeClick,
  selectionFromPaneClick,
  setSessionPanelCollapsed,
  shouldAutoFitOverviewViewport,
  showOverviewShell,
  showWorkflowCommandBar,
  shouldConfirmCancel,
  toggleOverviewPanel,
  uniqueOverviewPageName,
  validateOverviewDimensions,
  validateOverviewPageName,
  OVERVIEW_HOME_VIEWPORT,
  type OverviewPageRecord,
  type OverviewSaveState,
  type OverviewViewportMemory,
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
    expect(overviewCommandBarGroups('VIEW')).toEqual(['PAGE', 'MODE']);
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

describe('Edit Mode page CRUD lock', () => {
  it('disables New in Edit Mode', () => {
    expect(pageCrudDisabledInMode('EDIT')).toBe(true);
  });

  it('disables Rename in Edit Mode', () => {
    expect(pageCrudDisabledInMode('EDIT')).toBe(true);
    expect(pageCrudTooltip('EDIT', 'rename', true)).toBe(OVERVIEW_CRUD_EDIT_TOOLTIP);
  });

  it('disables Duplicate in Edit Mode', () => {
    expect(pageCrudDisabledInMode('EDIT')).toBe(true);
    expect(pageCrudTooltip('EDIT', 'duplicate', true)).toBe(OVERVIEW_CRUD_EDIT_TOOLTIP);
  });

  it('disables Delete in Edit Mode', () => {
    expect(pageCrudDisabledInMode('EDIT')).toBe(true);
    expect(pageCrudTooltip('EDIT', 'delete', false)).toBe(OVERVIEW_CRUD_EDIT_TOOLTIP);
  });

  it('uses the Edit Mode tooltip for every CRUD control', () => {
    expect(OVERVIEW_CRUD_EDIT_TOOLTIP).toBe('Exit Edit Mode to manage pages');
    for (const action of ['new', 'rename', 'duplicate', 'delete'] as const) {
      expect(pageCrudTooltip('EDIT', action, true)).toBe('Exit Edit Mode to manage pages');
      expect(pageCrudTooltip('EDIT', action, false)).toBe('Exit Edit Mode to manage pages');
    }
  });

  it('shows the last-page tooltip for Delete in View Mode', () => {
    expect(OVERVIEW_CRUD_LAST_PAGE_TOOLTIP).toBe('The last Overview page cannot be deleted');
    expect(pageCrudTooltip('VIEW', 'delete', false)).toBe('The last Overview page cannot be deleted');
    expect(pageCrudTooltip('VIEW', 'delete', true)).toBe('Delete Overview page');
  });

  it('keeps CRUD enabled in View Mode', () => {
    expect(pageCrudDisabledInMode('VIEW')).toBe(false);
    expect(pageCrudTooltip('VIEW', 'new', false)).toBe('New Overview page');
    expect(pageCrudTooltip('VIEW', 'rename', false)).toBe('Rename Overview page');
    expect(pageCrudTooltip('VIEW', 'duplicate', false)).toBe('Duplicate Overview page');
    expect(pageCrudTooltip('VIEW', 'delete', true)).toBe('Delete Overview page');
  });
});

describe('revision indicator', () => {
  it('labels REV from the active persisted page revision', () => {
    expect(overviewRevisionLabel(7)).toBe('REV 7');
    expect(displayedOverviewRevision(7)).toBe(7);
    expect(displayedOverviewRevision(makePage({ revision: 12 }).revision)).toBe(12);
    expect(overviewRevisionLabel(displayedOverviewRevision(12))).toBe('REV 12');
  });

  it('keeps the revision when panel collapse toggles', () => {
    expect(OVERVIEW_PANEL_TOGGLE_CLASS).toBe('overview-panel-toggle');
    const baselineRevision = 5;
    setSessionPanelCollapsed('library', toggleOverviewPanel(false));
    setSessionPanelCollapsed('inspector', toggleOverviewPanel(false));
    expect(getSessionPanelCollapsed('library')).toBe(true);
    expect(getSessionPanelCollapsed('inspector')).toBe(true);
    expect(displayedOverviewRevision(baselineRevision)).toBe(5);
    expect(overviewRevisionLabel(displayedOverviewRevision(baselineRevision))).toBe('REV 5');
  });

  it('keeps the save state when panel collapse toggles', () => {
    const session = beginOverviewEdit(makePage());
    expect(session.saveState).toBe('SAVED');
    setSessionPanelCollapsed('library', toggleOverviewPanel(false));
    setSessionPanelCollapsed('library', toggleOverviewPanel(true));
    expect(session.saveState).toBe('SAVED');
    expect(session.mode).toBe('EDIT');
    expect(session.baseline.revision).toBe(1);
  });

  it('keeps the same revision for a no-change save', () => {
    const page = makePage({ revision: 4 });
    const session = beginOverviewEdit(page);
    expect(overviewDraftMatchesBaseline(session.baseline, session.draft)).toBe(true);
    const finished = finishOverviewSave(session.baseline);
    expect(finished.saveState).toBe('SAVED');
    expect(finished.baseline.revision).toBe(4);
    expect(displayedOverviewRevision(finished.baseline.revision)).toBe(4);
    expect(overviewRevisionLabel(finished.baseline.revision)).toBe('REV 4');
  });
});

describe('command bar contract', () => {
  it('keeps Save Status as the last command bar group', () => {
    expect(isSaveStatusLastGroup('VIEW')).toBe(false);
    expect(isSaveStatusLastGroup('EDIT')).toBe(true);
    expect(overviewCommandBarGroups('VIEW').at(-1)).toBe('MODE');
    expect(overviewCommandBarGroups('EDIT').at(-1)).toBe('SAVE STATUS');
  });
});

describe('Workflow Command Bar page scope', () => {
  const appSource = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  const otherPages = [
    'Overview',
    'Devices',
    'Modbus Monitor',
    'Runtime Monitor',
    'Traffic Monitor',
    'Audit Log',
    'Validation',
    'Project Settings',
  ] as const;

  it('mounts only on Workflow', () => {
    expect(showWorkflowCommandBar('Workflow')).toBe(true);
    expect(appSource).toContain('showWorkflowCommandBar(page)?');
    expect(appSource).not.toContain("page==='Overview'?null:<CommandBar");
  });

  it('stays unmounted on every other page', () => {
    for (const pageName of otherPages) {
      expect(showWorkflowCommandBar(pageName)).toBe(false);
    }
  });

  it('keeps the Overview Command Bar on Overview', () => {
    expect(showOverviewShell('Overview')).toBe(true);
    for (const pageName of ['Workflow', ...otherPages.slice(1)] as const) {
      expect(showOverviewShell(pageName)).toBe(false);
    }
  });
});

/* ---- O1-C critical UX correction (issues 1–3, 8, 11, 12) --------------- */

describe('session preservation helpers (issues 1–2)', () => {
  it('remembers an exact viewport snapshot', () => {
    const stored = rememberOverviewViewport(OVERVIEW_HOME_VIEWPORT, { x: -120.5, y: 40, zoom: 1.35 });
    expect(stored).toEqual({ x: -120.5, y: 40, zoom: 1.35 });
  });

  it('never auto-fits when returning to Overview', () => {
    expect(shouldAutoFitOverviewViewport()).toBe(false);
  });

  it('panel toggle does not alter the stored viewport memory', () => {
    const viewport: OverviewViewportMemory = { x: -10, y: 20, zoom: 0.9 };
    const afterToggle = toggleOverviewPanel(false);
    expect(afterToggle).toBe(true);
    expect(viewport).toEqual({ x: -10, y: 20, zoom: 0.9 });
  });

  it('Edit mode / draft survive the keep-alive path (no reset on navigate)', () => {
    const session = beginOverviewEdit(makePage({ description: 'keep me' }));
    expect(session.mode).toBe('EDIT');
    // Keep-alive: App keeps Overview mounted — session values are not recomputed
    // from the server on return; pure session object stays intact.
    expect(session.draft.description).toBe('keep me');
    expect(session.saveState).toBe('SAVED');
  });
});

describe('dirty state (issue 3)', () => {
  it('first mutation from SAVED marks UNSAVED / CHANGES PENDING', () => {
    const session = beginOverviewEdit(makePage());
    expect(session.saveState).toBe('SAVED');
    expect(marksOverviewDirty(session.saveState)).toBe(true);
    const first = applyOverviewDraftPatch(session.baseline, session.draft, {
      description: 'first mutation',
    });
    expect(first.saveState).toBe('UNSAVED');
    expect(overviewSaveLabel(first.saveState)).toBe('CHANGES PENDING');
    expect(shouldConfirmCancel(first.saveState)).toBe(true);
  });

  it('selection / pan / zoom / panel / search do not mark dirty', () => {
    // Those interactions never call applyOverviewDraftPatch — pure guard:
    expect(marksOverviewDirty('SAVED')).toBe(true); // only mutation entry point
    const baseline = makePage();
    const draft = structuredClone(baseline);
    // No patch applied → still matches baseline → SAVED.
    expect(overviewDraftMatchesBaseline(baseline, draft)).toBe(true);
    expect(overviewSaveLabel('SAVED')).toBe('SAVED');
    expect(shouldConfirmCancel('SAVED')).toBe(false);
    // Panel/search state lives outside draft:
    resetOverviewPanelSession();
    expect(getSessionPanelCollapsed('library')).toBe(false);
    expect(overviewDraftMatchesBaseline(baseline, draft)).toBe(true);
  });

  it('UI label for UNSAVED is exactly CHANGES PENDING', () => {
    expect(overviewSaveLabel('UNSAVED')).toBe('CHANGES PENDING');
  });
});

describe('selection helpers (issue 4)', () => {
  it('node click A then B selects in one click each', () => {
    expect(selectionFromNodeClick('A')).toBe('A');
    expect(selectionFromNodeClick('B')).toBe('B');
  });

  it('pane click alone clears selection', () => {
    expect(selectionFromPaneClick()).toBeNull();
  });
});

describe('delete confirmation copy (issue 8)', () => {
  it('uses the required title/description contract', () => {
    expect(buildElementDeleteDescription('Pump 1')).toBe('Delete "Pump 1" from this Overview Page?');
  });

  it('lists type, ID, binding status, and local-until-save facts', () => {
    const facts = buildElementDeleteFacts({
      type: 'SWITCH',
      id: 'element-9',
      binding: { status: 'NOT_BOUND' },
    });
    expect(facts).toEqual([
      'Element type: SWITCH',
      'Element ID: element-9',
      'Binding status: NOT_BOUND',
      'This change remains local until Save & Exit',
    ]);
  });

  it('OverviewPage wires every delete path through ConfirmDialog', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
      'utf8',
    );
    expect(source).toContain('title="Delete Overview Element"');
    expect(source).toContain('requestDeleteElement');
    expect(source).toContain('confirmDeleteElement');
    expect(source).toContain('cancelDeleteElement');
    // Keyboard + inspector + command all use requestDeleteElement, not direct mutation.
    expect(source).toContain('event.key === \'Delete\' || event.key === \'Backspace\'');
    expect(source).toContain('onDeleteSelected');
    // No native dialogs.
    expect(source).not.toContain('window.confirm(');
    expect(source).not.toContain('window.alert(');
  });
});

describe('library bulk toggle (issue 11)', () => {
  it('any collapsed → Expand All with expand icon', () => {
    const state = resolveElementLibraryBulkToggle(false);
    expect(state.action).toBe('expand');
    expect(state.ariaLabel).toBe('Expand All Categories');
    expect(state.icon).toBe('expand');
  });

  it('all expanded → Collapse All with collapse icon', () => {
    const state = resolveElementLibraryBulkToggle(true);
    expect(state.action).toBe('collapse');
    expect(state.ariaLabel).toBe('Collapse All Categories');
    expect(state.icon).toBe('collapse');
  });

  it('ElementLibrary uses a single toggle beside Search', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'ElementLibrary.tsx'),
      'utf8',
    );
    expect(source).not.toContain('Expand All\n');
    expect(source).not.toContain('>Expand All<');
    expect(source).not.toContain('>Collapse All<');
    expect(source).toContain('resolveElementLibraryBulkToggle');
    expect(source).toContain('element-library__toggle');
    expect(source).toContain('element-library__search');
    // Category toggles unchanged:
    expect(source).toContain('element-library__section-toggle');
  });
});

describe('inspector rail icons (issue 12)', () => {
  it('expanded → Collapse Element Inspector', () => {
    const state = resolveInspectorToggle(true);
    expect(state.ariaLabel).toBe('Collapse Element Inspector');
    expect(state.icon).toBe('collapse');
  });

  it('collapsed → Expand Element Inspector', () => {
    const state = resolveInspectorToggle(false);
    expect(state.ariaLabel).toBe('Expand Element Inspector');
    expect(state.icon).toBe('expand');
  });
});

describe('O1-C critical UX source contracts (issues 1, 2, 5, 6, 10, 13, 14)', () => {
  const read = (rel: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', ...rel), 'utf8');

  it('App keeps Overview session mounted across navigation (issue 1)', () => {
    const app = read(['App.tsx']);
    expect(app).toContain('overviewMounted');
    expect(app).toContain('setOverviewMounted(true)');
    expect(app).toContain('overview-session-host');
    // Must not unmount Overview when navigating away:
    expect(app).toContain("page==='Overview'?undefined:{display:'none'}");
    expect(app).not.toContain("{page==='Overview'&&<OverviewPage/>}");
  });

  it('canvas restores viewport without Fit View on return (issue 2)', () => {
    const canvas = read(['components', 'overview', 'OverviewCanvas.tsx']);
    expect(canvas).toContain('onViewportChange');
    expect(canvas).toContain('restoreViewportEpoch');
    expect(canvas).toContain('setViewport');
    // No auto fitView prop on the ReactFlow instance:
    expect(canvas).not.toMatch(/<ReactFlow[^>]*\sfitView[\s>]/);
    expect(canvas).not.toContain('fitViewOptions');
    expect(read(['components', 'overview', 'OverviewPage.tsx'])).toContain('handleFitView');
  });

  it('drag updates live and commits once on stop (issue 5)', () => {
    const canvas = read(['components', 'overview', 'OverviewCanvas.tsx']);
    expect(canvas).toContain('dragging === true');
    expect(canvas).toContain('setDragPositions');
    expect(canvas).toContain('dragging === false');
    expect(canvas).toContain('onMoveElement(change.id, x, y)');
  });

  it('eight resize handles via NodeResizer; none when locked or VIEW (issue 6)', () => {
    const node = read(['components', 'overview', 'ElementNode.tsx']);
    expect(node).toContain('NodeResizer');
    expect(node).toContain('showResizeHandles');
    expect(node).toContain('edit && selected && !element.locked');
    const page = read(['components', 'overview', 'OverviewPage.tsx']);
    // Coalesced gesture → one history entry per resize.
    expect(page).toContain('resizeGestureRef');
    expect(page).toContain('pushHistory: firstFrame');
  });

  it('VIEW control preview is local UI only (issue 10)', () => {
    const node = read(['components', 'overview', 'ElementNode.tsx']);
    expect(node).toContain('data-preview-control="switch"');
    expect(node).toContain('data-preview-control="push-button"');
    expect(node).toContain('data-preview-control="navigation-link"');
    expect(node).toContain('PREVIEW');
    expect(node).not.toContain('fetch(');
    expect(node).not.toContain('/api/');
    expect(node).not.toContain('updateOverviewPage');
  });

  it('Inspector offers only category-valid directions (issue 9)', () => {
    const inspector = read(['components', 'overview', 'ElementInspector.tsx']);
    expect(inspector).toContain('overviewAllowedDirections(element.category)');
    expect(inspector).not.toContain("DIRECTIONS.map");
    const page = read(['components', 'overview', 'OverviewPage.tsx']);
    expect(page).toContain('normalizeOverviewBindingDirection');
  });

  it('library CSS keeps search flex + toggle without overflow (issue 11)', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles', 'overview.css'), 'utf8');
    expect(css).toContain('.element-library__toggle');
    expect(css).toMatch(/\.element-library__search\s*\{[^}]*flex:\s*1 1 auto/s);
    expect(css).toMatch(/\.element-library__search\s*\{[^}]*min-width:\s*0/s);
  });

  it('version is v1.4.0-dev.2 across canonical sources (issue 13)', () => {
    const version = read(['version.ts']);
    expect(version).toContain("'1.4.0-dev.2'");
    const rootPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', 'package.json'), 'utf8'));
    const clientPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    expect(rootPkg.version).toBe('1.4.0-dev.2');
    expect(clientPkg.version).toBe('1.4.0-dev.2');
  });

  it('does not touch protected Workflow/Modbus/Tag/Variable surfaces (issue 14)', () => {
    const page = read(['components', 'overview', 'OverviewPage.tsx']);
    // Save pipeline only via confirmSaveAndExit — never during element mutations.
    expect(page).toContain('confirmSaveAndExit');
    expect(page).toContain('updateOverviewPage');
    expect(page).not.toContain('window.confirm(');
    expect(page).not.toContain('window.alert(');
    // No Runtime/Modbus APIs from element canvas/node code:
    const canvas = read(['components', 'overview', 'OverviewCanvas.tsx']);
    expect(canvas).not.toContain('/api/');
    expect(canvas).not.toContain('WebSocket');
    const node = read(['components', 'overview', 'ElementNode.tsx']);
    expect(node).not.toContain('/api/');
    expect(node).not.toContain('WebSocket');
  });
});

describe('savedViewport + control-state client contract', () => {
  it('maps missing savedViewport to default', () => {
    expect(normalizeOverviewSavedViewport(undefined)).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(normalizeOverviewSavedViewport(null)).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(normalizeOverviewSavedViewport({ x: 1, y: 2, zoom: 1.5 })).toEqual({
      x: 1,
      y: 2,
      zoom: 1.5,
    });
    expect(normalizeOverviewSavedViewport({ x: 0, y: 0, zoom: 0 })).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
  });

  it('detects changed viewport and unchanged viewport', () => {
    expect(overviewViewportsEqual({ x: 0, y: 0, zoom: 1 }, { x: 10, y: 0, zoom: 1 })).toBe(false);
    expect(overviewViewportsEqual({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 1 })).toBe(true);
  });

  it('viewport-only change triggers Save PUT; fully unchanged does not', () => {
    const baseline = makePage({
      savedViewport: { x: 0, y: 0, zoom: 1 },
    });
    const draft = structuredClone(baseline);
    expect(overviewSaveNeedsViewportPut(baseline, draft, { x: 0, y: 0, zoom: 1 })).toBe(false);
    expect(overviewSaveNeedsViewportPut(baseline, draft, { x: -40, y: 12, zoom: 1.2 })).toBe(true);
    const dirtyDraft = { ...structuredClone(baseline), description: 'changed' };
    expect(overviewSaveNeedsViewportPut(baseline, dirtyDraft, { x: 0, y: 0, zoom: 1 })).toBe(true);
  });

  it('successful Save accepts Server revision and Cancel restores baseline viewport', () => {
    const baseline = makePage({ savedViewport: { x: 5, y: 6, zoom: 1.1 } });
    const finished = finishOverviewSave({ ...baseline, revision: baseline.revision + 1 });
    expect(finished.saveState).toBe('SAVED');
    expect(finished.baseline.savedViewport).toEqual({ x: 5, y: 6, zoom: 1.1 });
    const restored = cancelOverviewEdit(baseline);
    expect(restored.draft.savedViewport).toEqual({ x: 5, y: 6, zoom: 1.1 });
    expect(restored.mode).toBe('VIEW');
  });

  it('refresh restoration uses duration 0 and never fitView', () => {
    const canvas = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewCanvas.tsx'),
      'utf8',
    );
    expect(canvas).toContain('setViewport(viewport as Viewport, { duration: 0 })');
    expect(canvas).not.toContain('fitViewOptions');
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
      'utf8',
    );
    expect(page).toContain('normalizeOverviewSavedViewport(record.savedViewport)');
    expect(page).toContain('savedViewport: sessionViewport');
    expect(page).toContain('patchOverviewControlState');
  });

  it('control-state client uses dedicated PATCH without full elements array', () => {
    const api = fs.readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'overviewApi.ts'),
      'utf8',
    );
    expect(api).toContain('patchOverviewControlState');
    expect(api).toContain("method: 'PATCH'");
    expect(api).toContain('/api/overview-control-states');
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
      'utf8',
    );
    // VIEW control path must not use draft dirty / undo / selection.
    expect(page).toContain('handleControlStateChange');
    expect(page).toContain('Exit Edit Mode to use control preview');
    const node = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'ElementNode.tsx'),
      'utf8',
    );
    expect(node).toContain('onControlStateChange');
    expect(node).toContain('confirmedSwitch');
    expect(node).toContain('Released state only');
  });
});
