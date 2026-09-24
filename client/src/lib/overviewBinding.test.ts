import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  OVERVIEW_ALL_ELEMENT_TYPES, createOverviewElement, patchOverviewBinding,
  validateOverviewBinding, validateOverviewElements, emptyOverviewHistory,
  pushOverviewHistory, undoOverviewHistory, redoOverviewHistory,
} from './overviewElements.js';

const element = () => createOverviewElement('SWITCH', { id: 'switch', x: 0, y: 0 });
const page = { id: 'page', layerOrder: ['switch'] };

describe('O1-D configuration-only binding', () => {
  it.each(OVERVIEW_ALL_ELEMENT_TYPES)('accepts existing %s defaults without changing geometry', type => {
    const value = createOverviewElement(type, { id: 'switch', x: 16, y: 32 });
    const snapshot = JSON.stringify(value);
    expect(validateOverviewElements(page, [value])).toEqual([]);
    expect(JSON.stringify(value)).toBe(snapshot);
  });
  it('derives DRAFT from trimmed identity, and preserves all five fields', () => {
    const original = element();
    const binding = patchOverviewBinding(original.category, original.binding, {
      tagId: '  plant.pump  ', tagName: ' Pump ', dataType: 'Boolean', direction: 'COMMAND',
    });
    expect(binding).toEqual({ tagId: 'plant.pump', tagName: 'Pump', dataType: 'Boolean', direction: 'COMMAND', status: 'DRAFT' });
    expect(original.binding.status).toBe('NOT_BOUND');
    expect(validateOverviewBinding(original.category, binding)).toEqual([]);
    expect(patchOverviewBinding(original.category, binding, { tagId: '  ' })).toEqual({ ...binding, tagId: '', status: 'NOT_BOUND' });
  });
  it.each(['Boolean', 'Number', 'String', 'Unknown'] as const)('allows %s draft metadata without resolving a Tag', dataType => {
    const binding = { ...element().binding, tagId: 'not-in-any-registry', status: 'DRAFT', dataType };
    expect(validateOverviewBinding('CONTROL', binding)).toEqual([]);
  });
  it.each([
    [null, 'required'],
    [{ tagId: 4 }, 'Tag ID'],
    [{ ...element().binding, tagName: false }, 'Tag Name'],
    [{ ...element().binding, dataType: 'Float32' }, 'Data Type'],
    [{ ...element().binding, status: 'CONNECTED' }, 'status'],
    [{ ...element().binding, status: 'DRAFT', tagId: ' ' }, 'Tag ID'],
    [{ ...element().binding, tagId: 'pump' }, 'DRAFT'],
    [{ ...element().binding, direction: 'MONITOR' }, 'COMMAND or NONE'],
  ])('rejects invalid binding %j', (binding, expected) => {
    expect(validateOverviewBinding('CONTROL', binding).join(' ')).toContain(expected);
  });
  it('binding changes use the existing history contract', () => {
    const before = element();
    const after = { ...before, binding: patchOverviewBinding(before.category, before.binding, { tagId: 'pump' }) };
    const history = pushOverviewHistory(emptyOverviewHistory(), [before]);
    const undone = undoOverviewHistory(history, [after]);
    if (!undone) throw new Error('Expected Undo result');
    expect(undone.value).toEqual([before]);
    expect(redoOverviewHistory(undone.history, undone.value)?.value).toEqual([after]);
    expect(after.x).toBe(before.x);
    expect(after.width).toBe(before.width);
  });
  it.each([
    { name: '' }, { width: NaN }, { height: 0 }, { rotation: Infinity }, { zIndex: 1.5 },
    { style: { ...element().style, fontSize: 0 } },
    { style: { ...element().style, borderWidth: -1 } },
    { style: { ...element().style, alignment: 'invalid' } },
  ])('rejects invalid configuration without mutating Draft %j', patch => {
    const draft = { ...element(), ...patch } as ReturnType<typeof element>;
    const snapshot = JSON.stringify(draft);
    expect(validateOverviewElements(page, [draft]).length).toBeGreaterThan(0);
    expect(JSON.stringify(draft)).toBe(snapshot);
  });
  it('Save integration returns before PUT on invalid Draft and keeps the editor state', () => {
    const source = readFileSync(new URL('../components/overview/OverviewPage.tsx', import.meta.url), 'utf8');
    const start = source.indexOf('const confirmSaveAndExit =');
    const request = source.indexOf('await updateOverviewPage(', start);
    const guard = source.slice(source.indexOf('if (validationErrors.length > 0)', start), source.indexOf('setSaveConfirmPending(true)', start));
    expect(request).toBeGreaterThan(start);
    expect(guard).toContain('setSaveConfirmError');
    expect(guard).toContain('return;');
    expect(guard).not.toMatch(/setDraft|setMode|setHistory|updateOverviewPage/);
  });
});
