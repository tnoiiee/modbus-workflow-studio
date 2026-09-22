import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { Field } from '../ui/Field.js';
import { Modal } from '../ui/Modal.js';
import { OverviewCanvas, fitOverviewView } from './OverviewCanvas.js';
import { OverviewCommandBar } from './OverviewCommandBar.js';
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
  finishOverviewSave,
  getSessionPanelCollapsed,
  overviewCommandBarGroups,
  requiresPageSwitchConfirm,
  setSessionPanelCollapsed,
  shouldConfirmCancel,
  toggleOverviewPanel,
  uniqueOverviewPageName,
  validateOverviewDimensions,
  validateOverviewPageName,
  type OverviewMode,
  type OverviewPageRecord,
  type OverviewPageSummary,
  type OverviewSaveState,
} from '../../lib/overviewState.js';
import {
  createOverviewPage,
  deleteOverviewPage,
  duplicateOverviewPage,
  fetchOverviewPage,
  fetchOverviewPages,
  renameOverviewPage,
  updateOverviewPage,
} from '../../lib/overviewApi.js';

type NameDialogKind = 'create' | 'rename' | 'duplicate';

interface NameDialogState {
  kind: NameDialogKind;
  name: string;
  description: string;
  width: string;
  height: string;
  background: string;
}

/**
 * Overview page shell (checkpoints O1-A + O1-B).
 *
 * Owns VIEW/EDIT mode, the manual revision-aware Save & Exit pipeline,
 * page CRUD dialogs, and session-scoped panel collapse. Persistence goes
 * through `/api/overview-pages` only — Workflow/Devices/Modbus are untouched.
 *
 * Panel collapse and element selection are UI-only and never persisted.
 */
export function OverviewPage() {
  const [pages, setPages] = useState<OverviewPageSummary[]>([]);
  const [activePageId, setActivePageId] = useState('');
  const [activePage, setActivePage] = useState<OverviewPageRecord | null>(null);
  const [mode, setMode] = useState<OverviewMode>('VIEW');
  const [saveState, setSaveState] = useState<OverviewSaveState>('SAVED');
  const [baseline, setBaseline] = useState<OverviewPageRecord | null>(null);
  const [draft, setDraft] = useState<OverviewPageRecord | null>(null);
  const [loadError, setLoadError] = useState<string>();

  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [nameDialogError, setNameDialogError] = useState<string>();
  const [nameDialogPending, setNameDialogPending] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [deletePending, setDeletePending] = useState(false);

  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveConfirmError, setSaveConfirmError] = useState<string>();
  const [saveConfirmPending, setSaveConfirmPending] = useState(false);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [pendingPageId, setPendingPageId] = useState<string | null>(null);

  const [libraryCollapsed, setLibraryCollapsed] = useState(() => getSessionPanelCollapsed('library'));
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() => getSessionPanelCollapsed('inspector'));

  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const activePageIdRef = useRef('');
  activePageIdRef.current = activePageId;

  const groups = overviewCommandBarGroups(mode);
  const workingPage = draft ?? activePage;
  const dirty = shouldConfirmCancel(saveState);

  /* ---- page list loading ------------------------------------------------ */

  const loadPages = useCallback(async (preferId?: string) => {
    try {
      const list = await fetchOverviewPages();
      setPages(list);
      setLoadError(undefined);
      const requested = preferId && list.some(item => item.id === preferId) ? preferId : list[0]?.id;
      if (!requested) {
        setActivePage(null);
        setActivePage(null);
        return;
      }
      if (requested !== activePageIdRef.current) {
        setActivePageId(requested);
        const record = await fetchOverviewPage(requested);
        setActivePage(record);
        setBaseline(record);
        setDraft(record);
      }
      return list;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load Overview pages');
      return undefined;
    }
  }, []);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  /* ---- mode machine ----------------------------------------------------- */

  const enterEdit = useCallback(() => {
    if (!activePage) return;
    const session = beginOverviewEdit(activePage);
    setBaseline(session.baseline);
    setDraft(session.draft);
    setSaveState(session.saveState);
    setMode(session.mode);
    setSaveConfirmError(undefined);
    setSaveConfirmPending(false);
  }, [activePage]);

  const openSaveConfirm = useCallback(() => {
    if (mode !== 'EDIT') return;
    setSaveConfirmError(undefined);
    setSaveConfirmPending(false);
    setSaveConfirmOpen(true);
  }, [mode]);

  const confirmSaveAndExit = useCallback(async () => {
    if (!workingPage || saveConfirmPending) return;
    setSaveConfirmPending(true);
    setSaveConfirmError(undefined);
    setSaveState('SAVING');
    try {
      const saved = await updateOverviewPage(workingPage.id, baseline?.revision ?? workingPage.revision, {
        name: draft?.name,
        description: draft?.description,
        designWidth: draft?.designWidth,
        designHeight: draft?.designHeight,
        backgroundColor: draft?.backgroundColor,
        elements: draft?.elements,
        layerOrder: draft?.layerOrder,
      });
      const finished = finishOverviewSave(saved);
      setActivePage(saved);
      setBaseline(finished.baseline);
      setDraft(finished.draft);
      setSaveState(finished.saveState);
      setMode(finished.mode);
      setSaveConfirmOpen(false);
      setSaveConfirmPending(false);
      setPages(current =>
        current.map(item =>
          item.id === saved.id
            ? {
                ...item,
                name: saved.name,
                description: saved.description,
                revision: saved.revision,
                elementCount: saved.elements.length,
                designWidth: saved.designWidth,
                designHeight: saved.designHeight,
                backgroundColor: saved.backgroundColor,
                modifiedAt: saved.modifiedAt,
              }
            : item,
        ),
      );
    } catch (error) {
      const status = (error as { status?: number }).status ?? 0;
      const next = classifySaveFailure(status);
      setSaveState(next);
      setSaveConfirmPending(false);
      setSaveConfirmError(error instanceof Error ? error.message : 'Unable to save Overview page');
      // Stay in Edit Mode, keep the draft, keep the dialog open.
    }
  }, [baseline, draft, saveConfirmPending, workingPage]);

  const requestCancelChanges = useCallback(() => {
    if (mode !== 'EDIT') return;
    if (!dirty) {
      if (!baseline) return;
      const restored = cancelOverviewEdit(baseline);
      setDraft(restored.draft);
      setSaveState(restored.saveState);
      setMode(restored.mode);
      setCancelConfirmOpen(false);
      return;
    }
    setCancelConfirmOpen(true);
  }, [baseline, dirty, mode]);

  const confirmCancelChanges = useCallback(() => {
    if (!baseline) return;
    const restored = cancelOverviewEdit(baseline);
    setDraft(restored.draft);
    setSaveState(restored.saveState);
    setMode(restored.mode);
    setCancelConfirmOpen(false);
  }, [baseline]);

  /* ---- page CRUD -------------------------------------------------------- */

  const openCreateDialog = useCallback(() => {
    setNameDialogError(undefined);
    setNameDialogPending(false);
    setNameDialog({
      kind: 'create',
      name: '',
      description: '',
      width: String(OVERVIEW_DEFAULT_WIDTH),
      height: String(OVERVIEW_DEFAULT_HEIGHT),
      background: OVERVIEW_DEFAULT_BACKGROUND,
    });
  }, []);

  const openRenameDialog = useCallback(() => {
    const source = workingPage;
    if (!source) return;
    setNameDialogError(undefined);
    setNameDialogPending(false);
    setNameDialog({
      kind: 'rename',
      name: source.name,
      description: source.description,
      width: String(source.designWidth),
      height: String(source.designHeight),
      background: source.backgroundColor,
    });
  }, [workingPage]);

  const openDuplicateDialog = useCallback(() => {
    const source = workingPage;
    if (!source) return;
    setNameDialogError(undefined);
    setNameDialogPending(false);
    setNameDialog({
      kind: 'duplicate',
      name: uniqueOverviewPageName(`${source.name} Copy`, pages),
      description: source.description,
      width: String(source.designWidth),
      height: String(source.designHeight),
      background: source.backgroundColor,
    });
  }, [pages, workingPage]);

  const closeNameDialog = useCallback(() => {
    if (nameDialogPending) return;
    setNameDialog(null);
    setNameDialogError(undefined);
  }, [nameDialogPending]);

  const submitNameDialog = useCallback(async () => {
    const dialog = nameDialog;
    if (!dialog || nameDialogPending) return;
    const trimmed = dialog.name.trim();
    const nameError = validateOverviewPageName(trimmed, pages, dialog.kind === 'rename' ? workingPage?.id : undefined);
    if (nameError) {
      setNameDialogError(nameError);
      return;
    }
    const width = Number(dialog.width);
    const height = Number(dialog.height);
    if (dialog.kind === 'create') {
      const sizeError = validateOverviewDimensions(width, height);
      if (sizeError) {
        setNameDialogError(sizeError);
        return;
      }
    }
    setNameDialogPending(true);
    setNameDialogError(undefined);
    try {
      if (dialog.kind === 'create') {
        const created = await createOverviewPage({
          name: trimmed,
          description: dialog.description.trim(),
          designWidth: width,
          designHeight: height,
          backgroundColor: dialog.background,
        });
        setNameDialog(null);
        await loadPages(created.id);
      } else if (dialog.kind === 'rename') {
        if (!workingPage) return;
        if (mode === 'EDIT' && draft && baseline) {
          // Rename inside an edit session stays in the draft (Save & Exit persists).
          const next = applyOverviewDraftPatch(baseline, draft, {
            name: trimmed,
            description: dialog.description.trim(),
          });
          setDraft(next.draft);
          setSaveState(next.saveState);
          setPages(current =>
            current.map(item => (item.id === workingPage.id ? { ...item, name: trimmed, description: dialog.description.trim() } : item)),
          );
          setNameDialog(null);
          return;
        }
        const renamed = await renameOverviewPage(workingPage.id, {
          name: trimmed,
          description: dialog.description.trim(),
        });
        setPages(current =>
          current.map(item =>
            item.id === renamed.id
              ? { ...item, name: renamed.name, description: renamed.description, revision: renamed.revision, modifiedAt: renamed.modifiedAt }
              : item,
          ),
        );
        setActivePage(renamed);
        setBaseline(renamed);
        setDraft(renamed);
        setNameDialog(null);
      } else {
        if (!workingPage) return;
        const copy = await duplicateOverviewPage(workingPage.id, trimmed);
        setNameDialog(null);
        await loadPages(copy.id);
      }
    } catch (error) {
      setNameDialogPending(false);
      setNameDialogError(error instanceof Error ? error.message : 'Unable to complete the page action');
      return;
    }
    setNameDialogPending(false);
  }, [baseline, draft, loadPages, mode, nameDialog, nameDialogPending, pages, workingPage]);

  const requestDelete = useCallback(() => {
    if (pages.length <= 1 || !workingPage) return;
    setDeleteError(undefined);
    setDeletePending(false);
    setDeleteOpen(true);
  }, [pages.length, workingPage]);

  const confirmDelete = useCallback(async () => {
    if (!workingPage || deletePending) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await deleteOverviewPage(workingPage.id);
      setDeleteOpen(false);
      // Leaving an edit session bound to a deleted page is unsafe; discard it.
      if (mode === 'EDIT') {
        setMode('VIEW');
        setSaveState('SAVED');
      }
      setDraft(null);
      setBaseline(null);
      setActivePage(null);
      setActivePageId('');
      await loadPages();
      setDeletePending(false);
    } catch (error) {
      setDeletePending(false);
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete Overview page');
    }
  }, [deletePending, loadPages, mode, workingPage]);

  const handleSelectPage = useCallback(
    (nextPageId: string) => {
      if (requiresPageSwitchConfirm(saveState, nextPageId, activePageId)) {
        setPendingPageId(nextPageId);
        return;
      }
      void (async () => {
        try {
          const record = await fetchOverviewPage(nextPageId);
          setActivePageId(nextPageId);
          setActivePage(record);
          setBaseline(record);
          setDraft(record);
          setSaveState('SAVED');
          setPendingPageId(null);
        } catch (error) {
          setLoadError(error instanceof Error ? error.message : 'Unable to open Overview page');
        }
      })();
    },
    [activePageId, saveState],
  );

  const confirmPendingPageSwitch = useCallback(() => {
    if (!pendingPageId) return;
    const nextPageId = pendingPageId;
    setPendingPageId(null);
    // Discard the local draft; no save request is sent.
    setSaveState('SAVED');
    void (async () => {
      try {
        const record = await fetchOverviewPage(nextPageId);
        setActivePageId(nextPageId);
        setActivePage(record);
        setBaseline(record);
        setDraft(record);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to open Overview page');
      }
    })();
  }, [pendingPageId]);

  /* ---- canvas controls -------------------------------------------------- */

  const handleInstanceReady = useCallback((instance: ReactFlowInstance) => {
    flowInstanceRef.current = instance;
  }, []);
  const handleFitView = useCallback(() => fitOverviewView(flowInstanceRef.current), []);
  const handleZoomIn = useCallback(() => flowInstanceRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => flowInstanceRef.current?.zoomOut(), []);

  const handleToggleLibrary = useCallback(() => {
    setLibraryCollapsed(current => {
      const next = toggleOverviewPanel(current);
      setSessionPanelCollapsed('library', next);
      return next;
    });
  }, []);
  const handleToggleInspector = useCallback(() => {
    setInspectorCollapsed(current => {
      const next = toggleOverviewPanel(current);
      setSessionPanelCollapsed('inspector', next);
      return next;
    });
  }, []);

  const noop = useCallback(() => undefined, []);
  const hasSelection = false;
  const canDeletePage = pages.length > 1 && Boolean(workingPage);

  const workspaceClass = [
    'overview__workspace',
    libraryCollapsed && mode === 'EDIT' ? 'overview__workspace--library-collapsed' : '',
    inspectorCollapsed && mode === 'EDIT' ? 'overview__workspace--inspector-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={`overview${mode === 'VIEW' ? ' overview--view' : ' overview--edit'}`}
      aria-label="Overview"
      data-command-groups={groups.join(',')}
    >
      <div className="overview-bars">
        <OverviewCommandBar
          pages={pages}
          activePageId={activePageId}
          onSelectPage={handleSelectPage}
          onNewPage={openCreateDialog}
          onRenamePage={openRenameDialog}
          onDuplicatePage={openDuplicateDialog}
          onDeletePage={requestDelete}
          canDeletePage={canDeletePage}
          mode={mode}
          saveState={saveState}
          onEdit={enterEdit}
          onSaveAndExit={openSaveConfirm}
          onCancelChanges={requestCancelChanges}
          canUndo={false}
          canRedo={false}
          hasSelection={hasSelection}
          onUndo={noop}
          onRedo={noop}
          onFitView={handleFitView}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLockSelected={noop}
          onUnlockSelected={noop}
        />
      </div>

      {loadError ? (
        <div className="notice overview-notice" role="alert">
          {loadError}
        </div>
      ) : null}

      <div className={workspaceClass}>
        {mode === 'EDIT' && libraryCollapsed ? (
          <div className="overview-rail overview-rail--library">
            <button
              type="button"
              className="btn-icon btn-icon--sm"
              aria-label="Expand Element Library"
              title="Expand Element Library"
              aria-expanded={false}
              onClick={handleToggleLibrary}
            >
              <PanelLeftOpen size={16} />
            </button>
            <span className="overview-rail__marker" aria-hidden="true">
              Elements
            </span>
          </div>
        ) : (
          <aside className="library overview-panel overview-library" aria-label="Element Library">
            <div className="overview-panel__head">
              <h3>Element Library</h3>
              {mode === 'EDIT' ? (
                <button
                  type="button"
                  className="btn-icon btn-icon--sm"
                  aria-label="Collapse Element Library"
                  title="Collapse Element Library"
                  aria-expanded={true}
                  onClick={handleToggleLibrary}
                >
                  <PanelLeftClose size={16} />
                </button>
              ) : null}
            </div>
            <p className="empty">Element Library will be implemented in O1-C</p>
          </aside>
        )}

        <OverviewCanvas
          mode={mode}
          designWidth={workingPage?.designWidth ?? OVERVIEW_DEFAULT_WIDTH}
          designHeight={workingPage?.designHeight ?? OVERVIEW_DEFAULT_HEIGHT}
          backgroundColor={workingPage?.backgroundColor ?? OVERVIEW_DEFAULT_BACKGROUND}
          onInstanceReady={handleInstanceReady}
        />

        {mode === 'EDIT' && inspectorCollapsed ? (
          <div className="overview-rail overview-rail--inspector">
            <button
              type="button"
              className="btn-icon btn-icon--sm"
              aria-label="Expand Element Inspector"
              title="Expand Element Inspector"
              aria-expanded={false}
              onClick={handleToggleInspector}
            >
              <PanelLeftOpen size={16} />
            </button>
            <span className="overview-rail__marker" aria-hidden="true">
              Inspector
            </span>
          </div>
        ) : (
          <aside className="inspector overview-panel overview-inspector" aria-label="Element Inspector">
            <div className="overview-panel__head">
              <h3>Element Inspector</h3>
              {mode === 'EDIT' ? (
                <button
                  type="button"
                  className="btn-icon btn-icon--sm"
                  aria-label="Collapse Element Inspector"
                  title="Collapse Element Inspector"
                  aria-expanded={true}
                  onClick={handleToggleInspector}
                >
                  <PanelLeftClose size={16} />
                </button>
              ) : null}
            </div>
            <p className="empty">Element Inspector will be implemented in O1-C</p>
          </aside>
        )}
      </div>

      {/* New / Rename / Duplicate modal */}
      <Modal
        open={nameDialog !== null}
        title={
          nameDialog?.kind === 'create'
            ? 'New Overview Page'
            : nameDialog?.kind === 'rename'
              ? 'Rename Overview Page'
              : 'Duplicate Overview Page'
        }
        description={
          nameDialog?.kind === 'create'
            ? 'Create a new Overview page with a fixed design resolution.'
            : nameDialog?.kind === 'rename'
              ? 'Change the page name and description. The Page ID stays the same.'
              : 'Copy canvas settings, background, elements, and layer order into a new page.'
        }
        onClose={closeNameDialog}
        size="sm"
        initialFocusRef={nameInputRef}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeNameDialog} disabled={nameDialogPending}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void submitNameDialog()}
              disabled={nameDialogPending || Boolean(nameDialogError)}
              aria-busy={nameDialogPending || undefined}
            >
              {nameDialogPending
                ? 'Working…'
                : nameDialog?.kind === 'create'
                  ? 'Create Page'
                  : nameDialog?.kind === 'rename'
                    ? 'Save Name'
                    : 'Duplicate Page'}
            </button>
          </>
        }
      >
        {nameDialog ? (
          <>
            <Field
              label="Page Name"
              value={nameDialog.name}
              maxLength={100}
              inputRef={nameInputRef}
              error={nameDialogError && nameDialogError.includes('name') ? nameDialogError : undefined}
              hint="Required · must be unique (case-insensitive)"
              placeholder="Example: Main Overview"
              disabled={nameDialogPending}
              onChange={value => {
                setNameDialog(current => (current ? { ...current, name: value } : current));
                if (nameDialogError) setNameDialogError(undefined);
              }}
              onSubmit={() => void submitNameDialog()}
            />
            <Field
              label="Description"
              value={nameDialog.description}
              maxLength={500}
              disabled={nameDialogPending}
              onChange={value => setNameDialog(current => (current ? { ...current, description: value } : current))}
            />
            {nameDialog.kind === 'create' ? (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="overview-width">
                    Design Width
                  </label>
                  <input
                    id="overview-width"
                    className="field__input"
                    type="number"
                    min={1}
                    max={16384}
                    step={1}
                    value={nameDialog.width}
                    disabled={nameDialogPending}
                    onChange={event => {
                      setNameDialog(current => (current ? { ...current, width: event.target.value } : current));
                      if (nameDialogError) setNameDialogError(undefined);
                    }}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="overview-height">
                    Design Height
                  </label>
                  <input
                    id="overview-height"
                    className="field__input"
                    type="number"
                    min={1}
                    max={16384}
                    step={1}
                    value={nameDialog.height}
                    disabled={nameDialogPending}
                    onChange={event => {
                      setNameDialog(current => (current ? { ...current, height: event.target.value } : current));
                      if (nameDialogError) setNameDialogError(undefined);
                    }}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="overview-background">
                    Background Color
                  </label>
                  <input
                    id="overview-background"
                    className="field__input"
                    type="color"
                    value={nameDialog.background}
                    disabled={nameDialogPending}
                    onChange={event =>
                      setNameDialog(current => (current ? { ...current, background: event.target.value } : current))
                    }
                  />
                </div>
              </>
            ) : null}
            {nameDialogError && !nameDialogError.includes('name') ? (
              <p className="field__message field__message--error" role="alert">
                {nameDialogError}
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Overview Page"
        description={
          workingPage
            ? `Delete "${workingPage.name}" from this machine. This cannot be undone.`
            : ''
        }
        facts={workingPage ? buildDeleteConfirmFacts({ name: workingPage.name, elements: workingPage.elements }) : []}
        confirmLabel="Delete Page"
        cancelLabel="Keep Page"
        danger
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (deletePending) return;
          setDeleteOpen(false);
          setDeleteError(undefined);
        }}
      />

      {/* Save & Exit confirmation */}
      <ConfirmDialog
        open={saveConfirmOpen}
        title="Save Overview Page"
        description={workingPage ? buildSaveConfirmDescription(workingPage.name) : ''}
        facts={
          workingPage
            ? buildSaveConfirmFacts(
                {
                  name: draft?.name ?? workingPage.name,
                  elements: draft?.elements ?? workingPage.elements,
                  revision: baseline?.revision ?? workingPage.revision,
                },
                saveState,
              )
            : []
        }
        confirmLabel="Save & Exit"
        cancelLabel="Cancel"
        pending={saveConfirmPending}
        error={saveConfirmError}
        onConfirm={() => void confirmSaveAndExit()}
        onClose={() => {
          if (saveConfirmPending) return;
          setSaveConfirmOpen(false);
          setSaveConfirmError(undefined);
          // Closing the dialog keeps Edit Mode, keeps the draft; no request.
        }}
      />

      {/* Cancel Changes confirmation (only when a draft exists) */}
      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Discard Overview Changes"
        description={workingPage ? `Discard unsaved changes to "${draft?.name ?? workingPage.name}"?` : ''}
        facts={[
          'The page returns to View Mode',
          'The local draft is restored from the baseline snapshot',
          'No save request is sent',
        ]}
        confirmLabel="Discard Changes"
        cancelLabel="Continue Editing"
        danger
        onConfirm={confirmCancelChanges}
        onClose={() => setCancelConfirmOpen(false)}
      />

      {/* Page switch with unsaved changes */}
      <ConfirmDialog
        open={pendingPageId !== null}
        title="Switch Overview page?"
        description={
          workingPage
            ? `"${draft?.name ?? workingPage.name}" has unsaved local changes. Switching pages discards the draft.`
            : ''
        }
        facts={[
          `Current page: ${workingPage?.name ?? ''}`,
          'Unsaved local draft changes will be discarded',
          'No save request is sent',
        ]}
        confirmLabel="Discard & Switch"
        cancelLabel="Stay on Current Page"
        danger
        onConfirm={confirmPendingPageSwitch}
        onClose={() => setPendingPageId(null)}
      />
    </section>
  );
}
