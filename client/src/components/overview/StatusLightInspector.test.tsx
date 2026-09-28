import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ElementInspector } from './ElementInspector.js';
import { createOverviewElement, emptyOverviewHistory, pushOverviewHistory, undoOverviewHistory, redoOverviewHistory } from '../../lib/overviewElements.js';
import { beginOverviewEdit, cancelOverviewEdit, finishOverviewSave } from '../../lib/overviewState.js';

// Deterministic callback harness, not a mounted browser/keyboard test.
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useId: () => 'inspector-test' }));
function nodes(node: ReactNode): any[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement(node)) return []; return [node, ...nodes((node.props as any).children)]; }
function fixture(type: 'STATUS_LIGHT' | 'NUMERIC_LABEL' = 'STATUS_LIGHT', legacy = false, locked = false) {
  const element = createOverviewElement(type, { id: 'light', x: 32, y: 48 });
  if (legacy) delete element.style.showText; element.locked = locked;
  const patch = vi.fn(), other = vi.fn();
  const tree = ElementInspector({ element, onPatchStyle: patch, onPatch: other, onPatchBinding: other, onToggleLock: other, onToggleVisible: other, onDuplicate: other, onDelete: other, onBringForward: other, onBringToFront: other, onSendBackward: other, onSendToBack: other });
  const field = nodes(tree).find(n => n.type === 'select' && n.props['aria-label'] === 'Show Text');
  return { element, patch, other, tree, field };
}
describe('dev.13 Show Text Inspector uses the existing draft style path', () => {
  it('Off/On commits only a boolean style patch, with no command or Binding callback', () => {
    const f = fixture(); expect(f.field.props.value).toBe('off');
    f.field.props.onChange({ target: { value: 'on' } }); expect(f.patch).toHaveBeenLastCalledWith({ showText: true });
    f.field.props.onChange({ target: { value: 'off' } }); expect(f.patch).toHaveBeenLastCalledWith({ showText: false });
    expect(f.patch).toHaveBeenCalledTimes(2); expect(f.other).not.toHaveBeenCalled(); expect(f.element.style.showText).toBe(false);
  });
  it('legacy default is On without a write; other types have no Show Text field', () => {
    const f = fixture('STATUS_LIGHT', true); expect(f.field.props.value).toBe('on'); expect(f.patch).not.toHaveBeenCalled();
    expect(f.element.style).not.toHaveProperty('showText'); expect(fixture('NUMERIC_LABEL').field).toBeUndefined();
  });
  it('locked Appearance fieldset disables Show Text like the other appearance fields', () => {
    const f = fixture('STATUS_LIGHT', false, true);
    const group = nodes(f.tree).find(n => n.type === 'fieldset' && nodes(n).includes(f.field));
    expect(group.props.disabled).toBe(true);
  });
  it('one immutable style edit supports existing Undo/Redo, Cancel and Save without geometry/viewport drift', () => {
    const { element } = fixture();
    const page = { id: 'page', revision: 7, elements: [element], layerOrder: [element.id], savedViewport: { x: 24, y: 32, zoom: 1.25 } } as any;
    const before = JSON.stringify(page), session = beginOverviewEdit(page);
    const edited = { ...element, style: { ...element.style, showText: true } };
    const history = pushOverviewHistory(emptyOverviewHistory(), [element]);
    const undo = undoOverviewHistory(history, [edited])!; expect(undo.value[0].style.showText).toBe(false);
    const redo = redoOverviewHistory(undo.history, undo.value)!; expect(redo.value[0].style.showText).toBe(true);
    expect(cancelOverviewEdit(page).draft.elements).toEqual(page.elements);
    const saved = { ...page, elements: [edited], revision: 8 }; const view = finishOverviewSave(saved);
    expect(view.mode).toBe('VIEW'); expect(view.draft.elements).toEqual(saved.elements);
    expect(JSON.stringify(page)).toBe(before); expect(session.draft.savedViewport).toEqual(page.savedViewport);
    const { showText: _, ...style } = edited.style; const { showText: __, ...oldStyle } = element.style; expect(style).toEqual(oldStyle);
    expect({ ...edited, style: element.style }).toEqual(element);
  });
});
