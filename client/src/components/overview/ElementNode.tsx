import { memo, useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { Lock } from 'lucide-react';

import type { OverviewElement } from '../../lib/overviewElements.js';
import type { OverviewMode } from '../../lib/overviewState.js';

export interface OverviewElementNodeData {
  element: OverviewElement;
  mode: OverviewMode;
  selected: boolean;
  [key: string]: unknown;
}

/**
 * Overview Element renderer — editor preview only.
 * Monitoring shows labeled Editor Preview values; Controls show NOT BOUND.
 * VIEW-mode control interactions are UI-only local preview (no API/Runtime).
 */
function ElementNodeComponent({ data, selected }: NodeProps) {
  const element = (data as OverviewElementNodeData).element;
  const mode = (data as OverviewElementNodeData).mode;
  const edit = mode === 'EDIT';
  const { style, binding, category, type } = element;
  const onControlStateChange = (data as OverviewElementNodeData).onControlStateChange as
    | ((id: string, value: boolean) => Promise<{ ok?: boolean } | unknown>)
    | undefined;

  // Transient Push Button pressed styling — never persisted.
  const [buttonPressed, setButtonPressed] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState(false);
  // Optimistic Switch preview until PATCH confirms persisted controlState.
  const [switchOptimistic, setSwitchOptimistic] = useState<boolean | null>(null);
  const persistedSwitch = Boolean(
    type === 'SWITCH' && (element.controlState as { value?: boolean } | undefined)?.value,
  );
  const switchOn = switchOptimistic ?? persistedSwitch;

  const handleSwitchClick = useCallback(
    (event: React.MouseEvent) => {
      if (edit) return;
      // Stop only the control interaction — never the Element root select path.
      event.stopPropagation();
      if (type !== 'SWITCH') return;
      // In-flight PATCH already open — ignore rapid duplicate toggles.
      if (switchOptimistic !== null) return;
      const next = !switchOn;
      setSwitchOptimistic(next);
      if (!onControlStateChange) return;
      void onControlStateChange(element.id, next).then(result => {
        const outcome = result as { ok?: boolean } | undefined;
        // Success or failure both clear optimistic — value comes from persisted controlState.
        setSwitchOptimistic(null);
        if (!outcome?.ok) {
          /* conflict already surfaced by parent */
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
      // Preview feedback only — no navigation until a valid target exists.
      setLinkFeedback(true);
      window.setTimeout(() => setLinkFeedback(false), 1200);
    },
    [edit],
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
    background: style.backgroundColor,
    border: `${style.borderWidth}px solid ${style.borderColor}`,
    borderRadius: style.borderRadius,
  };

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
        {element.locked ? (
          <span className="overview-element__lock" aria-hidden="true">
            <Lock size={11} />
          </span>
        ) : null}

        <span className="overview-element__body">{renderPreview(element, { switchOn, buttonPressed, linkFeedback, edit, onSwitchClick: handleSwitchClick, onButtonDown: handleButtonPointerDown, onButtonUp: handleButtonPointerUp, onLinkClick: handleLinkClick })}</span>

        {category === 'MONITORING' ? (
          <span className="overview-element__badge overview-element__badge--preview" aria-hidden="true">
            Editor Preview
          </span>
        ) : null}
        {category === 'CONTROL' ? (
          <span className="overview-element__badge overview-element__badge--unbound" aria-hidden="true">
            {binding.status === 'DRAFT' ? 'DRAFT' : 'NOT BOUND'}
            {!edit && type === 'SWITCH' ? ' · PREVIEW' : ''}
            {!edit && type === 'PUSH_BUTTON' ? ' · PREVIEW' : ''}
            {!edit && type === 'NAVIGATION_LINK' ? ' · PREVIEW' : ''}
          </span>
        ) : null}
      </div>
    </>
  );
}

interface PreviewHandlers {
  switchOn: boolean;
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

  switch (type) {
    case 'NUMERIC_LABEL':
      return (
        <span className="overview-element__preview">
          <small className="overview-element__label">{text || 'Numeric Label'}</small>
          <b className="overview-element__value">---</b>
        </span>
      );
    case 'TEXT_LABEL':
      return <span className="overview-element__preview">{text || 'Text Label'}</span>;
    case 'STATUS_LIGHT':
      return (
        <span className="overview-element__preview overview-element__preview--light">
          <i className="overview-element__lamp" aria-hidden="true" />
          <span>{text || 'Status'}</span>
        </span>
      );
    case 'VALUE_BADGE':
      return (
        <span className="overview-element__preview overview-element__preview--badge">
          {text || 'VALUE'}
        </span>
      );
    case 'PICTURE_BOX':
      return (
        <span className="overview-element__preview overview-element__preview--picture">
          {text || 'Picture'}
        </span>
      );
    case 'SWITCH':
      if (handlers.edit) {
        return (
          <span className="overview-element__preview overview-element__preview--switch" data-editor-preview="true">
            <i className="overview-element__switch-track" aria-hidden="true" />
            <span>OFF · PREVIEW</span>
          </span>
        );
      }
      return (
        <button
          type="button"
          className={`overview-element__preview overview-element__preview--switch overview-element__preview--interactive${handlers.switchOn ? ' is-on' : ''}`}
          data-preview-control="switch"
          aria-pressed={handlers.switchOn}
          aria-label="Toggle switch preview"
          onClick={handlers.onSwitchClick}
        >
          <i className="overview-element__switch-track" aria-hidden="true" />
          <span>{handlers.switchOn ? 'ON · PREVIEW' : 'OFF · PREVIEW'}</span>
        </button>
      );
    case 'PUSH_BUTTON':
      if (handlers.edit) {
        return (
          <span className="overview-element__preview overview-element__preview--button" data-editor-preview="true">
            {text || 'Push'}
          </span>
        );
      }
      return (
        <button
          type="button"
          className={`overview-element__preview overview-element__preview--button overview-element__preview--interactive${handlers.buttonPressed ? ' is-pressed' : ''}`}
          data-preview-control="push-button"
          aria-label="Push button preview"
          onPointerDown={handlers.onButtonDown}
          onPointerUp={handlers.onButtonUp}
          onPointerLeave={handlers.onButtonUp}
          onPointerCancel={handlers.onButtonUp}
        >
          {text || 'Push'}
        </button>
      );
    case 'NAVIGATION_LINK':
      if (handlers.edit) {
        return (
          <span className="overview-element__preview overview-element__preview--link" data-editor-preview="true">
            {text || 'Link'}
          </span>
        );
      }
      return (
        <button
          type="button"
          className={`overview-element__preview overview-element__preview--link overview-element__preview--interactive${handlers.linkFeedback ? ' is-feedback' : ''}`}
          data-preview-control="navigation-link"
          aria-label="Navigation link preview"
          onClick={handlers.onLinkClick}
        >
          {handlers.linkFeedback ? 'Preview · no target' : text || 'Link'}
        </button>
      );
    case 'STATIC_TEXT':
      return <span className="overview-element__preview">{text || 'Static text'}</span>;
    case 'RECTANGLE':
    case 'PANEL':
      return <span className="overview-element__preview">{text}</span>;
    case 'DIVIDER':
      return <span className="overview-element__preview overview-element__preview--divider" aria-hidden="true" />;
    case 'STATIC_IMAGE':
      return (
        <span className="overview-element__preview overview-element__preview--picture">
          {text || 'Image'}
        </span>
      );
    default:
      return (
        <span className="overview-element__preview">
          {text || type}
          {category === 'CONTROL' && binding.status === 'NOT_BOUND' ? ' · NOT BOUND' : ''}
        </span>
      );
  }
}

export const ElementNode = memo(ElementNodeComponent);
