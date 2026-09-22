import { CircleStop, Copy, Maximize, Pencil, Play, Plus, Redo2, Square, Trash2, Undo2 } from 'lucide-react';

import { IconButton } from '../ui/IconButton.js';
import { saveIndicatorClass } from '../../lib/saveStatus.js';

export interface CommandBarWorkflow {
  id: string;
  name: string;
  running: boolean;
  mode: string;
}

export interface CommandBarProps {
  workflows: CommandBarWorkflow[];
  activeWorkflowId: string;
  onSelectWorkflow: (workflowId: string) => void;

  onAddWorkflow: () => void;
  onRenameWorkflow: () => void;
  onDuplicateWorkflow: () => void;
  onDeleteWorkflow: () => void;

  modes: string[];
  mode: string;
  onModeChange: (mode: string) => void;
  running: boolean;
  onToggleRun: () => void;
  onStopAll: () => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;

  saved?: string;
  revision?: number;
}

/**
 * Workflow command bar grouped into Workflow, Execution, and Editing.
 *
 * Every control calls the handler supplied by the existing state owner; the
 * bar holds no state, issues no requests, and does not change mode, run, stop,
 * save, revision, or undo/redo semantics.
 */
export function CommandBar({
  workflows,
  activeWorkflowId,
  onSelectWorkflow,
  onAddWorkflow,
  onRenameWorkflow,
  onDuplicateWorkflow,
  onDeleteWorkflow,
  modes,
  mode,
  onModeChange,
  running,
  onToggleRun,
  onStopAll,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFitView,
  saved,
  revision,
}: CommandBarProps) {
  return (
    <div className="command-bar">
      <div className="command-group">
        <span className="command-group__label">Workflow</span>
        <div className="command-group__controls">
          <select
            className="workflow-selector"
            aria-label="Active workflow"
            value={activeWorkflowId}
            onChange={(event) => onSelectWorkflow(event.target.value)}
          >
            {workflows.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.running ? 'RUNNING' : 'STOPPED'} · {item.mode}
              </option>
            ))}
          </select>
          <IconButton label="New Workflow" tooltip="New Workflow" icon={<Plus size={15} />} onClick={onAddWorkflow} />
          <IconButton label="Rename Workflow" tooltip="Rename Workflow" icon={<Pencil size={15} />} onClick={onRenameWorkflow} />
          <IconButton
            label="Duplicate Workflow"
            tooltip="Duplicate Workflow"
            icon={<Copy size={15} />}
            onClick={onDuplicateWorkflow}
          />
          <span className="command-divider command-divider--danger" aria-hidden="true" />
          <IconButton
            label="Delete Workflow"
            tooltip="Delete Workflow"
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={onDeleteWorkflow}
          />
        </div>
      </div>

      <div className="command-group">
        <span className="command-group__label">Execution</span>
        <div className="command-group__controls">
          <select
            className="mode-selector"
            aria-label="Workflow mode"
            value={mode}
            onChange={(event) => onModeChange(event.target.value)}
          >
            {modes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--primary btn--sm" onClick={onToggleRun} title={running ? 'Stop workflow' : 'Run workflow'}>
            {running ? <Square size={14} /> : <Play size={14} />}
            {running ? 'STOP' : 'RUN'}
          </button>
          <button
            type="button"
            className="btn btn--danger-ghost btn--sm"
            onClick={onStopAll}
            title="Stop all running workflows"
          >
            <CircleStop size={14} />
            STOP ALL
          </button>
          <span className={`run-dot${running ? ' run-dot--running' : ''}`} role="img" aria-label={running ? 'Workflow running' : 'Workflow stopped'} />
        </div>
      </div>

      <div className="command-group">
        <span className="command-group__label">Editing</span>
        <div className="command-group__controls">
          <IconButton label="Undo" tooltip="Undo (Ctrl+Z)" icon={<Undo2 size={15} />} onClick={onUndo} disabled={!canUndo} />
          <IconButton
            label="Redo"
            tooltip="Redo (Ctrl+Shift+Z)"
            icon={<Redo2 size={15} />}
            onClick={onRedo}
            disabled={!canRedo}
          />
          <IconButton label="Fit View" tooltip="Fit View" icon={<Maximize size={15} />} onClick={onFitView} />
          <span className="command-divider" aria-hidden="true" />
          {saved ? <span className={saveIndicatorClass(saved)}>{saved}</span> : null}
          {typeof revision === 'number' ? <span className="pill pill--neutral">Rev {revision}</span> : null}
        </div>
      </div>
    </div>
  );
}
