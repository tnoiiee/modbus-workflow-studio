import { Lock, Maximize, Pencil, Redo2, Save, Undo2, Unlock, X, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '../ui/Button.js';
import { IconButton } from '../ui/IconButton.js';
import { saveIndicatorClass } from '../../lib/saveStatus.js';
import { overviewSaveLabel, type OverviewMode, type OverviewSaveState } from '../../lib/overviewState.js';

export interface OverviewModeBarProps {
  mode: OverviewMode;
  saveState: OverviewSaveState;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onEdit: () => void;
  onSaveAndExit: () => void;
  onCancelChanges: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLockSelected: () => void;
  onUnlockSelected: () => void;
}

/**
 * Overview Mode Bar: VIEW / EDIT modes with the manual save & exit contract.
 *
 * View mode only offers Edit. Edit mode offers Save & Exit, Cancel Changes,
 * and the canvas editing controls. The bar is presentation only; the Overview
 * page owns mode and save-pipeline state.
 */
export function OverviewModeBar({
  mode,
  saveState,
  canUndo,
  canRedo,
  hasSelection,
  onEdit,
  onSaveAndExit,
  onCancelChanges,
  onUndo,
  onRedo,
  onFitView,
  onZoomIn,
  onZoomOut,
  onLockSelected,
  onUnlockSelected,
}: OverviewModeBarProps) {
  const saveLabel = overviewSaveLabel(saveState);

  return (
    <div className="command-bar overview-mode-bar" aria-label="Overview Mode Bar">
      <div className="command-group">
        <span className="command-group__label">Mode</span>
        <div className="command-group__controls">
          <span className="pill pill--accent" aria-label={`Overview mode: ${mode}`}>
            {mode}
          </span>
          {mode === 'VIEW' ? (
            <Button variant="primary" size="sm" icon={<Pencil size={14} />} onClick={onEdit}>
              Edit
            </Button>
          ) : (
            <>
              <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={onSaveAndExit}>
                Save &amp; Exit
              </Button>
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={onCancelChanges}>
                Cancel Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {mode === 'EDIT' ? (
        <div className="command-group">
          <span className="command-group__label">Canvas</span>
          <div className="command-group__controls">
            <IconButton
              label="Undo"
              tooltip="Nothing to undo yet"
              className="btn-icon--editing"
              icon={<Undo2 size={15} />}
              disabled={!canUndo}
              onClick={onUndo}
            />
            <IconButton
              label="Redo"
              tooltip="Nothing to redo yet"
              className="btn-icon--editing"
              icon={<Redo2 size={15} />}
              disabled={!canRedo}
              onClick={onRedo}
            />
            <IconButton
              label="Fit View"
              tooltip="Fit View"
              className="btn-icon--editing"
              icon={<Maximize size={15} />}
              onClick={onFitView}
            />
            <IconButton
              label="Zoom In"
              tooltip="Zoom In"
              className="btn-icon--editing"
              icon={<ZoomIn size={15} />}
              onClick={onZoomIn}
            />
            <IconButton
              label="Zoom Out"
              tooltip="Zoom Out"
              className="btn-icon--editing"
              icon={<ZoomOut size={15} />}
              onClick={onZoomOut}
            />
            <span className="command-divider" aria-hidden="true" />
            <IconButton
              label="Lock Selected"
              tooltip="No element selected"
              icon={<Lock size={15} />}
              disabled={!hasSelection}
              onClick={onLockSelected}
            />
            <IconButton
              label="Unlock Selected"
              tooltip="No element selected"
              icon={<Unlock size={15} />}
              disabled={!hasSelection}
              onClick={onUnlockSelected}
            />
          </div>
        </div>
      ) : null}

      <div className="command-group">
        <span className="command-group__label">Save</span>
        <div className="command-group__controls">
          <span className={saveIndicatorClass(saveLabel)} role="status" aria-live="polite">
            {saveLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
