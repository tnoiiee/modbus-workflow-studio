import { useRef, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';

import { BLOCK_CATEGORY_ORDER, GATE_SYMBOL_TYPES, LIB, blockMeta } from '../../lib/blockMetadata.js';
import { LogicSymbol } from './LogicSymbol.js';

export interface BlockLibraryProps {
  /** Existing add-block handler; adding a block keeps its current behavior. */
  onAdd: (type: string) => void;
}

/* --- pure UI-state helpers (unit tested, no business state) ---------------- */

/** Every category open. */
export function expandAllCategories(): ReadonlySet<string> {
  return new Set(BLOCK_CATEGORY_ORDER);
}

/** Every category closed. */
export function collapseAllCategories(): ReadonlySet<string> {
  return new Set<string>();
}

/** Returns a new set with one category toggled or set explicitly. */
export function toggleCategory(
  open: ReadonlySet<string>,
  category: string,
  nextOpen: boolean = !open.has(category),
): ReadonlySet<string> {
  const next = new Set(open);
  if (nextOpen) next.add(category);
  else next.delete(category);
  return next;
}

/** Returns a new set with one category open, leaving the others untouched. */
export function withCategoryOpen(open: ReadonlySet<string>, category: string): ReadonlySet<string> {
  return toggleCategory(open, category, true);
}

/** Compact rail marker for a category name, e.g. `Boolean Logic` -> `BL`. */
export function categoryInitials(category: string): string {
  const words = category.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return category.slice(0, 2).toUpperCase();
}

/**
 * Block library as collapsible category cards.
 *
 * Layout contract: fixed panel header, one dedicated vertical scroll container,
 * categories and cards in normal document flow. Category open state and the
 * compact rail state are UI-only and live inside this component.
 */
export function BlockLibrary({ onAdd }: BlockLibraryProps) {
  const [openCategories, setOpenCategories] = useState<ReadonlySet<string>>(() => expandAllCategories());
  const [compact, setCompact] = useState(false);
  const categoryRefs = useRef(new Map<string, HTMLElement>());

  const revealCategory = (category: string) => {
    setCompact(false);
    setOpenCategories((current) => withCategoryOpen(current, category));
    requestAnimationFrame(() => {
      const target = categoryRefs.current.get(category);
      if (!target) return;
      const reduce =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    });
  };

  if (compact) {
    return (
      <div className="library block-library block-library--compact">
        <div className="block-library__head block-library__head--rail">
          <button
            type="button"
            className="btn-icon block-library__expand"
            aria-label="Expand block library"
            title="Expand block library"
            onClick={() => setCompact(false)}
          >
            <PanelLeftOpen size={16} />
          </button>
          <span className="block-rail__marker">Blocks</span>
        </div>
        <div className="block-library__scroll block-library__scroll--rail">
          {BLOCK_CATEGORY_ORDER.map((category) => {
            const types = LIB[category] ?? [];
            return (
              <button
                type="button"
                key={category}
                className="block-rail__item"
                title={`${category} — ${types.length} blocks`}
                aria-label={`Open ${category} blocks`}
                onClick={() => revealCategory(category)}
              >
                <span aria-hidden="true">{categoryInitials(category)}</span>
                <span className="block-rail__count">{types.length}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="library block-library">
      <div className="block-library__head">
        <div className="block-library__heading">
          <h3 className="block-library__title">Block Library</h3>
          <span className="block-library__hint" lang="th">
            เลือกบล็อกเพื่อเพิ่มลงใน Workflow
          </span>
        </div>
        <div className="block-library__tools">
          <button
            type="button"
            className="btn-icon btn-icon--sm"
            aria-label="Expand all block categories"
            title="Expand all"
            onClick={() => setOpenCategories(expandAllCategories())}
          >
            <ChevronsUpDown size={15} />
          </button>
          <button
            type="button"
            className="btn-icon btn-icon--sm"
            aria-label="Collapse all block categories"
            title="Collapse all"
            onClick={() => setOpenCategories(collapseAllCategories())}
          >
            <ChevronsDownUp size={15} />
          </button>
          <button
            type="button"
            className="btn-icon btn-icon--sm"
            aria-label="Collapse block library panel"
            title="Collapse panel"
            onClick={() => setCompact(true)}
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      <div className="block-library__scroll">
        {BLOCK_CATEGORY_ORDER.map((category) => {
          const types = LIB[category] ?? [];
          return (
            <details
              className="block-category"
              key={category}
              ref={(element) => {
                if (element) categoryRefs.current.set(category, element);
              }}
              open={openCategories.has(category)}
              onToggle={(event) => {
                const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                setOpenCategories((current) => toggleCategory(current, category, nextOpen));
              }}
            >
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
                          {GATE_SYMBOL_TYPES.has(type) ? <LogicSymbol type={type} /> : <Icon size={18} />}
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
                          className="btn btn--sm block-card__add"
                          onClick={() => onAdd(type)}
                          title={`Add ${meta.title} to the workflow`}
                          aria-label={`Add ${meta.title} block`}
                        >
                          <Plus size={12} />
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
