import { InspectorTransition } from './InspectorTransition.js';
import { overviewInspectorPresentation } from '../../lib/overviewWorkspace.js';
import { previewOverviewFontSize, type FontSizePreview } from '../../lib/overviewFontDraft.js';
import { bindingPresentation, type BindingPresentation } from '../../lib/overviewBinding.js';
import { fetchSourceDefinitions, fetchDefinitionWorkflows } from '../../lib/overviewApi.js';
import type { SourceDefinition, DefinitionWorkflow } from '../../lib/sourceDefinitions.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { Field } from '../ui/Field.js';
import { Modal } from '../ui/Modal.js';
import { Tooltip } from '../ui/Tooltip.js';
import { ElementInspector } from './ElementInspector.js';
import { ElementLibrary } from './ElementLibrary.js';
import {
  OverviewCanvas,
  fitOverviewView,
  OVERVIEW_DEFAULT_VIEWPORT,
  type OverviewViewportSnapshot,
} from './OverviewCanvas.js';
import { OverviewCommandBar } from './OverviewCommandBar.js';
import {
  OVERVIEW_DEFAULT_BACKGROUND,
  OVERVIEW_DEFAULT_HEIGHT,
  OVERVIEW_DEFAULT_WIDTH,
  OVERVIEW_PANEL_TOGGLE_CLASS,
  applyOverviewDraftPatch,
  beginOverviewEdit,
  buildDeleteConfirmFacts,
  buildElementDeleteDescription,
  buildElementDeleteFacts,
  buildSaveConfirmDescription,
  buildSaveConfirmFacts,
  cancelOverviewEdit,
  classifySaveFailure,
  displayedOverviewRevision,
  finishOverviewSave,
  getSessionPanelCollapsed,
  isSaveStatusLastGroup,
  overviewCommandBarGroups,
  overviewDraftMatchesBaseline,
  normalizeOverviewSavedViewport,
  overviewSaveNeedsViewportPut,
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
  canRedoOverview,
  canUndoOverview,
  centerOverviewElementPosition,
  createOverviewElement,
  duplicateOverviewElement,
  emptyOverviewHistory,
  layerOrderFromElements,
  nudgeOverviewElementToFreeSlot,
  normalizeOverviewBindingDirection,
  overviewBringForward,
  overviewBringToFront,
  overviewSendBackward,
  overviewSendToBack,
  pushOverviewHistory,
  redoOverviewHistory,
  snapOverviewCoordinate,
  undoOverviewHistory,
  validateOverviewElements,
  patchOverviewBinding,
  OVERVIEW_TYPE_CATEGORY,
  type OverviewDraftHistory,
  type OverviewElement,
  type OverviewElementType,
} from '../../lib/overviewElements.js';
import {
  createOverviewPage,
  deleteOverviewPage,
  duplicateOverviewPage,
  fetchOverviewPage,
  fetchOverviewPages,
  patchOverviewControlState,
  fetchOverviewControlStates,
  renameOverviewPage,
  updateOverviewPage,
  type OverviewControlStateRecord,
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

function asElements(page: OverviewPageRecord | null): OverviewElement[] {
  return (page?.elements ?? []) as unknown as OverviewElement[];
}

/**
 * Overview page shell (O1-A + O1-B + O1-C).
 *
 * Owns VIEW/EDIT mode, the Element draft/undo stack, the manual revision-aware
 * Save & Exit pipeline, page CRUD dialogs, and session-scoped panel collapse.
 * Persistence goes through `/api/overview-pages` only.
 */
export function OverviewPage({ active = true, onNavigateWorkflow, onOpenDataSources }: { active?: boolean; onOpenDataSources?: () => void; onNavigateWorkflow?: (targetWorkflowId?: string) => Promise<void> } = {}) {
  // Catalog refresh is presentation state only: never patch Page/Draft/history.
  const [definitions, setDefinitions] = useState<SourceDefinition[]>([]);
  const [definitionWorkflows, setDefinitionWorkflows] = useState<DefinitionWorkflow[]>([]);
  const [catalogAvailable, setCatalogAvailable] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const catalogRequest = useRef(0);
  const refreshCatalog = useCallback(async () => {
    const request = ++catalogRequest.current;
    setCatalogAvailable(false); setCatalogError('');
    try {
      const [sources, workflows] = await Promise.all([fetchSourceDefinitions(), fetchDefinitionWorkflows()]);
      if (request !== catalogRequest.current) return;
      setDefinitions(sources); setDefinitionWorkflows(workflows); setCatalogAvailable(true);
    } catch (cause) {
      if (request === catalogRequest.current) setCatalogError(cause instanceof Error ? cause.message : 'Catalog unavailable');
    }
  }, []);
  useEffect(() => {
    if (!active) return;
    void refreshCatalog();
    const refresh = () => { void refreshCatalog(); };
    window.addEventListener('focus', refresh);
    return () => { ++catalogRequest.current; window.removeEventListener('focus', refresh); };
  }, [active, refreshCatalog]);
  const [pages, setPages] = useState<OverviewPageSummary[]>([]);
  const [activePageId, setActivePageId] = useState('');
  const [activePage, setActivePage] = useState<OverviewPageRecord | null>(null);
  const [mode, setMode] = useState<OverviewMode>('VIEW');
  const [saveState, setSaveState] = useState<OverviewSaveState>('SAVED');
  const [baseline, setBaseline] = useState<OverviewPageRecord | null>(null);
  const [draft, setDraft] = useState<OverviewPageRecord | null>(null);
  const [loadError, setLoadError] = useState<string>();
  /** Control-specific error feedback (never Editor CONFLICT / loadError). */
  const [controlError, setControlError] = useState<string>();
  /** Independent View-mode Control-state records keyed by Element id. */
  const [controlStates, setControlStates] = useState<Record<string, OverviewControlStateRecord>>({});

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

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [fontSizePreview, setFontSizePreview] = useState<FontSizePreview | null>(null);
  const [history, setHistory] = useState<OverviewDraftHistory>(() => emptyOverviewHistory());

  // Element delete confirmation (all paths route through this dialog).
  const [elementDeleteTarget, setElementDeleteTarget] = useState<OverviewElement | null>(null);

  // Session viewport — preserved across App navigation (memory only).
  const [viewport, setViewport] = useState<OverviewViewportSnapshot>(OVERVIEW_DEFAULT_VIEWPORT);
  const [restoreViewportEpoch, setRestoreViewportEpoch] = useState(0);

  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const activePageIdRef = useRef('');
  activePageIdRef.current = activePageId;
  const activeRef = useRef(active);
  // Coalesce a continuous resize gesture into a single undo entry.
  const resizeGestureRef = useRef<string | null>(null);
  // VIEW-mode control PATCH in-flight guard (one request per Element id).
  const controlInFlightRef = useRef<Set<string>>(new Set());
  // Page identity for discarding Control-state responses after a page switch.
  const controlPageIdRef = useRef<string>('');

  const groups = overviewCommandBarGroups(mode);
  const workingPage = draft ?? activePage;
  const dirty = shouldConfirmCancel(saveState);
  const revision = displayedOverviewRevision(baseline?.revision ?? activePage?.revision);
  const draftElements = asElements(draft);
  const selectedElement = draftElements.find(el => el.id === selectedElementId) ?? null;
  const previewFontSize = useCallback((fontSize: number | null) => {
    setFontSizePreview(fontSize !== null && selectedElementId && mode === 'EDIT'
      ? { elementId: selectedElementId, fontSize } : null);
  }, [selectedElementId, mode]);
  const canvasElements = useMemo(() => previewOverviewFontSize(draftElements,
    active && fontSizePreview?.elementId === selectedElementId ? fontSizePreview : null, mode),
  [draft?.elements, fontSizePreview, selectedElementId, mode, active]);

  const previousPresentation = useRef<BindingPresentation>();
  const bindingResolutions = useMemo(() => {
    const next = bindingPresentation(asElements(workingPage), { definitions, available: catalogAvailable }, previousPresentation.current);
    previousPresentation.current = next;
    return next.resolutions;
  }, [workingPage?.elements, definitions, catalogAvailable]);
  const handleNavigateWorkflow = useCallback(async (targetWorkflowId?: string) => {
    if (mode !== 'VIEW') return;
    setControlError(undefined);
    try {
      if (!onNavigateWorkflow) throw Error('Workflow navigation is unavailable.');
      await onNavigateWorkflow(targetWorkflowId);
    } catch (cause) { setControlError(cause instanceof Error ? cause.message : 'Missing Workflow target.'); }
  }, [mode, onNavigateWorkflow]);


  /* ---- page list loading ------------------------------------------------ */

  const loadPages = useCallback(async (preferId?: string) => {
    try {
      const list = await fetchOverviewPages();
      setPages(list);
      setLoadError(undefined);
      const remembered = (() => {
        try {
          return localStorage.getItem('mws.activeOverviewPageId') ?? undefined;
        } catch {
          return undefined;
        }
      })();
      const preferred =
        preferId && list.some(item => item.id === preferId)
          ? preferId
          : remembered && list.some(item => item.id === remembered)
            ? remembered
            : undefined;
      const requested = preferred ?? list[0]?.id;
      if (!requested) {
        setActivePage(null);
        setBaseline(null);
        setDraft(null);
        return;
      }
      if (requested !== activePageIdRef.current) {
        setActivePageId(requested);
        try {
          localStorage.setItem('mws.activeOverviewPageId', requested);
        } catch {
          void 0;
        }
        const record = await fetchOverviewPage(requested);
        setActivePage(record);
        setBaseline(record);
        setDraft(record);
        setSelectedElementId(null);
        setHistory(emptyOverviewHistory());
        setSaveState('SAVED');
        setMode('VIEW');
        // Refresh: restore persisted savedViewport with duration 0 — no Fit View.
        setViewport(normalizeOverviewSavedViewport(record.savedViewport));
        setRestoreViewportEpoch(token => token + 1);
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

  // Independent fetch on page identity changes; configuration remains untouched.
  controlPageIdRef.current = activePageId;
  useEffect(() => {
    let cancelled = false;
    setControlStates({});
    setControlError(undefined);
    if (activePageId) void fetchOverviewControlStates(activePageId).then(records => {
      if (!cancelled) setControlStates(current => ({
        ...Object.fromEntries(records.map(record => [record.elementId, record])),
        ...current,
      }));
    }).catch(error => {
      if (!cancelled) setControlError(error instanceof Error ? error.message : 'Unable to load control states');
    });
    return () => { cancelled = true; };
  }, [activePageId]);

  // Persist only navigation identity: active Overview Page ID.
  useEffect(() => {
    if (!activePageId) return;
    try {
      localStorage.setItem('mws.activeOverviewPageId', activePageId);
    } catch {
      void 0;
    }
  }, [activePageId]);

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
    setSelectedElementId(null);
    setHistory(emptyOverviewHistory());
  }, [activePage]);

  const openSaveConfirm = useCallback(() => {
    if (mode !== 'EDIT') return;
    setSaveConfirmError(undefined);
    setSaveConfirmPending(false);
    setSaveConfirmOpen(true);
  }, [mode]);

  const confirmSaveAndExit = useCallback(async () => {
    if (!workingPage || saveConfirmPending) return;
    // Client-side element validation before any network request.
    const validationErrors = validateOverviewElements(
      { id: workingPage.id, layerOrder: draft?.layerOrder ?? [] },
      asElements(draft),
    );
    if (validationErrors.length > 0) {
      setSaveConfirmError(`Cannot save: ${validationErrors.length} validation error(s). ${validationErrors.join(' · ')}`);
      setSaveConfirmPending(false);
      return;
    }
    setSaveConfirmPending(true);
    setSaveConfirmError(undefined);
    const sessionViewport = normalizeOverviewSavedViewport(viewport);
    const baselineViewport = normalizeOverviewSavedViewport(baseline?.savedViewport);
    const draftUnchanged = overviewDraftMatchesBaseline(baseline, draft);
    const needsPut = overviewSaveNeedsViewportPut(baseline, draft, sessionViewport);
    // Unchanged draft AND viewport: no PUT, revision unchanged.
    if (!needsPut && draftUnchanged && baseline) {
      const finished = finishOverviewSave(baseline);
      setActivePage(finished.baseline);
      setBaseline(finished.baseline);
      setDraft(finished.draft);
      setSaveState(finished.saveState);
      setMode(finished.mode);
      setSaveConfirmOpen(false);
      setSaveConfirmPending(false);
      setSelectedElementId(null);
      setHistory(emptyOverviewHistory());
      setViewport(baselineViewport);
      setRestoreViewportEpoch(token => token + 1);
      return;
    }
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
        // Viewport-only change counts as a changed page — one PUT, one bump.
        savedViewport: sessionViewport,
      });
      const finished = finishOverviewSave(saved);
      setActivePage(saved);
      setBaseline(finished.baseline);
      setDraft(finished.draft);
      setSaveState(finished.saveState);
      setMode(finished.mode);
      setSaveConfirmOpen(false);
      setSaveConfirmPending(false);
      setSelectedElementId(null);
      setHistory(emptyOverviewHistory());
      setViewport(normalizeOverviewSavedViewport(saved.savedViewport));
      setRestoreViewportEpoch(token => token + 1);
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
      // Stay in Edit Mode, keep the draft, keep the dialog open. No auto-retry.
    }
  }, [baseline, draft, saveConfirmPending, viewport, workingPage]);

  const requestCancelChanges = useCallback(() => {
    if (mode !== 'EDIT') return;
    if (!dirty) {
      if (!baseline) return;
      const restored = cancelOverviewEdit(baseline);
      setDraft(restored.draft);
      setSaveState(restored.saveState);
      setMode(restored.mode);
      setCancelConfirmOpen(false);
      setSelectedElementId(null);
      setHistory(emptyOverviewHistory());
      // Cancel restores baseline savedViewport — session-only viewport never persists.
      setViewport(normalizeOverviewSavedViewport(baseline.savedViewport));
      setRestoreViewportEpoch(token => token + 1);
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
    setSelectedElementId(null);
    setHistory(emptyOverviewHistory());
    setViewport(normalizeOverviewSavedViewport(baseline.savedViewport));
    setRestoreViewportEpoch(token => token + 1);
  }, [baseline]);

  /* ---- page CRUD -------------------------------------------------------- */

  const openCreateDialog = useCallback(() => {
    if (mode === 'EDIT') return;
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
  }, [mode]);

  const openRenameDialog = useCallback(() => {
    if (mode === 'EDIT') return;
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
  }, [mode, workingPage]);

  const openDuplicateDialog = useCallback(() => {
    if (mode === 'EDIT') return;
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
  }, [mode, pages, workingPage]);

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
    if (mode === 'EDIT') return;
    if (pages.length <= 1 || !workingPage) return;
    setDeleteError(undefined);
    setDeletePending(false);
    setDeleteOpen(true);
  }, [mode, pages.length, workingPage]);

  const confirmDelete = useCallback(async () => {
    if (!workingPage || deletePending) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await deleteOverviewPage(workingPage.id);
      setDeleteOpen(false);
      if (mode === 'EDIT') {
        setMode('VIEW');
        setSaveState('SAVED');
      }
      setDraft(null);
      setBaseline(null);
      setActivePage(null);
      setActivePageId('');
      setSelectedElementId(null);
      setHistory(emptyOverviewHistory());
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
        setSelectedElementId(null);
        setHistory(emptyOverviewHistory());
        setViewport(normalizeOverviewSavedViewport(record.savedViewport));
        setRestoreViewportEpoch(token => token + 1);
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
    setSaveState('SAVED');
    void (async () => {
      try {
        const record = await fetchOverviewPage(nextPageId);
        setActivePageId(nextPageId);
        setActivePage(record);
        setBaseline(record);
        setDraft(record);
        setSelectedElementId(null);
        setHistory(emptyOverviewHistory());
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to open Overview page');
      }
    })();
  }, [pendingPageId]);

  /* ---- element draft mutations ------------------------------------------ */

  const applyElementMutation = useCallback(
    (
      mutate: (elements: OverviewElement[]) => OverviewElement[],
      options?: { select?: string | null; pushHistory?: boolean },
    ) => {
      if (!draft || mode !== 'EDIT') return;
      const current = asElements(draft);
      const nextElements = mutate(current.map(el => ({ ...el })));
      if (options && 'select' in options) {
        setSelectedElementId(options.select ?? null);
      }
      // No-op mutations never enter the undo stack or dirty the draft.
      if (JSON.stringify(nextElements) === JSON.stringify(current)) return;
      const nextLayer = layerOrderFromElements(nextElements);
      const nextDraft: OverviewPageRecord = {
        ...draft,
        elements: nextElements as unknown as OverviewPageRecord['elements'],
        layerOrder: nextLayer,
      };
      if (options?.pushHistory !== false) {
        setHistory(hist => pushOverviewHistory(hist, current));
      }
      setDraft(nextDraft);
      setSaveState(overviewDraftMatchesBaseline(baseline, nextDraft) ? 'SAVED' : 'UNSAVED');
    },
    [baseline, draft, mode],
  );

  const handleAddElement = useCallback(
    (type: OverviewElementType) => {
      if (!draft || mode !== 'EDIT') return;
      const instance = flowInstanceRef.current;
      const canvasEl = document.querySelector('.overview-canvas');
      if (!instance || !canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const center = instance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      const id = crypto.randomUUID();
      const existing = asElements(draft);
      const probe = createOverviewElement(type, { id, x: 0, y: 0, existing });
      const base = centerOverviewElementPosition(center, probe);
      const bounds = {
        width: draft.designWidth ?? workingPage?.designWidth ?? 1024,
        height: draft.designHeight ?? workingPage?.designHeight ?? 768,
      };
      const position = nudgeOverviewElementToFreeSlot(
        { x: base.x, y: base.y },
        { width: probe.width, height: probe.height },
        existing,
        undefined,
        undefined,
        bounds,
      );
      if (!position) {
        // Custom UI error — never place an overlapping Element as fallback.
        setLoadError(
          `No free space on the Design Canvas to add ${probe.name}. Move or remove an Element and try again.`,
        );
        return;
      }
      setLoadError(undefined);
      const element = createOverviewElement(type, {
        id,
        x: position.x,
        y: position.y,
        zIndex: existing.length + 1,
        existing,
      });
      applyElementMutation(elements => [...elements, element], { select: id });
    },
    [applyElementMutation, draft, mode, workingPage],
  );

  const handleMoveElement = useCallback(
    (id: string, x: number, y: number) => {
      applyElementMutation(elements =>
        elements.map(el => (el.id === id && !el.locked ? { ...el, x, y } : el)),
      );
    },
    [applyElementMutation],
  );

  const handleResizeElement = useCallback(
    (
      id: string,
      geometry: { x: number; y: number; width: number; height: number },
    ) => {
      // Parent receives ONE complete geometry at gesture end (canvas contract).
      // Snap final values once → one Draft mutation → one Undo entry.
      const firstFrame = resizeGestureRef.current !== id;
      resizeGestureRef.current = id;
      const snappedX = snapOverviewCoordinate(geometry.x);
      const snappedY = snapOverviewCoordinate(geometry.y);
      const width = Math.max(1, snapOverviewCoordinate(geometry.width));
      const height = Math.max(1, snapOverviewCoordinate(geometry.height));
      applyElementMutation(
        elements =>
          elements.map(el =>
            el.id === id && !el.locked && width > 0 && height > 0
              ? { ...el, x: snappedX, y: snappedY, width, height }
              : el,
          ),
        { pushHistory: firstFrame },
      );
    },
    [applyElementMutation],
  );

  // Clear resize gesture marker after pointer release (canvas already committed once).
  useEffect(() => {
    const endGesture = () => {
      resizeGestureRef.current = null;
    };
    window.addEventListener('pointerup', endGesture);
    return () => window.removeEventListener('pointerup', endGesture);
  }, []);

  const patchSelectedElement = useCallback(
    (patch: Partial<OverviewElement>) => {
      if (!selectedElementId) return;
      applyElementMutation(elements =>
        elements.map(el => {
          if (el.id !== selectedElementId || el.locked) return el;
          const nextType = patch.type ?? el.type;
          const nextCategory = patch.category ?? OVERVIEW_TYPE_CATEGORY[nextType] ?? el.category;
          const next: OverviewElement = {
            ...el,
            ...patch,
            id: el.id,
            type: nextType,
            category: nextCategory,
          };
          // Type/category change must normalize Binding Direction to a valid value.
          if (patch.type !== undefined || patch.category !== undefined) {
            next.binding = {
              ...el.binding,
              direction: normalizeOverviewBindingDirection(nextCategory, el.binding.direction),
            };
            if (nextType === 'NAVIGATION_LINK') {
              next.binding = { tagId: '', tagName: '', dataType: 'Unknown', direction: 'NONE', status: 'NOT_BOUND' };
            } else if (nextType !== el.type) {
              delete next.targetWorkflowId;
            }
          }
          return next;
        }),
      );
    },
    [applyElementMutation, selectedElementId],
  );

  const patchSelectedStyle = useCallback(
    (patch: Partial<OverviewElement['style']>) => {
      if (!selectedElementId) return;
      applyElementMutation(elements =>
        elements.map(el =>
          el.id === selectedElementId && !el.locked ? { ...el, style: { ...el.style, ...patch } } : el,
        ),
      );
    },
    [applyElementMutation, selectedElementId],
  );

  const patchSelectedBinding = useCallback(
    (patch: Partial<OverviewElement['binding']>) => {
      if (!selectedElementId) return;
      applyElementMutation(elements =>
        elements.map(el => {
          if (el.id !== selectedElementId || el.locked) return el;
          const nextBinding = patchOverviewBinding(el.category, el.binding, patch);
          return { ...el, binding: nextBinding };
        }),
      );
    },
    [applyElementMutation, selectedElementId],
  );

  const handleToggleLock = useCallback(() => {
    if (!selectedElementId) return;
    applyElementMutation(elements =>
      elements.map(el => (el.id === selectedElementId ? { ...el, locked: !el.locked } : el)),
    );
  }, [applyElementMutation, selectedElementId]);

  const handleToggleVisible = useCallback(() => {
    if (!selectedElementId) return;
    applyElementMutation(elements =>
      elements.map(el => (el.id === selectedElementId ? { ...el, visible: !el.visible } : el)),
    );
  }, [applyElementMutation, selectedElementId]);

  const requestDeleteElement = useCallback(() => {
    if (!selectedElementId) return;
    const target = asElements(draft).find(el => el.id === selectedElementId);
    if (!target || target.locked) return;
    setElementDeleteTarget(target);
  }, [draft, selectedElementId]);

  const confirmDeleteElement = useCallback(() => {
    if (!elementDeleteTarget) return;
    const id = elementDeleteTarget.id;
    applyElementMutation(elements => elements.filter(el => el.id !== id), { select: null });
    setElementDeleteTarget(null);
  }, [applyElementMutation, elementDeleteTarget]);

  const cancelDeleteElement = useCallback(() => {
    // Keep Element + selection; no history entry; no request.
    setElementDeleteTarget(null);
  }, []);

  const handleDeleteElement = requestDeleteElement;

  const handleDuplicateElement = useCallback(() => {
    if (!selectedElementId) return;
    const newId = crypto.randomUUID();
    applyElementMutation(
      elements => {
        const result = duplicateOverviewElement(elements, selectedElementId, newId);
        return result ? result.elements : elements;
      },
      { select: newId },
    );
  }, [applyElementMutation, selectedElementId]);

  const applyLayerOp = useCallback(
    (op: (elements: OverviewElement[], id: string) => OverviewElement[]) => {
      if (!selectedElementId) return;
      applyElementMutation(elements => op(elements, selectedElementId));
    },
    [applyElementMutation, selectedElementId],
  );

  const handleUndo = useCallback(() => {
    if (!draft) return;
    const result = undoOverviewHistory(history, asElements(draft));
    if (!result) return;
    const nextDraft: OverviewPageRecord = {
      ...draft,
      elements: result.value as unknown as OverviewPageRecord['elements'],
      layerOrder: layerOrderFromElements(result.value),
    };
    setHistory(result.history);
    setDraft(nextDraft);
    setSaveState(overviewDraftMatchesBaseline(baseline, nextDraft) ? 'SAVED' : 'UNSAVED');
    if (selectedElementId && !result.value.some(el => el.id === selectedElementId)) {
      setSelectedElementId(null);
    }
  }, [baseline, draft, history, selectedElementId]);

  const handleRedo = useCallback(() => {
    if (!draft) return;
    const result = redoOverviewHistory(history, asElements(draft));
    if (!result) return;
    const nextDraft: OverviewPageRecord = {
      ...draft,
      elements: result.value as unknown as OverviewPageRecord['elements'],
      layerOrder: layerOrderFromElements(result.value),
    };
    setHistory(result.history);
    setDraft(nextDraft);
    setSaveState(overviewDraftMatchesBaseline(baseline, nextDraft) ? 'SAVED' : 'UNSAVED');
    if (selectedElementId && !result.value.some(el => el.id === selectedElementId)) {
      setSelectedElementId(null);
    }
  }, [baseline, draft, history, selectedElementId]);

  // Canvas keyboard delete — locked elements are never removed.
  useEffect(() => {
    if (mode !== 'EDIT' || !selectedElementId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const el = asElements(draft).find(item => item.id === selectedElementId);
        if (!el || el.locked) return;
        event.preventDefault();
        handleDeleteElement();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [draft, handleDeleteElement, mode, selectedElementId]);

  /* ---- canvas controls -------------------------------------------------- */

  // Restore the exact stored viewport whenever Overview becomes visible again.
  useEffect(() => {
    if (!active) return;
    activeRef.current = true;
    setRestoreViewportEpoch(token => token + 1);
  }, [active]);

  const handleInstanceReady = useCallback((instance: ReactFlowInstance) => {
    flowInstanceRef.current = instance;
  }, []);
  const handleViewportChange = useCallback((next: OverviewViewportSnapshot) => {
    setViewport(next);
  }, []);
  const handleFitView = useCallback(() => fitOverviewView(flowInstanceRef.current), []);
  const handleZoomIn = useCallback(() => flowInstanceRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => flowInstanceRef.current?.zoomOut(), []);

  /**
   * VIEW-mode Control persistence — independent Control-state PATCH only.
   * Never touches page.revision, Draft, dirty, undo/redo, selection, or Edit Mode.
   * No expectedRevision; no Page 409 recovery reload.
   */
  const handleControlStateChange = useCallback(
    async (elementId: string, value: boolean): Promise<{ ok: true } | { ok: false; conflict: boolean; message: string }> => {
      if (mode === 'EDIT') {
        return { ok: false, conflict: false, message: 'Exit Edit Mode to use control preview' };
      }
      const pageId = controlPageIdRef.current || activePageId;
      if (!pageId) return { ok: false, conflict: false, message: 'Overview page is not loaded' };
      // One in-flight mutation per Element — block rapid duplicate toggles.
      if (controlInFlightRef.current.has(`${pageId}:${elementId}`)) {
        return { ok: false, conflict: false, message: 'Control update already in progress' };
      }
      controlInFlightRef.current.add(`${pageId}:${elementId}`);
      try {
        const result = await patchOverviewControlState(pageId, elementId, value);
        // Discard if the user switched Overview Pages while the request was open.
        if (controlPageIdRef.current === pageId) {
          setControlStates(prev => ({ ...prev, [result.elementId]: result }));
          setControlError(undefined);
        }
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to persist control state';
        // Control-specific feedback only — never Editor CONFLICT, never Page reload.
        if (controlPageIdRef.current === pageId) {
          setControlError(message);
        }
        return { ok: false, conflict: false, message };
      } finally {
        controlInFlightRef.current.delete(`${pageId}:${elementId}`);
      }
    },
    [activePageId, mode],
  );

  const panelFocusRef = useRef<'library' | 'inspector' | null>(null);
  const overviewRootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = panelFocusRef.current;
    if (!panel) return;
    overviewRootRef.current?.querySelector<HTMLButtonElement>(
      `[aria-label="${(panel === 'library' ? libraryCollapsed : inspectorCollapsed) ? 'Expand' : 'Collapse'} Element ${panel === 'library' ? 'Library' : 'Inspector'}"]`,
    )?.focus();
    panelFocusRef.current = null;
  }, [libraryCollapsed, inspectorCollapsed]);

  const handleToggleLibrary = useCallback(() => {
    panelFocusRef.current = 'library';
    setLibraryCollapsed(current => {
      const next = toggleOverviewPanel(current);
      setSessionPanelCollapsed('library', next);
      return next;
    });
  }, []);
  const handleToggleInspector = useCallback(() => {
    panelFocusRef.current = 'inspector';
    setInspectorCollapsed(current => {
      const next = toggleOverviewPanel(current);
      setSessionPanelCollapsed('inspector', next);
      return next;
    });
  }, []);

  const hasSelection = Boolean(selectedElementId);
  const canDeletePage = pages.length > 1 && Boolean(workingPage);

  const inspectorPresentation = overviewInspectorPresentation(mode, selectedElement?.id ?? null, inspectorCollapsed);
  const workspaceClass = [
    'overview__workspace overview__workspace--motion',
    libraryCollapsed && mode === 'EDIT' ? 'overview__workspace--library-collapsed' : '',
    inspectorPresentation === 'hidden' ? 'overview__workspace--inspector-hidden' : '',
    inspectorPresentation === 'collapsed' ? 'overview__workspace--inspector-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inspectorHandlers = useMemo(
    () => ({
      onPatch: patchSelectedElement,
      onPatchStyle: patchSelectedStyle,
      onPatchBinding: patchSelectedBinding,
      onToggleLock: handleToggleLock,
      onToggleVisible: handleToggleVisible,
      onDuplicate: handleDuplicateElement,
      onDelete: handleDeleteElement,
      onBringForward: () => applyLayerOp(overviewBringForward),
      onBringToFront: () => applyLayerOp(overviewBringToFront),
      onSendBackward: () => applyLayerOp(overviewSendBackward),
      onSendToBack: () => applyLayerOp(overviewSendToBack),
    }),
    [
      applyLayerOp,
      handleDeleteElement,
      handleDuplicateElement,
      handleToggleLock,
      handleToggleVisible,
      patchSelectedBinding,
      patchSelectedElement,
      patchSelectedStyle,
    ],
  );

  return (
    <section
      className={`overview${mode === 'VIEW' ? ' overview--view' : ' overview--edit'}`}
      ref={overviewRootRef}
      aria-label="Overview"
      data-command-groups={groups.join(',')}
      data-save-status-last={isSaveStatusLastGroup(mode) ? 'true' : 'false'}
    >
      <div className="overview-bars">
        <div className="overview-catalog-bar">
          <button type="button" onClick={() => void refreshCatalog()}>Refresh Source definitions</button>
          {onOpenDataSources && <button type="button" onClick={onOpenDataSources}>Data Sources</button>}
          <span>Configuration only · No Monitoring or Control Runtime</span>
          {catalogError && <span role="alert">{catalogError}</span>}
        </div>
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
          revision={revision}
          onEdit={enterEdit}
          onSaveAndExit={openSaveConfirm}
          onCancelChanges={requestCancelChanges}
          canUndo={canUndoOverview(history)}
          canRedo={canRedoOverview(history)}
          hasSelection={hasSelection}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onFitView={handleFitView}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLockSelected={() => {
            if (selectedElement && !selectedElement.locked) handleToggleLock();
          }}
          onUnlockSelected={() => {
            if (selectedElement?.locked) handleToggleLock();
          }}
          onDeleteSelected={() => {
            if (selectedElement && !selectedElement.locked) requestDeleteElement();
          }}
        />
      </div>

      {loadError ? (
        <div className="notice overview-notice" role="alert">
          {loadError}
        </div>
      ) : null}
      {controlError && mode !== 'EDIT' ? (
        <div className="notice overview-notice" role="alert" data-control-error="true">
          {controlError}
        </div>
      ) : null}

      <div className={workspaceClass}>
        {mode === 'EDIT' && libraryCollapsed ? (
          <div className="overview-rail overview-rail--library">
            <Tooltip label="Expand Element Library">
              <button
                type="button"
                className={OVERVIEW_PANEL_TOGGLE_CLASS}
                aria-label="Expand Element Library"
                aria-expanded={false}
                onClick={handleToggleLibrary}
              >
                <PanelLeftOpen size={16} />
              </button>
            </Tooltip>
            <span className="overview-rail__marker" aria-hidden="true">
              Elements
            </span>
          </div>
        ) : (
          <aside className="library overview-panel overview-library" aria-label="Element Library">
            <div className="overview-panel__head">
              <h3>Element Library</h3>
              {mode === 'EDIT' ? (
                <Tooltip label="Collapse Element Library">
                  <button
                    type="button"
                    className={OVERVIEW_PANEL_TOGGLE_CLASS}
                    aria-label="Collapse Element Library"
                    aria-expanded={true}
                    onClick={handleToggleLibrary}
                  >
                    <PanelLeftClose size={16} />
                  </button>
                </Tooltip>
              ) : null}
            </div>
            {mode === 'EDIT' ? (
              <ElementLibrary onAddElement={handleAddElement} />
            ) : (
              <p className="empty">Element Library is available in Edit Mode</p>
            )}
          </aside>
        )}

        <OverviewCanvas
          bindingResolutions={bindingResolutions}
          onNavigateWorkflow={handleNavigateWorkflow}
          mode={mode}
          designWidth={workingPage?.designWidth ?? OVERVIEW_DEFAULT_WIDTH}
          designHeight={workingPage?.designHeight ?? OVERVIEW_DEFAULT_HEIGHT}
          backgroundColor={workingPage?.backgroundColor ?? OVERVIEW_DEFAULT_BACKGROUND}
          elements={canvasElements}
          selectedElementId={selectedElementId}
          viewport={viewport}
          onViewportChange={handleViewportChange}
          restoreViewportEpoch={restoreViewportEpoch}
          onSelectElement={setSelectedElementId}
          onMoveElement={handleMoveElement}
          onResizeElement={handleResizeElement}
          onInstanceReady={handleInstanceReady}
          onControlStateChange={handleControlStateChange}
          controlStates={mode === 'EDIT' ? undefined : Object.fromEntries(Object.entries(controlStates).filter(([, record]) => record.pageId === activePageId))}
        />

        <InspectorTransition visible={inspectorPresentation !== 'hidden'} onReturnFocus={() => {
          overviewRootRef.current?.querySelector<HTMLElement>('.overview-canvas')?.focus({ preventScroll: true });
        }}>
        {inspectorPresentation === 'hidden' ? null : inspectorPresentation === 'collapsed' ? (
          <div className="overview-rail overview-rail--inspector">
            <Tooltip label="Expand Element Inspector">
              <button
                type="button"
                className={OVERVIEW_PANEL_TOGGLE_CLASS}
                aria-label="Expand Element Inspector"
                aria-expanded={false}
                onClick={handleToggleInspector}
              >
                <PanelRightOpen size={16} />
              </button>
            </Tooltip>
            <span className="overview-rail__marker" aria-hidden="true">
              Inspector
            </span>
          </div>
        ) : (
          <aside className="inspector overview-panel overview-inspector" aria-label="Element Inspector">
            <div className="overview-panel__head">
              <h3>Element Inspector</h3>
              {mode === 'EDIT' ? (
                <Tooltip label="Collapse Element Inspector">
                  <button
                    type="button"
                    className={OVERVIEW_PANEL_TOGGLE_CLASS}
                    aria-label="Collapse Element Inspector"
                    aria-expanded={true}
                    onClick={handleToggleInspector}
                  >
                    <PanelRightClose size={16} />
                  </button>
                </Tooltip>
              ) : null}
            </div>
            {mode === 'EDIT' ? (
              <ElementInspector key={selectedElement?.id ?? 'empty'} onPreviewFontSize={previewFontSize} definitions={definitions} workflows={definitionWorkflows} resolution={selectedElement ? bindingResolutions[selectedElement.id] : undefined} element={selectedElement} {...inspectorHandlers} />
            ) : (
              <p className="empty">Element Inspector is available in Edit Mode</p>
            )}
          </aside>
        )}
        </InspectorTransition>
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
            ? `Delete \"${workingPage.name}\" from this machine. This cannot be undone.`
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
        }}
      />

      {/* Cancel Changes confirmation (only when a draft exists) */}
      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Discard Overview Changes"
        description={workingPage ? `Discard unsaved changes to \"${draft?.name ?? workingPage.name}\"?` : ''}
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
            ? `\"${draft?.name ?? workingPage.name}\" has unsaved local changes. Switching pages discards the draft.`
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

      {/* Element delete confirmation — every user-initiated delete path */}
      <ConfirmDialog
        open={elementDeleteTarget !== null}
        title="Delete Overview Element"
        description={elementDeleteTarget ? buildElementDeleteDescription(elementDeleteTarget.name) : ''}
        facts={elementDeleteTarget ? buildElementDeleteFacts(elementDeleteTarget, bindingResolutions[elementDeleteTarget.id]?.status) : []}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDeleteElement}
        onClose={cancelDeleteElement}
      />
    </section>
  );
}
