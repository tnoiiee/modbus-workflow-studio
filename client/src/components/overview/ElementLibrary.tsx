import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Minus, Plus, Search } from 'lucide-react';

import {
  OVERVIEW_CATEGORY_LABELS,
  OVERVIEW_CATEGORY_TYPES,
  OVERVIEW_ELEMENT_LABELS,
  OVERVIEW_ALL_ELEMENT_TYPES,
  type OverviewElementCategory,
  type OverviewElementType,
} from '../../lib/overviewElements.js';

export interface ElementLibraryProps {
  onAddElement: (type: OverviewElementType) => void;
}

type CategoryState = Record<OverviewElementCategory, boolean>;

const ALL_OPEN: CategoryState = { MONITORING: true, CONTROL: true, DISPLAY: true };
const ALL_CLOSED: CategoryState = { MONITORING: false, CONTROL: false, DISPLAY: false };

function matchesSearch(type: OverviewElementType, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    OVERVIEW_ELEMENT_LABELS[type].toLowerCase().includes(needle) ||
    type.toLowerCase().includes(needle)
  );
}

/**
 * O1-C Element Library — search, categorized sections, counts, and Add.
 * Editor-only surface; no Tag binding or runtime interaction here.
 */
export function ElementLibrary({ onAddElement }: ElementLibraryProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<CategoryState>(ALL_OPEN);

  const filtered = useMemo(
    () =>
      OVERVIEW_ALL_ELEMENT_TYPES.filter(type => matchesSearch(type, query.trim())),
    [query],
  );

  const sections = useMemo(
    () =>
      (Object.keys(OVERVIEW_CATEGORY_TYPES) as OverviewElementCategory[]).map(category => ({
        category,
        types: OVERVIEW_CATEGORY_TYPES[category].filter(type => filtered.includes(type)),
      })),
    [filtered],
  );

  const visibleCount = filtered.length;
  const allOpen = sections.every(section => open[section.category] || section.types.length === 0);
  const searchActive = query.trim().length > 0;

  return (
    <div className="element-library" aria-label="Element Library">
      <div className="element-library__toolbar">
        <label className="element-library__search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Search elements"
            aria-label="Search elements"
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <div className="element-library__bulk" role="group" aria-label="Category expand controls">
          <button
            type="button"
            className="element-library__bulk-btn"
            onClick={() => setOpen(ALL_OPEN)}
            disabled={allOpen}
          >
            Expand All
          </button>
          <button
            type="button"
            className="element-library__bulk-btn"
            onClick={() => setOpen(ALL_CLOSED)}
            disabled={sections.every(section => !open[section.category])}
          >
            Collapse All
          </button>
        </div>
      </div>

      {visibleCount === 0 ? (
        <p className="element-library__empty" role="status">
          No elements match “{query.trim()}”
        </p>
      ) : null}

      <div className="element-library__sections" role="tree" aria-label="Element categories">
        {sections.map(section => {
          if (section.types.length === 0 && searchActive) return null;
          const expanded = open[section.category];
          const count = section.types.length;
          return (
            <section key={section.category} className="element-library__section" role="treeitem" aria-expanded={expanded}>
              <div className="element-library__section-head">
                <button
                  type="button"
                  className="element-library__section-toggle"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${OVERVIEW_CATEGORY_LABELS[section.category]}`}
                  onClick={() =>
                    setOpen(current => ({ ...current, [section.category]: !current[section.category] }))
                  }
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{OVERVIEW_CATEGORY_LABELS[section.category]}</span>
                  <span className="element-library__count" aria-label={`${count} elements`}>
                    {count}
                  </span>
                </button>
              </div>
              {expanded ? (
                <ul className="element-library__list" role="group">
                  {section.types.map(type => (
                    <li key={type} className="element-library__item" role="none">
                      <button
                        type="button"
                        className="element-library__add"
                        role="treeitem"
                        aria-label={`Add ${OVERVIEW_ELEMENT_LABELS[type]}`}
                        title={`Add ${OVERVIEW_ELEMENT_LABELS[type]}`}
                        onClick={() => onAddElement(type)}
                      >
                        <span className="element-library__add-label">{OVERVIEW_ELEMENT_LABELS[type]}</span>
                        <span className="element-library__add-icon" aria-hidden="true">
                          <Plus size={14} />
                        </span>
                      </button>
                    </li>
                  ))}
                  {section.types.length === 0 ? (
                    <li className="element-library__empty-row" role="none">
                      <Minus size={12} aria-hidden="true" /> No matches
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
