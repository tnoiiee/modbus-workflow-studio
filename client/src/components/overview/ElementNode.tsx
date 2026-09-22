import { memo, type CSSProperties, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
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
 * No runtime API, no Modbus write, no production command.
 */
function ElementNodeComponent({ data, selected }: NodeProps) {
  const element = (data as OverviewElementNodeData).element;
  const mode = (data as OverviewElementNodeData).mode;
  const edit = mode === 'EDIT';
  const { style, binding, category, type } = element;

  if (!element.visible) {
    return (
      <div className="overview-element overview-element--hidden" data-element-id={element.id} data-selected={selected ? 'true' : 'false'}>
        <span className="overview-element__hidden-label">Hidden</span>
        {edit ? (
          <>
            <Handle type="target" position={Position.Left} className="overview-element__handle" />
            <Handle type="source" position={Position.Right} className="overview-element__handle" />
          </>
        ) : null}
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

  return (
    <div
      className={[
        'overview-element',
        `overview-element--${type.toLowerCase()}`,
        `overview-element--${category.toLowerCase()}`,
        element.locked ? 'is-locked' : '',
        selected && edit ? 'is-selected' : '',
        edit ? 'is-editable' : 'is-readonly',
      ]
        .filter(Boolean)
        .join(' ')}
      data-element-id={element.id}
      data-element-type={element.type}
      data-selected={selected && edit ? 'true' : 'false'}
      style={boxStyle}
      title={element.locked ? `${element.name} (locked)` : element.name}
    >
      {element.locked ? (
        <span className="overview-element__lock" aria-hidden="true">
          <Lock size={11} />
        </span>
      ) : null}

      <span className="overview-element__body">{renderPreview(element)}</span>

      {category === 'MONITORING' ? (
        <span className="overview-element__badge overview-element__badge--preview" aria-hidden="true">
          Editor Preview
        </span>
      ) : null}
      {category === 'CONTROL' ? (
        <span className="overview-element__badge overview-element__badge--unbound" aria-hidden="true">
          {binding.status === 'DRAFT' ? 'DRAFT' : 'NOT BOUND'}
        </span>
      ) : null}

      {edit ? (
        <>
          <Handle type="target" position={Position.Left} id="in" className="overview-element__handle" />
          <Handle type="source" position={Position.Right} id="out" className="overview-element__handle" />
        </>
      ) : null}
    </div>
  );
}

function renderPreview(element: OverviewElement): ReactNode {
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
      return (
        <span className="overview-element__preview overview-element__preview--switch" data-editor-preview="true">
          <i className="overview-element__switch-track" aria-hidden="true" />
          <span>OFF · PREVIEW</span>
        </span>
      );
    case 'PUSH_BUTTON':
      return (
        <span className="overview-element__preview overview-element__preview--button" data-editor-preview="true">
          {text || 'Push'}
        </span>
      );
    case 'NAVIGATION_LINK':
      return (
        <span className="overview-element__preview overview-element__preview--link" data-editor-preview="true">
          {text || 'Link'}
        </span>
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
