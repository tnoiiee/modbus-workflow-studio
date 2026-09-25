import { FontSizeField } from './FontSizeField.js';
import { SourceBindingFields } from './SourceBindingFields.js';
import { resolveOverviewBinding, type BindingResolution } from '../../lib/overviewBinding.js';
import type { SourceDefinition, DefinitionWorkflow } from '../../lib/sourceDefinitions.js';
import { useEffect, useId, useState, type InputHTMLAttributes } from 'react';
import {
  BringToFront,
  Eye,
  EyeOff,
  Lock,
  SendToBack,
  Copy,
  Trash2,
  Unlock,
} from 'lucide-react';

import {
  OVERVIEW_ELEMENT_LABELS,
  clampOverviewOpacity,
  normalizeOverviewRotation,
  overviewAllowedDirections,
  validateOverviewBinding,
  type OverviewElement,
  type OverviewBindingDataType,
  type OverviewBindingDirection,
} from '../../lib/overviewElements.js';

/**
 * Text/number field that holds local input state and commits on blur/Enter.
 * One property commit → one Undo entry (keystrokes do not flood history).
 */
function CommitField({
  value,
  onCommit,
  validate,
  format,
  ...inputProps
}: {
  value: number;
  onCommit: (value: number) => void;
  validate?: (value: number) => boolean;
  format?: (value: number) => number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'>) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(local);
    const normalized = format ? format(parsed) : parsed;
    if (!Number.isFinite(normalized)) {
      setLocal(String(value));
      return;
    }
    if (validate && !validate(normalized)) {
      setLocal(String(value));
      return;
    }
    if (normalized !== value) onCommit(normalized);
    else setLocal(String(value));
  };

  return (
    <input
      {...inputProps}
      value={local}
      onChange={event => setLocal(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setLocal(String(value));
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

function CommitText({
  value,
  onCommit,
  ...inputProps
}: {
  value: string;
  onCommit: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = () => {
    if (local !== value) onCommit(local);
  };

  return (
    <input
      {...inputProps}
      value={local}
      onChange={event => setLocal(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setLocal(String(value));
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

export interface ElementInspectorProps {
  element: OverviewElement | null;
  definitions?: readonly SourceDefinition[];
  workflows?: readonly DefinitionWorkflow[];
  resolution?: BindingResolution;
  onPatch: (patch: Partial<OverviewElement>) => void;
  onPatchStyle: (patch: Partial<OverviewElement['style']>) => void;
  onPreviewFontSize?: (value: number | null) => void;
  onPatchBinding: (patch: Partial<OverviewElement['binding']>) => void;
  onToggleLock: () => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onBringToFront: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
}

const DATA_TYPES: readonly OverviewBindingDataType[] = ['Boolean', 'Number', 'String', 'Unknown'];

/**
 * O1-C Element Inspector — identity, layout, appearance, configuration-only Draft Tag binding.
 * Every property commit mutates the Draft only (one commit = one Undo entry).
 */
export function ElementInspector({
  element, definitions = [], workflows = [], resolution,
  onPatch,
  onPatchStyle, onPreviewFontSize,
  onPatchBinding,
  onToggleLock,
  onToggleVisible,
  onDuplicate,
  onDelete,
  onBringForward,
  onBringToFront,
  onSendBackward,
  onSendToBack,
}: ElementInspectorProps) {
  const bindingHelpId = useId();
  const bindingErrorId = useId();
  if (!element) {
    return (
      <div className="element-inspector" role="region" aria-label="Element Inspector">
        <div className="element-inspector__empty" role="status"><strong>No element selected</strong><p>Select an element on the canvas to edit its properties.</p></div>
      </div>
    );
  }

  const style = element.style;
  const binding = element.binding;
  const disabled = element.locked;
  const bindingErrors = validateOverviewBinding(element.category, binding);
  const resolved = resolution ?? resolveOverviewBinding(element, { definitions, available: false });

  return (
    <div className="element-inspector" role="region" aria-label="Element Inspector">
      <div className="element-inspector__identity">
        <h4 className="element-inspector__section-title">Element</h4>
        <div className="element-inspector__row">
          <label className="element-inspector__field">
            <span>Element Name</span>
            <CommitText
              type="text"
              value={element.name}
              maxLength={100}
              disabled={disabled}
              onCommit={name => onPatch({ name })}
            />
          </label>
        </div>
        <div className="element-inspector__row element-inspector__row--meta">
          <span>
            Type <b>{OVERVIEW_ELEMENT_LABELS[element.type]}</b>
          </span>
          <span className="element-inspector__id" title={element.id}>
            ID {element.id}
          </span>
        </div>
        <div className="element-inspector__row element-inspector__row--toggles">
          <button
            type="button"
            className={`element-inspector__toggle${element.locked ? ' is-active' : ''}`}
            aria-pressed={element.locked}
            onClick={onToggleLock}
          >
            {element.locked ? <Lock size={14} /> : <Unlock size={14} />}
            {element.locked ? 'Locked' : 'Unlocked'}
          </button>
          <button
            type="button"
            className={`element-inspector__toggle${element.visible ? ' is-active' : ''}`}
            aria-pressed={element.visible}
            onClick={onToggleVisible}
          >
            {element.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            {element.visible ? 'Visible' : 'Hidden'}
          </button>
        </div>
      </div>

      <fieldset className="element-inspector__group" disabled={disabled}>
        <legend>Geometry</legend>
        <div className="element-inspector__grid">
          <label className="element-inspector__field">
            <span>X</span>
            <CommitField type="number" step={1} value={element.x} onCommit={x => onPatch({ x })} />
          </label>
          <label className="element-inspector__field">
            <span>Y</span>
            <CommitField type="number" step={1} value={element.y} onCommit={y => onPatch({ y })} />
          </label>
          <label className="element-inspector__field">
            <span>Width</span>
            <CommitField
              type="number"
              min={1}
              step={1}
              value={element.width}
              validate={value => value > 0}
              onCommit={width => onPatch({ width })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Height</span>
            <CommitField
              type="number"
              min={1}
              step={1}
              value={element.height}
              validate={value => value > 0}
              onCommit={height => onPatch({ height })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Rotation</span>
            <CommitField
              type="number"
              step={1}
              value={element.rotation}
              format={normalizeOverviewRotation}
              onCommit={rotation => onPatch({ rotation })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Z-index</span>
            <CommitField
              type="number"
              step={1}
              value={element.zIndex}
              validate={value => Number.isInteger(value)}
              onCommit={zIndex => onPatch({ zIndex })}
            />
          </label>
        </div>
        <div className="element-inspector__actions" role="group" aria-label="Layer order">
          <button type="button" onClick={onBringForward} aria-label="Bring Forward">
            Bring Forward
          </button>
          <button type="button" onClick={onBringToFront} aria-label="Bring to Front">
            <BringToFront size={14} /> Front
          </button>
          <button type="button" onClick={onSendBackward} aria-label="Send Backward">
            Send Backward
          </button>
          <button type="button" onClick={onSendToBack} aria-label="Send to Back">
            <SendToBack size={14} /> Back
          </button>
        </div>
      </fieldset>

      <fieldset className="element-inspector__group" disabled={disabled}>
        <legend>Appearance</legend>
        <div className="element-inspector__grid">
          <label className="element-inspector__field">
            <span>Opacity</span>
            <CommitField
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={style.opacity}
              format={clampOverviewOpacity}
              onCommit={opacity => onPatchStyle({ opacity })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Background</span>
            <input
              type="color"
              value={toHexColor(style.backgroundColor, '#0b1822')}
              onChange={event => onPatchStyle({ backgroundColor: event.target.value })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Border Color</span>
            <input
              type="color"
              value={toHexColor(style.borderColor, '#334155')}
              onChange={event => onPatchStyle({ borderColor: event.target.value })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Border Width</span>
            <CommitField
              type="number"
              min={0}
              max={12}
              step={1}
              value={style.borderWidth}
              validate={value => value >= 0 && value <= 12}
              onCommit={borderWidth => onPatchStyle({ borderWidth })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Border Radius</span>
            <CommitField
              type="number"
              min={0}
              max={64}
              step={1}
              value={style.borderRadius}
              validate={value => value >= 0 && value <= 64}
              onCommit={borderRadius => onPatchStyle({ borderRadius })}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="element-inspector__group" disabled={disabled}>
        <legend>Text</legend>
        <div className="element-inspector__grid">
          <label className="element-inspector__field element-inspector__field--wide">
            <span>Text</span>
            <CommitText type="text" value={style.text} onCommit={text => onPatchStyle({ text })} />
          </label>
          <label className="element-inspector__field">
            <span>Font Size</span>
            <FontSizeField value={style.fontSize} onPreview={onPreviewFontSize}
              onCommit={fontSize => onPatchStyle({ fontSize })} />
          </label>
          <label className="element-inspector__field">
            <span>Text Color</span>
            <input
              type="color"
              value={toHexColor(style.textColor, '#e6eef5')}
              onChange={event => onPatchStyle({ textColor: event.target.value })}
            />
          </label>
          <label className="element-inspector__field">
            <span>Alignment</span>
            <select
              value={style.alignment}
              onChange={event => onPatchStyle({ alignment: event.target.value as OverviewElement['style']['alignment'] })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
      </fieldset>

      {element.type === 'NAVIGATION_LINK' ? <fieldset className="element-inspector__group" disabled={disabled}>
        <legend>Workflow navigation</legend>
        <p>Navigation only. No Tag identity, commands, or Runtime changes.</p>
        <label>Target Workflow<select value={element.targetWorkflowId ?? ''} onChange={event => onPatch({ targetWorkflowId: event.target.value })}>
          <option value="">No target</option>
          {element.targetWorkflowId && !workflows.some(workflow => workflow.id === element.targetWorkflowId) && <option value={element.targetWorkflowId}>Missing target · {element.targetWorkflowId}</option>}
          {workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.id}</option>)}
        </select></label>
        <label>targetWorkflowId<input readOnly value={element.targetWorkflowId ?? ''} /></label>
      </fieldset> : <fieldset className="element-inspector__group" disabled={disabled}
        aria-describedby={`${bindingHelpId}${bindingErrors.length ? ` ${bindingErrorId}` : ''}`}
        aria-invalid={bindingErrors.length > 0 || undefined}>
        <legend>Draft Tag binding</legend>
        <p id={bindingHelpId} className="element-inspector__binding-help">
          Configuration only. DRAFT is not connected. BOUND verifies metadata only, never Runtime readiness.
          No live values or commands. Unknown data type is allowed for a legacy draft.
        </p>
        <SourceBindingFields element={element} definitions={definitions} workflows={workflows} resolution={resolved} onPatchBinding={onPatchBinding} />
        <div id={bindingErrorId} role="status" aria-live="polite" aria-atomic="true">
          {bindingErrors.length ? <ul>{bindingErrors.map(error => <li key={error}>{error}</li>)}</ul> : null}
        </div>
        <div className="element-inspector__grid">
          <label className="element-inspector__field">
            <span>Legacy Tag ID (not identity)</span>
            <CommitText
              type="text"
              value={binding.tagId}
              aria-describedby={bindingHelpId}
              placeholder="Not bound"
              onCommit={tagId =>
                onPatchBinding({
                  tagId,
                  status: tagId.trim() ? 'DRAFT' : 'NOT_BOUND',
                })
              }
            />
          </label>
          <label className="element-inspector__field">
            <span>Legacy Tag Name</span>
            <CommitText type="text" value={binding.tagName} onCommit={tagName => onPatchBinding({ tagName })} />
          </label>
          <label className="element-inspector__field">
            <span>Intended Data Type</span>
            <select
              value={binding.dataType}
              onChange={event => onPatchBinding({ dataType: event.target.value as OverviewBindingDataType })}
            >
              {DATA_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="element-inspector__field">
            <span>Direction</span>
            <select
              value={binding.direction}
              aria-label="Binding direction"
              data-category={element.category}
              onChange={event => onPatchBinding({ direction: event.target.value as OverviewBindingDirection })}
            >
              {overviewAllowedDirections(element.category).map(direction => (
                <option key={direction} value={direction}>
                  {direction}
                </option>
              ))}
            </select>
          </label>
          <label className="element-inspector__field">
            <span>Status</span>
            <input type="text" value={resolved.status} readOnly aria-readonly="true" />
          </label>
        </div>
      </fieldset>}

      <div className="element-inspector__actions element-inspector__actions--danger" role="group" aria-label="Element actions">
        <button type="button" onClick={onDuplicate} aria-label="Duplicate element">
          <Copy size={14} /> Duplicate
        </button>
        <button
          type="button"
          className="element-inspector__danger"
          onClick={onDelete}
          disabled={element.locked}
          aria-label="Delete element"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}

function toHexColor(value: string, fallback: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  // rgba(...) and named colors fall back for the native color input.
  return fallback;
}
