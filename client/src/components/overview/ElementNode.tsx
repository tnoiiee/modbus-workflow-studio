import { EditorMonitoring, RuntimeMonitoring } from './RuntimeMonitoring.js';
import { isRuntimeMonitoring } from '../../lib/overviewRuntimeSelection.js';
import type { BindingResolution } from '../../lib/overviewBinding.js';
import { memo, useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { ArrowUpRight, Image as ImageIcon, Lock, MousePointer2 } from 'lucide-react';

export const CONTROL_PREVIEW_DESCRIPTION = 'Control Runtime is not enabled. UI preview only; no Device or Workflow command.';
const previewDescriptionId = (id: string) => `overview-preview-description-${id}`;

import type { OverviewElement } from '../../lib/overviewElements.js';
import type { OverviewMode } from '../../lib/overviewState.js';

export interface OverviewElementNodeData {
  element: OverviewElement;
  mode: OverviewMode;
  selected: boolean;
  /** Confirmed independent Control-state value (View Mode rendering only). */
  controlValue?: boolean;
  bindingResolution?: BindingResolution;
  onNavigateWorkflow?: (targetWorkflowId?: string) => Promise<void>;
  [key: string]: unknown;
}

/**
 * Overview Element renderer — editor preview only.
 * Monitoring uses representative values in Edit, existing projected values in View.
 * Control Preview interactions retain their independent state path, never Device commands.
 */
function ElementNodeComponent({ data, selected }: NodeProps) {
  const element = (data as OverviewElementNodeData).element;
  const mode = (data as OverviewElementNodeData).mode;
  const resolution = (data as OverviewElementNodeData).bindingResolution;
  const onNavigateWorkflow = (data as OverviewElementNodeData).onNavigateWorkflow;
  const edit = mode === 'EDIT';
  const { style, binding, category, type } = element;
  const onControlStateChange = (data as OverviewElementNodeData).onControlStateChange as
    | ((id: string, value: boolean) => Promise<{ ok?: boolean } | unknown>)
    | undefined;

  // Transient Push Button pressed styling — never persisted.
  const [buttonPressed, setButtonPressed] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState(false);
  // Optimistic Switch preview until the independent Control-state PATCH confirms.
  const [switchOptimistic, setSwitchOptimistic] = useState<boolean | null>(null);
  // Confirmed value from the independent Control-state store (legacy fallback only if absent).
  const controlValueFromData = (data as OverviewElementNodeData).controlValue;
  const confirmedSwitch = Boolean(
    type === 'SWITCH' &&
      (typeof controlValueFromData === 'boolean'
        ? controlValueFromData
        : (element.controlState as { value?: boolean } | undefined)?.value),
  );
  const switchOn = switchOptimistic ?? confirmedSwitch;
  const switchPending = type === 'SWITCH' && switchOptimistic !== null;

  const handleSwitchClick = useCallback(
    (event: React.MouseEvent) => {
      if (edit) return;
      // Stop only the control interaction — never the Element root select path.
      event.stopPropagation();
      if (type !== 'SWITCH') return;
      // One request per click — ignore while pending.
      if (switchOptimistic !== null) return;
      const next = !switchOn;
      setSwitchOptimistic(next);
      if (!onControlStateChange) {
        setSwitchOptimistic(null);
        return;
      }
      void onControlStateChange(element.id, next).then(result => {
        const outcome = result as { ok?: boolean } | undefined;
        // Success or failure both clear pending — value comes from confirmed store.
        setSwitchOptimistic(null);
        if (!outcome?.ok) {
          /* control error already surfaced by parent; restores confirmed value */
        }
      });
    },
    [edit, element.id, onControlStateChange, switchOn, switchOptimistic, type],
  );

  const handleButtonPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (edit) return;
      event.stopPropagation();
      setButtonPressed(true);
    },
    [edit],
  );

  const handleButtonPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (edit) return;
      event.stopPropagation();
      // Released state only — transient press never persists.
      setButtonPressed(false);
    },
    [edit],
  );

  const handleLinkClick = useCallback(
    (event: React.MouseEvent) => {
      if (edit) return;
      event.stopPropagation();
      if (onNavigateWorkflow) void onNavigateWorkflow(element.targetWorkflowId);
      else setLinkFeedback(true);
    },
    [edit, onNavigateWorkflow, element.targetWorkflowId],
  );

  if (!element.visible) {
    return (
      <div
        className="overview-element overview-element--hidden"
        data-element-id={element.id}
        data-selected={selected ? 'true' : 'false'}
      >
        <span className="overview-element__hidden-label">Hidden</span>
      </div>
    );
  }

  const boxStyle: React.CSSProperties = {
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: style.opacity,
    color: style.textColor,
    fontSize: style.fontSize,
    textAlign: style.alignment,
    background: style.backgroundOpacity === undefined || style.backgroundOpacity === 1 ? style.backgroundColor : 'transparent',
    border: `${style.borderWidth}px solid ${style.showBorder === false ? 'transparent' : style.borderColor}`,
    borderRadius: style.borderRadius,
  };

  const monitoringPresentation = category === 'MONITORING' && isRuntimeMonitoring(type);
  const runtimeMonitoring = !edit && monitoringPresentation;
  const showResizeHandles = edit && selected && !element.locked;
  // Contract: locked Element → no handles; VIEW Mode → no handles (eight when editable).

  return (
    <>
      {showResizeHandles ? (
        <NodeResizer
          minWidth={8}
          minHeight={8}
          handleStyle={{ width: 10, height: 10, borderRadius: 2 }}
          lineStyle={{ borderColor: 'rgba(56, 189, 248, 0.9)' }}
          isVisible
        />
      ) : null}
      <div
        className={[
          'overview-element',
          `overview-element--${type.toLowerCase()}`,
          `overview-element--${category.toLowerCase()}`,
          monitoringPresentation ? 'overview-element--runtime' : '',
          type === 'SWITCH' || type === 'PUSH_BUTTON' ? 'is-control-preview' : '',
          element.locked ? 'is-locked' : '',
          selected && edit ? 'is-selected' : '',
          edit ? 'is-editable' : 'is-readonly',
          switchOn && type === 'SWITCH' && !edit ? 'is-preview-on' : '',
          buttonPressed && type === 'PUSH_BUTTON' && !edit ? 'is-pressed' : '',
          linkFeedback && type === 'NAVIGATION_LINK' && !edit ? 'is-link-feedback' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-element-id={element.id}
        data-element-type={element.type}
        data-selected={selected && edit ? 'true' : 'false'}
        data-preview-switch={type === 'SWITCH' && !edit ? (switchOn ? 'on' : 'off') : undefined}
        data-preview-pressed={type === 'PUSH_BUTTON' && !edit ? (buttonPressed ? 'true' : 'false') : undefined}
        style={boxStyle}
        title={element.locked ? `${element.name} (locked)` : element.name}
      >
        {style.backgroundOpacity !== undefined && style.backgroundOpacity !== 1 && <span
          className="overview-element__background" aria-hidden="true"
          style={{ background: style.backgroundColor, opacity: style.backgroundOpacity }} />}
        {element.locked ? (
          <span className="overview-element__lock" aria-hidden="true">
            <Lock size={11} />
          </span>
        ) : null}

        <span className="overview-element__body">{runtimeMonitoring ? <RuntimeMonitoring element={element} resolution={resolution} /> : edit && monitoringPresentation ? <EditorMonitoring element={element} resolution={resolution} /> : renderPreview(element, { switchOn, switchPending, buttonPressed, linkFeedback, edit, onSwitchClick: handleSwitchClick, onButtonDown: handleButtonPointerDown, onButtonUp: handleButtonPointerUp, onLinkClick: handleLinkClick })}</span>

        {(type === 'SWITCH' || type === 'PUSH_BUTTON') && <>
          <span className="overview-control-runtime-warning" title={CONTROL_PREVIEW_DESCRIPTION}>PREVIEW ONLY</span>
          <span className="overview-runtime-sr" id={previewDescriptionId(element.id)}>{CONTROL_PREVIEW_DESCRIPTION}</span>
        </>}
      </div>
      {edit && category !== 'DISPLAY' && <span className="overview-editor-chrome" title={`EDITOR PREVIEW · ${type === 'NAVIGATION_LINK' ? 'NAVIGATION ONLY' : resolution?.status ?? binding.status ?? 'NOT_BOUND'} · ${resolution?.reason ?? 'Configuration only; no Runtime'}`}>
        EDITOR PREVIEW · {type === 'NAVIGATION_LINK' ? 'NAVIGATION ONLY' : resolution?.status ?? binding.status ?? 'NOT_BOUND'}
      </span>}
    </>
  );
}

interface PreviewHandlers {
  switchOn: boolean;
  switchPending: boolean;
  buttonPressed: boolean;
  linkFeedback: boolean;
  edit: boolean;
  onSwitchClick: (event: React.MouseEvent) => void;
  onButtonDown: (event: React.PointerEvent) => void;
  onButtonUp: (event: React.PointerEvent) => void;
  onLinkClick: (event: React.MouseEvent) => void;
}

function renderPreview(element: OverviewElement, handlers: PreviewHandlers): ReactNode {
  const { type, style, binding, category } = element;
  const text = style.text;
  const hasText = !!text.trim();
  const switchCaption = hasText && element.width >= 160 && element.height >= 64
    ? <span className="overview-element__control-text">{text}</span> : null;

  switch (type) {
    case 'PICTURE_BOX':
      return (
        <span className="overview-element__preview overview-element__preview--picture" role="img" aria-label={hasText ? text : 'Picture placeholder — not implemented'}>
          <ImageIcon size={18} aria-hidden="true" /><span>{hasText ? text : null}</span>
        </span>
      );
    case 'SWITCH':
      if (handlers.edit) {
        return (
          <span className="overview-element__preview overview-element__preview--switch" data-editor-preview="true">
            {switchCaption}<i className="overview-element__switch-track" aria-hidden="true" />
            <span>OFF</span>
          </span>
        );
      }
      return (
        <button
          type="button"
          className={`overview-element__preview overview-element__preview--switch overview-element__preview--interactive${handlers.switchOn ? ' is-on' : ''}`}
          data-preview-control="switch"
          aria-pressed={handlers.switchOn}
          aria-label={`Toggle switch preview${hasText ? `: ${text}` : ''}`}
          aria-describedby={previewDescriptionId(element.id)}
          disabled={handlers.switchPending}
          onClick={handlers.onSwitchClick}
        >
          {switchCaption}<i className="overview-element__switch-track" aria-hidden="true" />
          <span>{handlers.switchOn ? 'ON' : 'OFF'}</span>
        </button>
      );
    case 'PUSH_BUTTON':
      if (handlers.edit) {
        return (
          <span className="overview-element__preview overview-element__preview--button" data-editor-preview="true">
            {hasText ? <span className="overview-element__control-text">{text}</span> : <MousePointer2 size={16} aria-hidden="true" />}
          </span>
        );
      }
      return (
        <button
          type="button"
          className={`overview-element__preview overview-element__preview--button overview-element__preview--interactive${handlers.buttonPressed ? ' is-pressed' : ''}`}
          data-preview-control="push-button"
          aria-label="Push button preview"
          aria-describedby={previewDescriptionId(element.id)}
          onPointerDown={handlers.onButtonDown}
          onPointerUp={handlers.onButtonUp}
          onPointerLeave={handlers.onButtonUp}
          onPointerCancel={handlers.onButtonUp}
        >
          {hasText ? <span className="overview-element__control-text">{text}</span> : <MousePointer2 size={16} aria-hidden="true" />}
        </button>
      );
    case 'NAVIGATION_LINK':
      if (handlers.edit) {
        return (
          <span className="overview-element__preview overview-element__preview--link" data-editor-preview="true">
            <ArrowUpRight size={16} aria-hidden="true" /><span className="overview-element__control-text">{hasText ? text : null}</span>
          </span>
        );
      }
      return (
        <button
          type="button"
          className={`overview-element__preview overview-element__preview--link overview-element__preview--interactive${handlers.linkFeedback ? ' is-feedback' : ''}`}
          data-preview-control="navigation-link"
          aria-label="Open target Workflow"
          onClick={handlers.onLinkClick}
        >
          <ArrowUpRight size={16} aria-hidden="true" /><span className="overview-element__control-text">{handlers.linkFeedback ? 'Missing Workflow target' : hasText ? text : null}</span>
        </button>
      );
    case 'STATIC_TEXT':
      return <span className="overview-element__preview">{text}</span>;
    case 'RECTANGLE':
    case 'PANEL':
      return <span className="overview-element__preview">{text}</span>;
    case 'DIVIDER':
      return <span className="overview-element__preview overview-element__preview--divider" aria-hidden="true" />;
    case 'STATIC_IMAGE':
      return (
        <span className="overview-element__preview overview-element__preview--picture" role="img" aria-label={hasText ? text : 'Image placeholder — not implemented'}>
          <ImageIcon size={18} aria-hidden="true" /><span>{hasText ? text : null}</span>
        </span>
      );
    default:
      return (
        <span className="overview-element__preview">
          {text}
          {category === 'CONTROL' && binding.status === 'NOT_BOUND' ? ' · NOT BOUND' : ''}
        </span>
      );
  }
}

export const ElementNode = memo(ElementNodeComponent);
