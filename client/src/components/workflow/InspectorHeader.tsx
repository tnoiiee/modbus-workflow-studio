import { GATE_SYMBOL_TYPES, blockMeta } from '../../lib/blockMetadata.js';
import { LogicSymbol } from './LogicSymbol.js';

/**
 * Inspector visibility rule: the parameters panel is rendered only while a
 * block or a connection is selected. Pure UI state — it never changes node
 * positions, revisions, or undo history.
 */
export function isInspectorVisible(selected: string | undefined): boolean {
  return Boolean(selected && selected.trim());
}

export interface InspectorHeaderProps {
  /** Block type and instance name of the selected node. */
  type: string;
  name: string;
}

/**
 * Block identity block shown above the parameter fields: title, English and
 * Thai descriptions, category, and type badge. All text comes from the
 * centralized block metadata.
 */
export function InspectorHeader({ type, name }: InspectorHeaderProps) {
  const meta = blockMeta(type);
  const Icon = meta.icon;

  return (
    <div className="inspector-block">
      <div className="inspector-block__row">
        <span className="inspector-block__icon" aria-hidden="true">
          {GATE_SYMBOL_TYPES.has(type) ? <LogicSymbol type={type} /> : <Icon size={18} />}
        </span>
        <span className="inspector-block__heading">
          <b className="inspector-block__title">{meta.title}</b>
          <span className="inspector-block__name" title={name}>
            {name || 'Unnamed block'}
          </span>
        </span>
      </div>

      <div className="inspector-block__badges">
        <span className="pill pill--neutral">{meta.category}</span>
        <span className="pill pill--accent">{type}</span>
        {meta.badge ? <span className="pill pill--warning">{meta.badge}</span> : null}
      </div>

      <p className="inspector-block__summary" lang="en">
        {meta.summaryEn}
      </p>
      <p className="inspector-block__summary inspector-block__summary--th" lang="th">
        {meta.summaryTh}
      </p>
    </div>
  );
}
