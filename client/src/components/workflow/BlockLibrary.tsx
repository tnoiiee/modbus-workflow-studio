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
 * Layout contract: the panel is a fixed-height flex column, its header never
 * scrolls, and the categories live in one dedicated vertical scroll container.
 * Categories and cards stay in normal document flow (no absolute positioning,
 * no fixed or max heights), so all six categories and all 48 blocks remain
 * reachable and the mouse wheel scrolls the library only.
 */
export function BlockLibrary({ onAdd }: BlockLibraryProps) {
  return (
    <div className="library block-library">
      <div className="block-library__head">
        <h3 className="block-library__title">Block Library</h3>
        <span className="block-library__hint" lang="th">
          เลือกบล็อกเพื่อเพิ่มลงใน Workflow
        </span>
      </div>

      <div className="block-library__scroll">
        {BLOCK_CATEGORY_ORDER.map((category) => {
          const types = LIB[category] ?? [];
          return (
            <details className="block-category" key={category} open>
              <summary className="block-category__summary" title={`${category} — ${types.length} blocks`}>
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
                      <article className="block-card" key={type}>
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
                      </article>
                    );
                  })}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}
