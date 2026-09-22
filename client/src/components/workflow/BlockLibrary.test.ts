import { describe, expect, it } from 'vitest';

import { BLOCK_CATEGORY_ORDER } from '../../lib/blockMetadata.js';
import {
  categoryInitials,
  collapseAllCategories,
  expandAllCategories,
  toggleCategory,
  withCategoryOpen,
} from './BlockLibrary.js';

describe('block library category state', () => {
  it('expand all opens every category', () => {
    const open = expandAllCategories();
    expect(open.size).toBe(BLOCK_CATEGORY_ORDER.length);
    for (const category of BLOCK_CATEGORY_ORDER) expect(open.has(category)).toBe(true);
  });

  it('collapse all closes every category', () => {
    expect(collapseAllCategories().size).toBe(0);
    for (const category of BLOCK_CATEGORY_ORDER) expect(collapseAllCategories().has(category)).toBe(false);
  });

  it('toggles a single category without touching the others', () => {
    const open = expandAllCategories();
    const closed = toggleCategory(open, 'Math');
    expect(closed.has('Math')).toBe(false);
    expect(closed.size).toBe(BLOCK_CATEGORY_ORDER.length - 1);
    expect(toggleCategory(closed, 'Math').has('Math')).toBe(true);
  });

  it('accepts an explicit next state so native details toggling stays in sync', () => {
    const open = collapseAllCategories();
    expect(toggleCategory(open, 'Timer', true).has('Timer')).toBe(true);
    expect(toggleCategory(expandAllCategories(), 'Timer', false).has('Timer')).toBe(false);
  });

  it('never mutates the incoming state', () => {
    const open = expandAllCategories();
    const before = open.size;
    toggleCategory(open, 'Modbus');
    withCategoryOpen(open, 'Compare');
    expect(open.size).toBe(before);
    expect(open.has('Modbus')).toBe(true);
  });

  it('opens one category from the compact rail and keeps the rest as they were', () => {
    const open = toggleCategory(expandAllCategories(), 'Utility');
    const next = withCategoryOpen(open, 'Utility');
    expect(next.has('Utility')).toBe(true);
    expect(next.size).toBe(BLOCK_CATEGORY_ORDER.length);
  });

  it('gives every category a unique compact rail marker', () => {
    const initials = BLOCK_CATEGORY_ORDER.map((category) => categoryInitials(category));
    expect(initials).toEqual(['MO', 'BL', 'CO', 'MA', 'TI', 'UT']);
    expect(new Set(initials).size).toBe(BLOCK_CATEGORY_ORDER.length);
  });
});
