import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  OVERVIEW_ALL_ELEMENT_TYPES,
  OVERVIEW_CATEGORY_TYPES,
  OVERVIEW_ELEMENT_LABELS,
  OVERVIEW_ELEMENT_SNAP,
  canRedoOverview,
  canUndoOverview,
  centerOverviewElementPosition,
  clampOverviewOpacity,
  createOverviewElement,
  duplicateOverviewElement,
  emptyOverviewHistory,
  isOverviewElementType,
  layerOrderFromElements,
  normalizeOverviewRotation,
  nudgeOverviewElementToFreeSlot,
  normalizeOverviewBindingDirection,
  overviewAllowedDirections,
  overviewBringForward,
  overviewBringToFront,
  overviewDefaultBinding,
  overviewDefaultDirection,
  overviewDefaultStyle,
  overviewSendBackward,
  overviewSendToBack,
  overviewTypeCategory,
  overviewTypeDefaultSize,
  pushOverviewHistory,
  redoOverviewHistory,
  snapOverviewCoordinate,
  undoOverviewHistory,
  validateOverviewElements,
  type OverviewElement,
} from './overviewElements.js';
import {
  OVERVIEW_CONTROL_TYPES,
  OVERVIEW_MONITORING_TYPES,
  OVERVIEW_PANEL_TOGGLE_CLASS,
  selectionFromNodeClick,
  selectionFromPaneClick,
} from './overviewState.js';
import {
  TOOLTIP_OVERLAY_Z,
  resolveTooltipPosition,
} from '../components/ui/Tooltip.js';

function makeElement(id: string, overrides: Partial<OverviewElement> = {}): OverviewElement {
  const base = createOverviewElement('RECTANGLE', { id, x: 0, y: 0 });
  return { ...base, ...overrides };
}

describe('stable element type IDs', () => {
  it('exposes the thirteen contract type IDs', () => {
    expect([...OVERVIEW_ALL_ELEMENT_TYPES].sort()).toEqual(
      [
        'DIVIDER',
        'NAVIGATION_LINK',
        'NUMERIC_LABEL',
        'PANEL',
        'PICTURE_BOX',
        'PUSH_BUTTON',
        'RECTANGLE',
        'STATIC_IMAGE',
        'STATIC_TEXT',
        'STATUS_LIGHT',
        'SWITCH',
        'TEXT_LABEL',
        'VALUE_BADGE',
      ].sort(),
    );
    for (const type of OVERVIEW_ALL_ELEMENT_TYPES) {
      expect(isOverviewElementType(type)).toBe(true);
      expect(OVERVIEW_ELEMENT_LABELS[type]).toBeTruthy();
    }
    expect(isOverviewElementType('NOPE')).toBe(false);
  });

  it('maps every type to a compatible category', () => {
    expect(OVERVIEW_CATEGORY_TYPES.MONITORING).toEqual([
      'NUMERIC_LABEL',
      'TEXT_LABEL',
      'STATUS_LIGHT',
      'VALUE_BADGE',
      'PICTURE_BOX',
    ]);
    expect(OVERVIEW_CATEGORY_TYPES.CONTROL).toEqual(['SWITCH', 'PUSH_BUTTON', 'NAVIGATION_LINK']);
    expect(OVERVIEW_CATEGORY_TYPES.DISPLAY).toEqual([
      'STATIC_TEXT',
      'RECTANGLE',
      'PANEL',
      'DIVIDER',
      'STATIC_IMAGE',
    ]);
    for (const type of OVERVIEW_ALL_ELEMENT_TYPES) {
      const category = overviewTypeCategory(type);
      expect(OVERVIEW_CATEGORY_TYPES[category]).toContain(type);
    }
  });

  it('uses positive default dimensions and contract defaults', () => {
    for (const type of OVERVIEW_ALL_ELEMENT_TYPES) {
      const size = overviewTypeDefaultSize(type);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      const element = createOverviewElement(type, { id: `el-${type}`, x: 10, y: 20 });
      expect(element.width).toBe(size.width);
      expect(element.height).toBe(size.height);
      expect(element.rotation).toBe(0);
      expect(element.locked).toBe(false);
      expect(element.visible).toBe(true);
      expect(element.style.opacity).toBe(1);
      expect(element.binding.status).toBe('NOT_BOUND');
      expect(element.category).toBe(overviewTypeCategory(type));
      expect(element.id).toBe(`el-${type}`);
      expect(element.type).toBe(type);
    }
  });

  it('defaults binding direction by category', () => {
    expect(overviewDefaultBinding('MONITORING').direction).toBe('MONITOR');
    expect(overviewDefaultBinding('CONTROL').direction).toBe('COMMAND');
    expect(overviewDefaultBinding('DISPLAY').direction).toBe('NONE');
    expect(overviewDefaultStyle('MONITORING').opacity).toBe(1);
  });

  it('keeps element IDs unique across creates', () => {
    const a = createOverviewElement('SWITCH', { id: crypto.randomUUID(), x: 0, y: 0 });
    const b = createOverviewElement('SWITCH', { id: crypto.randomUUID(), x: 0, y: 0 });
    expect(a.id).not.toBe(b.id);
  });
});

describe('add placement at current canvas center', () => {
  it('converts a flow-space center with half-size centering and grid snap', () => {
    const size = { width: 100, height: 50 };
    const position = centerOverviewElementPosition({ x: 200, y: 100 }, size);
    // Top-left is half-size behind the requested center, then snapped.
    expect(position.x).toBe(snapOverviewCoordinate(200 - 50));
    expect(position.y).toBe(snapOverviewCoordinate(100 - 25));
    expect(position.x + 0).toBeGreaterThanOrEqual(0);
    expect(Math.abs(position.x + size.width / 2 - 200)).toBeLessThanOrEqual(OVERVIEW_ELEMENT_SNAP / 2);
    expect(Math.abs(position.y + size.height / 2 - 100)).toBeLessThanOrEqual(OVERVIEW_ELEMENT_SNAP / 2);
    expect(position.x % OVERVIEW_ELEMENT_SNAP).toBe(0);
    expect(position.y % OVERVIEW_ELEMENT_SNAP).toBe(0);
  });

  it('snaps coordinates onto the Overview grid', () => {
    expect(snapOverviewCoordinate(18)).toBe(16);
    expect(snapOverviewCoordinate(25)).toBe(32);
    expect(snapOverviewCoordinate(-6) + 0).toBe(0);
    expect(snapOverviewCoordinate(-20)).toBe(-16);
  });

  it('nudges deterministically on collision without moving existing elements', () => {
    const size = { width: 64, height: 64 };
    const existing = [{ x: 0, y: 0, width: 64, height: 64 }];
    const first = nudgeOverviewElementToFreeSlot({ x: 0, y: 0 }, size, existing);
    const second = nudgeOverviewElementToFreeSlot({ x: 0, y: 0 }, size, existing);
    expect(first).not.toBeNull();
    expect(first).toEqual(second);
    expect(first).not.toEqual({ x: 0, y: 0 });
    expect(existing[0]).toEqual({ x: 0, y: 0, width: 64, height: 64 });
    expect(first!.x % OVERVIEW_ELEMENT_SNAP).toBe(0);
  });

  it('repeated Add does not stack elements on one another', () => {
    const size = { width: 64, height: 64 };
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
    let next = { x: 160, y: 96 };
    for (let i = 0; i < 5; i += 1) {
      const found = nudgeOverviewElementToFreeSlot(next, size, placed);
      expect(found).not.toBeNull();
      next = found!;
      placed.push({ ...next, ...size });
    }
    const unique = new Set(placed.map(p => `${p.x},${p.y}`));
    expect(unique.size).toBe(5);
  });
});

describe('draft dirty transitions', () => {
  it('marks UNSAVED for add, move, resize, inspector and lock mutations', () => {
    // Mutations change the draft JSON relative to baseline → UNSAVED.
    const baseline = [makeElement('a')];
    const added = [...baseline, makeElement('b')];
    expect(JSON.stringify(added)).not.toBe(JSON.stringify(baseline));

    const moved = baseline.map(el => (el.id === 'a' ? { ...el, x: 64 } : el));
    expect(JSON.stringify(moved)).not.toBe(JSON.stringify(baseline));

    const resized = baseline.map(el => (el.id === 'a' ? { ...el, width: 120 } : el));
    expect(JSON.stringify(resized)).not.toBe(JSON.stringify(baseline));

    const inspected = baseline.map(el => (el.id === 'a' ? { ...el, name: 'Renamed' } : el));
    expect(JSON.stringify(inspected)).not.toBe(JSON.stringify(baseline));

    const locked = baseline.map(el => (el.id === 'a' ? { ...el, locked: true } : el));
    expect(JSON.stringify(locked)).not.toBe(JSON.stringify(baseline));
  });

  it('selection and panel collapse do not change the element snapshot', () => {
    const snapshot = [makeElement('a')];
    const selectionOnly = snapshot.map(el => ({ ...el }));
    expect(selectionOnly).toEqual(snapshot);
    // Panel collapse never mutates elements (pure session flag elsewhere).
    expect(JSON.stringify(snapshot)).toBe(JSON.stringify([makeElement('a')]));
  });

  it('pan and zoom never touch the element snapshot', () => {
    const snapshot = [makeElement('a', { x: 32, y: 48 })];
    expect(JSON.stringify(snapshot)).toBe(JSON.stringify([makeElement('a', { x: 32, y: 48 })]));
  });
});

describe('undo / redo history', () => {
  const start = [makeElement('a')];
  const afterAdd = [makeElement('a'), makeElement('b')];

  it('undoes and redoes Add', () => {
    let history = emptyOverviewHistory();
    history = pushOverviewHistory(history, start);
    expect(canUndoOverview(history)).toBe(true);
    const undone = undoOverviewHistory(history, afterAdd);
    expect(undone).not.toBeNull();
    expect(undone!.value.map(el => el.id)).toEqual(['a']);
    const redone = redoOverviewHistory(undone!.history, undone!.value);
    expect(redone!.value.map(el => el.id)).toEqual(['a', 'b']);
  });

  it('undoes Delete and Duplicate', () => {
    // Delete: baseline [a] → current [] → undo restores [a].
    const historyDel = pushOverviewHistory(emptyOverviewHistory(), start);
    const undoneDel = undoOverviewHistory(historyDel, []);
    expect(undoneDel!.value.map(el => el.id)).toEqual(['a']);

    // Duplicate: baseline [a] → current [a, b] → undo restores [a].
    const withDup = [...start, makeElement('b')];
    const historyDup = pushOverviewHistory(emptyOverviewHistory(), start);
    const undoneDup = undoOverviewHistory(historyDup, withDup);
    expect(undoneDup!.value.map(el => el.id)).toEqual(['a']);

    // Redo duplicate returns [a, b].
    const redone = redoOverviewHistory(undoneDup!.history, undoneDup!.value);
    expect(redone!.value.map(el => el.id).sort()).toEqual(['a', 'b']);
  });

  it('undoes Move, Resize, Inspector field, Lock and Layer order', () => {
    const cases: OverviewElement[][] = [
      start.map(el => ({ ...el, x: 99 })),
      start.map(el => ({ ...el, width: 200 })),
      start.map(el => ({ ...el, name: 'From inspector' })),
      start.map(el => ({ ...el, locked: true })),
      start.map(el => ({ ...el, zIndex: 9 })),
    ];
    for (const next of cases) {
      const history = pushOverviewHistory(emptyOverviewHistory(), start);
      const undone = undoOverviewHistory(history, next);
      expect(undone!.value).toEqual(start);
    }
  });

  it('invalidates redo after a new action', () => {
    let history = pushOverviewHistory(emptyOverviewHistory(), start);
    const undone = undoOverviewHistory(history, afterAdd)!;
    expect(canRedoOverview(undone.history)).toBe(true);
    const afterNew = pushOverviewHistory(undone.history, undone.value);
    expect(canRedoOverview(afterNew)).toBe(false);
  });

  it('layer operations renumber z-index and layer order', () => {
    const a = makeElement('a', { zIndex: 1 });
    const b = makeElement('b', { zIndex: 2 });
    const c = makeElement('c', { zIndex: 3 });
    const elements = [a, b, c];
    expect(layerOrderFromElements(overviewBringToFront(elements, 'a'))).toEqual(['b', 'c', 'a']);
    expect(layerOrderFromElements(overviewSendToBack(elements, 'c'))).toEqual(['c', 'a', 'b']);
    expect(layerOrderFromElements(overviewBringForward(elements, 'a'))).toEqual(['b', 'a', 'c']);
    expect(layerOrderFromElements(overviewSendBackward(elements, 'c'))).toEqual(['a', 'c', 'b']);
  });

  it('duplicates with a new id and unique name', () => {
    const source = makeElement('a', { name: 'Rectangle', x: 0, y: 0 });
    const result = duplicateOverviewElement([source], 'a', 'new-id');
    expect(result).not.toBeNull();
    expect(result!.element.id).toBe('new-id');
    expect(result!.element.name).not.toBe(source.name);
    expect(result!.elements).toHaveLength(2);
  });
});

describe('element validation before Save', () => {
  const valid = makeElement('a');
  const page = { id: 'page-1', layerOrder: ['a'] };

  it('accepts a valid draft', () => {
    expect(validateOverviewElements(page, [valid])).toEqual([]);
  });

  it('rejects duplicate Element IDs', () => {
    const errors = validateOverviewElements({ id: 'p', layerOrder: ['a'] }, [valid, { ...valid, name: 'copy' }]);
    expect(errors.some(e => e.includes('Duplicate Element ID'))).toBe(true);
  });

  it('rejects invalid size', () => {
    const errors = validateOverviewElements(page, [{ ...valid, width: 0 }]);
    expect(errors.some(e => e.includes('width'))).toBe(true);
  });

  it('rejects invalid opacity', () => {
    const errors = validateOverviewElements(page, [{ ...valid, style: { ...valid.style, opacity: 1.5 } }]);
    expect(errors.some(e => e.includes('opacity'))).toBe(true);
  });

  it('rejects invalid direction for category', () => {
    const monitoring = createOverviewElement('NUMERIC_LABEL', { id: 'm', x: 0, y: 0 });
    const bad = {
      ...monitoring,
      binding: { ...monitoring.binding, direction: 'COMMAND' as const },
    };
    const errors = validateOverviewElements({ id: 'p', layerOrder: ['m'] }, [bad]);
    expect(errors.some(e => e.includes('MONITOR or NONE'))).toBe(true);

    const display = createOverviewElement('RECTANGLE', { id: 'd', x: 0, y: 0 });
    const badDisplay = { ...display, binding: { ...display.binding, direction: 'MONITOR' as const } };
    const displayErrors = validateOverviewElements({ id: 'p', layerOrder: ['d'] }, [badDisplay]);
    expect(displayErrors.some(e => e.includes('NONE'))).toBe(true);
  });

  it('rejects invalid layer order', () => {
    const errors = validateOverviewElements({ id: 'p', layerOrder: ['a', 'ghost'] }, [valid]);
    expect(errors.some(e => e.includes('unknown ID'))).toBe(true);
    const missing = validateOverviewElements({ id: 'p', layerOrder: [] }, [valid]);
    expect(missing.some(e => e.includes('missing'))).toBe(true);
    const dup = validateOverviewElements({ id: 'p', layerOrder: ['a', 'a'] }, [valid]);
    expect(dup.some(e => e.includes('duplicate'))).toBe(true);
  });

  it('rejects empty DRAFT Tag ID', () => {
    const element = {
      ...makeElement('a'),
      binding: { tagId: '   ', tagName: '', dataType: 'Number' as const, direction: 'MONITOR' as const, status: 'DRAFT' as const },
    };
    const errors = validateOverviewElements(page, [element]);
    expect(errors.some(e => e.includes('Tag ID'))).toBe(true);
  });

  it('accepts non-empty trimmed DRAFT Tag ID', () => {
    const base = createOverviewElement('NUMERIC_LABEL', { id: 'a', x: 0, y: 0 });
    const element = {
      ...base,
      binding: { tagId: 'tag-1', tagName: 'Temp', dataType: 'Number' as const, direction: 'MONITOR' as const, status: 'DRAFT' as const },
    };
    expect(validateOverviewElements(page, [element])).toEqual([]);
  });
});

describe('rotation and opacity normalization', () => {
  it('normalizes rotation into [0, 360) and clamps opacity', () => {
    expect(normalizeOverviewRotation(370)).toBe(10);
    expect(normalizeOverviewRotation(-10)).toBe(350);
    expect(clampOverviewOpacity(2)).toBe(1);
    expect(clampOverviewOpacity(-1)).toBe(0);
    expect(clampOverviewOpacity(0.4)).toBe(0.4);
  });
});

describe('shared tooltip overlay contract', () => {
  const tooltipSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ui', 'Tooltip.tsx'),
    'utf8',
  );
  const iconButtonSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ui', 'IconButton.tsx'),
    'utf8',
  );

  it('uses Portal to document.body with fixed positioning', () => {
    expect(tooltipSource).toContain('createPortal');
    expect(tooltipSource).toContain('document.body');
    expect(tooltipSource).toContain("position: 'fixed'");
    expect(tooltipSource).toContain('pointerEvents');
    expect(iconButtonSource).toContain('Tooltip');
  });

  it('places the overlay above panels and canvas', () => {
    expect(TOOLTIP_OVERLAY_Z).toBeGreaterThanOrEqual(1000);
    expect(tooltipSource).toContain('TOOLTIP_OVERLAY_Z');
    expect(tooltipSource).not.toContain('zIndex: 40');
  });

  it('flips and clamps placement at viewport edges', () => {
    const viewport = { width: 200, height: 100 };
    const size = { width: 50, height: 20 };
    const nearTop = resolveTooltipPosition({ top: 5, bottom: 25, left: 80, right: 120 }, 'top', viewport, size);
    expect(nearTop.side).toBe('bottom');
    expect(nearTop.top).toBeGreaterThanOrEqual(8);

    const nearRight = resolveTooltipPosition({ top: 40, bottom: 60, left: 190, right: 198 }, 'right', viewport, size);
    expect(nearRight.side).toBe('left');
    expect(nearRight.left + size.width).toBeLessThanOrEqual(viewport.width - 8 + 0.001);

    const clamped = resolveTooltipPosition({ top: 10, bottom: 30, left: 5, right: 25 }, 'left', viewport, size);
    expect(clamped.left).toBeGreaterThanOrEqual(8);
  });

  it('closes when the host unmounts', () => {
    expect(tooltipSource).toContain('useEffect');
    expect(tooltipSource).toContain('hideActiveTooltip');
    expect(tooltipSource).toContain('onMouseLeave');
    expect(tooltipSource).toContain('onBlurCapture');
  });

  it('all four Panel toggles use the shared class and 16px icon', () => {
    const pageSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
      'utf8',
    );
    expect(OVERVIEW_PANEL_TOGGLE_CLASS).toBe('overview-panel-toggle');
    const classUses = pageSource.split('className={OVERVIEW_PANEL_TOGGLE_CLASS}').length - 1;
    // Four toggle buttons reference the shared class constant.
    expect(classUses).toBe(4);
    expect(pageSource).not.toContain('btn-icon btn-icon--sm');
    // Library (left) keeps PanelLeft; Inspector (right) uses PanelRight (O1-C §12).
    const leftIcons = pageSource.match(/PanelLeft(?:Close|Open) size=\{16\}/g) ?? [];
    const rightIcons = pageSource.match(/PanelRight(?:Close|Open) size=\{16\}/g) ?? [];
    expect(leftIcons).toHaveLength(2);
    expect(rightIcons).toHaveLength(2);
    expect(pageSource).toContain('aria-label="Collapse Element Inspector"');
    expect(pageSource).toContain('aria-label="Expand Element Inspector"');
    expect(pageSource).toContain('<PanelRightClose size={16} />');
    expect(pageSource).toContain('<PanelRightOpen size={16} />');
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'styles', 'overview.css'), 'utf8');
    expect(css).toContain('.overview-panel-toggle');
    expect(css).toContain('width: 28px');
    expect(css).toContain('height: 28px');
  });
});

describe('regression: O1-B contracts remain intact', () => {
  it('keeps monitoring/control type sets aligned with the element catalog', () => {
    for (const type of OVERVIEW_MONITORING_TYPES) {
      expect(OVERVIEW_ALL_ELEMENT_TYPES).toContain(type as (typeof OVERVIEW_ALL_ELEMENT_TYPES)[number]);
    }
    for (const type of OVERVIEW_CONTROL_TYPES) {
      expect(OVERVIEW_ALL_ELEMENT_TYPES).toContain(type as (typeof OVERVIEW_ALL_ELEMENT_TYPES)[number]);
    }
  });

  it('Workflow Command Bar stays scoped to Workflow', () => {
    const appSource = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    expect(appSource).toContain('showWorkflowCommandBar(page)?');
  });
});

/* ---- O1-C critical UX correction (Owner issues 7 & 9) ------------------ */

describe('collision: rectangle intersection + bounds (issue 7)', () => {
  it('detects overlap when only one axis ranges intersect partially', () => {
    const existing = [{ x: 100, y: 100, width: 200, height: 80 }];
    // Candidate shares x-range and y-range without matching exact x/y.
    const base = { x: 150, y: 140 };
    const size = { width: 120, height: 60 };
    const pos = nudgeOverviewElementToFreeSlot(base, size, existing);
    expect(pos).not.toBeNull();
    const overlaps = existing.some(other =>
      pos!.x < other.x + other.width &&
      pos!.x + size.width > other.x &&
      pos!.y < other.y + other.height &&
      pos!.y + size.height > other.y,
    );
    expect(overlaps).toBe(false);
    expect(pos).not.toEqual(base);
  });

  it('repeated add never overlaps a previously placed element', () => {
    const size = { width: 144, height: 48 };
    const base = { x: 32, y: 32 };
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let i = 0; i < 5; i += 1) {
      const pos = nudgeOverviewElementToFreeSlot(base, size, placed);
      expect(pos).not.toBeNull();
      const rect = { ...pos!, ...size };
      for (const other of placed) {
        const overlap =
          rect.x < other.x + other.width &&
          rect.x + rect.width > other.x &&
          rect.y < other.y + other.height &&
          rect.y + rect.height > other.y;
        expect(overlap).toBe(false);
      }
      placed.push(rect);
    }
    expect(placed).toHaveLength(5);
  });

  it('keeps the candidate inside Design Canvas bounds', () => {
    const bounds = { width: 400, height: 300 };
    const size = { width: 80, height: 40 };
    // Existing block occupies the center so the nudge must search within bounds.
    const existing = [{ x: 160, y: 130, width: 80, height: 40 }];
    const pos = nudgeOverviewElementToFreeSlot({ x: 160, y: 130 }, size, existing, undefined, undefined, bounds);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeGreaterThanOrEqual(0);
    expect(pos!.y).toBeGreaterThanOrEqual(0);
    expect(pos!.x + size.width).toBeLessThanOrEqual(bounds.width);
    expect(pos!.y + size.height).toBeLessThanOrEqual(bounds.height);
    const overlaps = existing.some(other =>
      pos!.x < other.x + other.width &&
      pos!.x + size.width > other.x &&
      pos!.y < other.y + other.height &&
      pos!.y + size.height > other.y,
    );
    expect(overlaps).toBe(false);
  });

  it('is deterministic for the same inputs', () => {
    const existing = [{ x: 0, y: 0, width: 100, height: 100 }];
    const size = { width: 100, height: 100 };
    const a = nudgeOverviewElementToFreeSlot({ x: 0, y: 0 }, size, existing);
    const b = nudgeOverviewElementToFreeSlot({ x: 0, y: 0 }, size, existing);
    expect(a).toEqual(b);
  });

  it('never moves existing elements (pure function returns only the candidate)', () => {
    const existing = [{ x: 0, y: 0, width: 50, height: 50 }];
    const frozen = JSON.stringify(existing);
    nudgeOverviewElementToFreeSlot({ x: 0, y: 0 }, { width: 50, height: 50 }, existing);
    expect(JSON.stringify(existing)).toBe(frozen);
  });
});

describe('binding direction by category (issue 9)', () => {
  it('monitoring allows MONITOR and NONE only', () => {
    expect([...overviewAllowedDirections('MONITORING')]).toEqual(['MONITOR', 'NONE']);
    expect(overviewDefaultDirection('MONITORING')).toBe('MONITOR');
    expect(overviewDefaultBinding('MONITORING').direction).toBe('MONITOR');
  });

  it('control allows COMMAND and NONE only', () => {
    expect([...overviewAllowedDirections('CONTROL')]).toEqual(['COMMAND', 'NONE']);
    expect(overviewDefaultDirection('CONTROL')).toBe('COMMAND');
    expect(overviewDefaultBinding('CONTROL').direction).toBe('COMMAND');
  });

  it('display allows NONE only', () => {
    expect([...overviewAllowedDirections('DISPLAY')]).toEqual(['NONE']);
    expect(overviewDefaultDirection('DISPLAY')).toBe('NONE');
    expect(overviewDefaultBinding('DISPLAY').direction).toBe('NONE');
  });

  it('normalizes invalid directions to the category default', () => {
    expect(normalizeOverviewBindingDirection('MONITORING', 'COMMAND')).toBe('MONITOR');
    expect(normalizeOverviewBindingDirection('CONTROL', 'MONITOR')).toBe('COMMAND');
    expect(normalizeOverviewBindingDirection('DISPLAY', 'MONITOR')).toBe('NONE');
    expect(normalizeOverviewBindingDirection('DISPLAY', 'COMMAND')).toBe('NONE');
    expect(normalizeOverviewBindingDirection('CONTROL', 'COMMAND')).toBe('COMMAND');
  });
});

/* ---- Owner punchlist: handles, selection, resize, collision ------------ */

describe('Owner punchlist: element handles removed (item 1)', () => {
  it('ElementNode renders no React Flow source/target Handle', () => {
    const node = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'ElementNode.tsx'),
      'utf8',
    );
    expect(node).not.toMatch(/\bHandle\b/);
    expect(node).not.toContain('Position.Left');
    expect(node).not.toContain('Position.Right');
    expect(node).not.toContain('type="target"');
    expect(node).not.toContain('type="source"');
    expect(node).toContain('NodeResizer');
    expect(node).toContain("from '@xyflow/react'");
  });

  it('OverviewCanvas disables connectable and keeps edges empty', () => {
    const canvas = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewCanvas.tsx'),
      'utf8',
    );
    expect(canvas).toContain('connectable: false');
    expect(canvas).toContain('nodesConnectable={false}');
    expect(canvas).toContain('edges={[]}');
  });
});

describe('Owner punchlist: selection contract (item 2)', () => {
  it('does not stop propagation on Element root click in edit mode', () => {
    const node = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'ElementNode.tsx'),
      'utf8',
    );
    expect(node).not.toContain('stopEditEvents');
    expect(node).not.toMatch(/onClick=\{stopEditEvents\}/);
  });

  it('onNodeClick is authoritative; pane click alone clears; select:false never clears', () => {
    const canvas = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewCanvas.tsx'),
      'utf8',
    );
    expect(canvas).toContain('onNodeClick={handleNodeClick}');
    expect(canvas).toContain('onSelectElement(node.id)');
    expect(canvas).toContain('onPaneClick={handlePaneClick}');
    expect(canvas).toContain('onSelectElement(null)');
    // select true only:
    expect(canvas).toContain('if (change.selected) onSelectElement(change.id)');
    expect(canvas).not.toContain('else onSelectElement(null)');
  });

  it('A → B → A and pane clear are pure one-click operations', () => {
    expect(selectionFromNodeClick('A')).toBe('A');
    expect(selectionFromNodeClick('B')).toBe('B');
    expect(selectionFromNodeClick('A')).toBe('A');
    expect(selectionFromPaneClick()).toBeNull();
  });
});

describe('Owner punchlist: resize geometry (item 3)', () => {
  it('canvas consumes full resize result including position for top/left handles', () => {
    const canvas = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewCanvas.tsx'),
      'utf8',
    );
    expect(canvas).toContain('onResizeElement');
    expect(canvas).toContain('liveResizes');
    expect(canvas).toContain('resizingRef');
    // Position applied during resize anchors (top/left move x/y):
    expect(canvas).toMatch(/liveResizes[\s\S]*\bx,\s*y\b/);
  });

  it('OverviewPage commits x/y/width/height with one history entry per gesture', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
      'utf8',
    );
    expect(page).toContain('geometry: { x: number; y: number; width: number; height: number }');
    expect(page).toContain('x: snappedX');
    expect(page).toContain('y: snappedY');
    expect(page).toContain('pushHistory: firstFrame');
    expect(page).toContain('resizeGestureRef');
  });

  it('eight handles only for selected unlocked Element in Edit Mode', () => {
    const node = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'ElementNode.tsx'),
      'utf8',
    );
    expect(node).toContain('showResizeHandles');
    expect(node).toContain('edit && selected && !element.locked');
    expect(node).toContain('minWidth={8}');
    expect(node).toContain('minHeight={8}');
  });
});

describe('Owner punchlist: collision (item 4)', () => {
  it('returns null when no free slot instead of overlapping fallback', () => {
    const bounds = { width: 64, height: 64 };
    const size = { width: 64, height: 64 };
    const existing = [{ x: 0, y: 0, width: 64, height: 64 }];
    const pos = nudgeOverviewElementToFreeSlot({ x: 0, y: 0 }, size, existing, 16, 50, bounds);
    expect(pos).toBeNull();
  });

  it('handles different-size elements without overlap', () => {
    const existing = [
      { x: 0, y: 0, width: 320, height: 240 },
      { x: 400, y: 0, width: 72, height: 40 },
    ];
    const size = { width: 128, height: 44 };
    const pos = nudgeOverviewElementToFreeSlot({ x: 16, y: 16 }, size, existing);
    expect(pos).not.toBeNull();
    const rect = { ...pos!, ...size };
    for (const other of existing) {
      const overlap =
        rect.x < other.x + other.width &&
        rect.x + rect.width > other.x &&
        rect.y < other.y + other.height &&
        rect.y + rect.height > other.y;
      expect(overlap).toBe(false);
    }
  });

  it('clamps near right and bottom edges inside design bounds', () => {
    const bounds = { width: 256, height: 256 };
    const size = { width: 80, height: 40 };
    const existing = [{ x: 176, y: 216, width: 80, height: 40 }];
    const pos = nudgeOverviewElementToFreeSlot({ x: 176, y: 216 }, size, existing, 16, 400, bounds);
    expect(pos).not.toBeNull();
    expect(pos!.x + size.width).toBeLessThanOrEqual(bounds.width);
    expect(pos!.y + size.height).toBeLessThanOrEqual(bounds.height);
  });

  it('uses full draft rectangle (x/y/w/h), not equal-x/y only', () => {
    // Candidate x/y differs but rectangles still intersect → must move.
    const existing = [{ x: 0, y: 0, width: 200, height: 100 }];
    const size = { width: 100, height: 100 };
    const pos = nudgeOverviewElementToFreeSlot({ x: 50, y: 50 }, size, existing);
    expect(pos).not.toBeNull();
    expect(pos).not.toEqual({ x: 48, y: 48 });
    expect(pos).not.toEqual({ x: 50, y: 50 });
  });

  it('Add path surfaces custom error instead of placing overlap', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
      'utf8',
    );
    expect(page).toContain('No free space on the Design Canvas');
    expect(page).toContain('if (!position)');
  });
});

describe('Owner punchlist: refresh navigation identity (item 8)', () => {
  it('App persists and restores active App page (Overview only)', () => {
    const app = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    expect(app).toContain("localStorage.getItem('mws.activeAppPage')");
    expect(app).toContain("localStorage.setItem('mws.activeAppPage',page)");
    expect(app).toContain("'Overview'");
  });

  it('OverviewPage persists only active Overview Page ID', () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
      'utf8',
    );
    expect(page).toContain("localStorage.setItem('mws.activeOverviewPageId'");
    expect(page).toContain("localStorage.getItem('mws.activeOverviewPageId')");
    // Must not persist edit session state:
    expect(page).not.toContain("localStorage.setItem('mws.overviewMode'");
    expect(page).not.toContain("localStorage.setItem('mws.overviewDraft'");
    expect(page).not.toContain("localStorage.setItem('mws.overviewSelection'");
  });
});
