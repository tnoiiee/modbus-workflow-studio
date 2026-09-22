import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';

import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { OverviewCanvas, fitOverviewView } from './OverviewCanvas.js';
import { OverviewModeBar } from './OverviewModeBar.js';
import { OverviewPageBar } from './OverviewPageBar.js';
import {
  OVERVIEW_DEFAULT_PAGE_ID,
  OVERVIEW_SCAFFOLD_BADGE,
  OVERVIEW_SCAFFOLD_PAGES,
  beginOverviewEdit,
  cancelOverviewEdit,
  finishOverviewSave,
  requiresPageSwitchConfirm,
  type OverviewMode,
  type OverviewSaveState,
} from '../../lib/overviewState.js';

const SAVE_TRANSITION_MS = 150;

/**
 * Overview page shell (checkpoint O1-A).
 *
 * Owns the VIEW/EDIT mode machine, the manual Save & Exit pipeline state,
 * and the local scaffold page selection. No server persistence, no elements,
 * and no runtime bindings exist in this checkpoint — drafts stay client-side
 * until Save & Exit (persistence lands in O1-B, elements in O1-C).
 *
 * Element selection is UI-only and is never persisted.
 */
export function OverviewPage() {
  const [mode, setMode] = useState<OverviewMode>('VIEW');
  const [saveState, setSaveState] = useState<OverviewSaveState>('SAVED');
  const [activePageId, setActivePageId] = useState<string>(OVERVIEW_DEFAULT_PAGE_ID);
  const [pendingPageId, setPendingPageId] = useState<string | null>(null);
  const baselinePageIdRef = useRef<string>(OVERVIEW_DEFAULT_PAGE_ID);
  const saveTimerRef = useRef<number | null>(null);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const page =
    OVERVIEW_SCAFFOLD_PAGES.find((item) => item.id === activePageId) ?? OVERVIEW_SCAFFOLD_PAGES[0]!;

  const handleEdit = useCallback(() => {
    const session = beginOverviewEdit(activePageId);
    baselinePageIdRef.current = session.baselinePageId;
    setSaveState(session.saveState);
    setMode(session.mode);
  }, [activePageId]);

  const handleSaveAndExit = useCallback(() => {
    if (saveTimerRef.current !== null) return;
    setSaveState('SAVING');
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const finished = finishOverviewSave();
      setSaveState(finished.saveState);
      setMode(finished.mode);
    }, SAVE_TRANSITION_MS);
  }, []);

  const handleCancelChanges = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const restored = cancelOverviewEdit(baselinePageIdRef.current);
    setActivePageId(restored.baselinePageId);
    setSaveState(restored.saveState);
    setMode(restored.mode);
    setPendingPageId(null);
  }, []);

  const handleSelectPage = useCallback(
    (nextPageId: string) => {
      if (requiresPageSwitchConfirm(saveState, nextPageId, activePageId)) {
        setPendingPageId(nextPageId);
        return;
      }
      setActivePageId(nextPageId);
    },
    [activePageId, saveState],
  );

  const confirmPendingPageSwitch = useCallback(() => {
    if (pendingPageId) {
      setActivePageId(pendingPageId);
      setSaveState('SAVED');
    }
    setPendingPageId(null);
  }, [pendingPageId]);

  const handleInstanceReady = useCallback((instance: ReactFlowInstance) => {
    flowInstanceRef.current = instance;
  }, []);

  const handleFitView = useCallback(() => {
    fitOverviewView(flowInstanceRef.current);
  }, []);
  const handleZoomIn = useCallback(() => flowInstanceRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => flowInstanceRef.current?.zoomOut(), []);

  // O1-A scaffold: no elements exist yet, so selection is always empty.
  const hasSelection = false;
  const noop = useCallback(() => undefined, []);

  return (
    <section
      className={`overview${mode === 'VIEW' ? ' overview--view' : ' overview--edit'}`}
      aria-label="Overview"
    >
      <div className="overview-bars">
        <OverviewPageBar
          pages={OVERVIEW_SCAFFOLD_PAGES}
          activePageId={page.id}
          onSelectPage={handleSelectPage}
          onNewPage={noop}
          onRenamePage={noop}
          onDuplicatePage={noop}
          onDeletePage={noop}
        />
        <OverviewModeBar
          mode={mode}
          saveState={saveState}
          canUndo={false}
          canRedo={false}
          hasSelection={hasSelection}
          onEdit={handleEdit}
          onSaveAndExit={handleSaveAndExit}
          onCancelChanges={handleCancelChanges}
          onUndo={noop}
          onRedo={noop}
          onFitView={handleFitView}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLockSelected={noop}
          onUnlockSelected={noop}
        />
      </div>

      <div className="overview__workspace">
        <aside className="library overview-panel overview-library" aria-label="Element Library">
          <h3>Element Library</h3>
          <p className="empty">Element Library will be implemented in O1-C</p>
        </aside>

        <OverviewCanvas
          mode={mode}
          designWidth={page.designWidth}
          designHeight={page.designHeight}
          scaffoldBadge={OVERVIEW_SCAFFOLD_BADGE}
          onInstanceReady={handleInstanceReady}
        />

        <aside className="inspector overview-panel overview-inspector" aria-label="Element Inspector">
          <h3>Element Inspector</h3>
          <p className="empty">Element Inspector will be implemented in O1-C</p>
        </aside>
      </div>

      <ConfirmDialog
        open={pendingPageId !== null}
        title="Switch Overview page?"
        description={`"${page.name}" has unsaved local changes. Switching pages discards the draft.`}
        facts={[
          `Current page: ${page.name}`,
          'Unsaved local draft changes will be discarded',
          'O1-A scaffold pages are editor placeholders, not persisted production data',
        ]}
        confirmLabel="Discard & Switch"
        cancelLabel="Stay"
        danger
        onConfirm={confirmPendingPageSwitch}
        onClose={() => setPendingPageId(null)}
      />
    </section>
  );
}
