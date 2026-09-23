import { Copy, Lock, Maximize, Pencil, Plus, Redo2, Save, Trash2, Undo2, Unlock, X, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '../ui/Button.js';
import { IconButton } from '../ui/IconButton.js';
import { saveIndicatorClass } from '../../lib/saveStatus.js';
import {
  overviewRevisionLabel,
  overviewSaveLabel,
  pageCrudDisabledInMode,
  pageCrudTooltip,
  type OverviewMode,
  type OverviewSaveState,
} from '../../lib/overviewState.js';

export interface OverviewCommandBarPage {
  id: string;
  name: string;
}

export interface OverviewCommandBarProps {
  pages: readonly OverviewCommandBarPage[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onNewPage: () => void;
  onRenamePage: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
  /** Delete is blocked while only one page remains. */
  canDeletePage: boolean;

  mode: OverviewMode;
  saveState: OverviewSaveState;
  /** Last known persisted revision of the active Overview page. */
  revision: number;
  onEdit: () => void;
  onSaveAndExit: () => void;
  onCancelChanges: () => void;

  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLockSelected: () => void;
  onUnlockSelected: () => void;
  /** Opens the Element delete confirmation for the current selection. */
  onDeleteSelected: () => void;
}

/**
 * Overview Command Bar — single combined bar (O1-B polish).
 *
 * Groups in order: PAGE, MODE, EDIT ACTIONS (Edit mode only), SAVE STATUS
 * (always logically last, pushed to the far right when space allows).
 *
 * Page CRUD is locked in Edit Mode (disabled + Edit-priority tooltip) so a
 * draft session cannot open page modals or issue page API requests.
 * Presentation only: every control forwards to the Overview page owner.
 */
export function OverviewCommandBar({
  pages,
  activePageId,
  onSelectPage,
  onNewPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  canDeletePage,
  mode,
  saveState,
  revision,
  onEdit,
  onSaveAndExit,
  onCancelChanges,
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onFitView,
  onZoomIn,
  onZoomOut,
  onLockSelected,
  onUnlockSelected,
  onDeleteSelected,
}: OverviewCommandBarProps) {
  const saveLabel = overviewSaveLabel(saveState);
  const edit = mode === 'EDIT';
  const crudLocked = pageCrudDisabledInMode(mode);
  const noPages = pages.length === 0;

  return (
    <div className="command-bar overview-command-bar" aria-label="Overview Command Bar">
      <div className="command-group overview-command-bar__group" data-overview-group="PAGE">
        <span className="command-group__label">Page</span>
        <div className="command-group__controls">
          <select
            className="workflow-selector overview-page-select"
            aria-label="Overview page"
            value={activePageId}
            onChange={(event) => onSelectPage(event.target.value)}
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          <IconButton
            label="New page"
            tooltip={pageCrudTooltip(mode, 'new', canDeletePage)}
            icon={<Plus size={15} />}
            disabled={crudLocked}
            onClick={onNewPage}
          />
          <IconButton
            label="Rename page"
            tooltip={pageCrudTooltip(mode, 'rename', canDeletePage)}
            icon={<Pencil size={15} />}
            disabled={crudLocked || noPages}
            onClick={onRenamePage}
          />
          <IconButton
            label="Duplicate page"
            tooltip={pageCrudTooltip(mode, 'duplicate', canDeletePage)}
            icon={<Copy size={15} />}
            disabled={crudLocked || noPages}
            onClick={onDuplicatePage}
          />
          <span className="command-divider command-divider--danger" aria-hidden="true" />
          <IconButton
            label="Delete page"
            tooltip={pageCrudTooltip(mode, 'delete', canDeletePage)}
            variant="danger"
            icon={<Trash2 size={15} />}
            disabled={crudLocked || !canDeletePage}
            onClick={onDeletePage}
          />
        </div>
      </div>

      <div className="command-group overview-command-bar__group" data-overview-group="MODE">
        <span className="command-group__label">Mode</span>
        <div className="command-group__controls">
          <span className={`pill ${edit ? 'pill--warning' : 'pill--accent'}`} aria-label={`Overview mode: ${mode}`}>
            {mode}
          </span>
          {edit ? (
            <>
              <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={onSaveAndExit}>
                Save &amp; Exit
              </Button>
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={onCancelChanges}>
                Cancel Changes
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" icon={<Pencil size={14} />} onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {edit ? (
        <div className="command-group overview-command-bar__group" data-overview-group="EDIT ACTIONS">
          <span className="command-group__label">Edit Actions</span>
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
              tooltip={hasSelection ? 'Lock selected element' : 'No element selected'}
              icon={<Lock size={15} />}
              disabled={!hasSelection}
              onClick={onLockSelected}
            />
            <IconButton
              label="Unlock Selected"
              tooltip={hasSelection ? 'Unlock selected element' : 'No element selected'}
              icon={<Unlock size={15} />}
              disabled={!hasSelection}
              onClick={onUnlockSelected}
            />
            <span className="command-divider command-divider--danger" aria-hidden="true" />
            <IconButton
              label="Delete Selected"
              tooltip={hasSelection ? 'Delete selected element' : 'No element selected'}
              variant="danger"
              icon={<Trash2 size={15} />}
              disabled={!hasSelection}
              onClick={onDeleteSelected}
            />
          </div>
        </div>
      ) : null}

      <div
        className="command-group overview-command-bar__group overview-command-bar__group--save-status"
        data-overview-group="SAVE STATUS"
      >
        <span className="command-group__label">Save Status</span>
        <div className="command-group__controls">
          <span className={saveIndicatorClass(saveLabel)} role="status" aria-live="polite">
            {saveLabel}
          </span>
          <span className="pill pill--neutral" aria-label={`Overview page revision ${revision}`}>
            {overviewRevisionLabel(revision)}
          </span>
        </div>
      </div>
    </div>
  );
}
