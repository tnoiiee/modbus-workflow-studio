import { Plus } from 'lucide-react';

import { BLOCK_CATEGORY_ORDER, GATE_SYMBOL_TYPES, LIB, blockMeta } from '../../lib/blockMetadata.js';
import { LogicSymbol } from './LogicSymbol.js';

export interface BlockLibraryProps {
  /** Existing add-block handler; adding a block keeps its current behavior. */
  onAdd: (type: string) => void;
}

/**
 * Block library as collapsible category cards.
 *
 * Categories, block order, and the add action are exactly the baseline ones —
 * only the presentation changes. No search is added in this pass.
 */
export function BlockLibrary({ onAdd }: BlockLibraryProps) {
  return (
    <div className="library block-library">
      <h3 className="block-library__title">
        Block Library
        <span className="block-library__hint">เลือกบล็อกเพื่อเพิ่มลงใน Workflow</span>
      </h3>

      {BLOCK_CATEGORY_ORDER.map((category) => {
        const types = LIB[category] ?? [];
        return (
          <details className="block-category" key={category} open>
            <summary className="block-category__summary">
              <span className="block-category__name">{category}</span>
              <span className="block-category__count">{types.length}</span>
            </summary>

            {types.length === 0 ? (
              <p className="empty block-category__empty">No blocks in this category</p>
            ) : (
              <div className="block-category__list">
                {types.map((type) => {
                  const meta = blockMeta(type);
                  const Icon = meta.icon;
                  return (
                    <div className="block-card" key={type}>
                      <span className="block-card__icon" aria-hidden="true">
                        {GATE_SYMBOL_TYPES.has(type) ? <LogicSymbol type={type} /> : <Icon size={17} />}
                      </span>
                      <span className="block-card__text">
                        <span className="block-card__title">
                          {meta.title}
                          {meta.badge ? <span className="block-card__badge">{meta.badge}</span> : null}
                        </span>
                        <span className="block-card__summary" lang="en">
                          {meta.summaryEn}
                        </span>
                        <span className="block-card__summary block-card__summary--th" lang="th">
                          {meta.summaryTh}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm block-card__add"
                        onClick={() => onAdd(type)}
                        title={`Add ${meta.title} to the workflow`}
                        aria-label={`Add ${meta.title} block`}
                      >
                        <Plus size={13} />
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
