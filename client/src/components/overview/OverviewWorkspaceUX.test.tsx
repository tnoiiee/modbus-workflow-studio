import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewPage } from './OverviewPage.js';
import { OverviewCanvas } from './OverviewCanvas.js';
import { OverviewCommandBar } from './OverviewCommandBar.js';
import { ElementInspector } from './ElementInspector.js';
import { createOverviewElement } from '../../lib/overviewElements.js';
import { overviewInspectorPresentation } from '../../lib/overviewWorkspace.js';
import * as api from '../../lib/overviewApi.js';

// Hook/event harness: executes the actual Page callbacks. No browser layout claim.
const hooks = vi.hoisted(() => ({ slots: [] as any[], index: 0, effects: [] as Array<() => any> }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual,
    useState: (initial: any) => { const index = hooks.index++; if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.slots[index], (next: any) => { hooks.slots[index] = typeof next === 'function' ? next(hooks.slots[index]) : next; }]; },
    useRef: (initial: any) => { const index = hooks.index++; return hooks.slots[index] ?? (hooks.slots[index] = { current: initial }); },
    useEffect: (effect: () => any) => { hooks.effects.push(effect); }, useCallback: (fn: any) => fn, useMemo: (fn: () => any) => fn(),
  };
});
vi.mock('../../lib/overviewApi.js', () => ({ fetchSourceDefinitions: vi.fn(), fetchDefinitionWorkflows: vi.fn(), fetchOverviewPages: vi.fn(), fetchOverviewPage: vi.fn(), fetchOverviewControlStates: vi.fn(), updateOverviewPage: vi.fn(), patchOverviewControlState: vi.fn(), createOverviewPage: vi.fn(), deleteOverviewPage: vi.fn(), duplicateOverviewPage: vi.fn(), renameOverviewPage: vi.fn() }));
function nodes(node: ReactNode): ReactElement<any>[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement(node)) return []; return [node, ...nodes((node.props as any).children)]; }
const openSources = vi.fn();
const draw = (active = true) => { hooks.index = 0; hooks.effects = []; return nodes(OverviewPage({ active, onOpenDataSources: openSources })); };
const component = (tree: ReactElement<any>[], type: any) => tree.find(node => node.type === type)!;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const inspector = (tree: ReactElement<any>[]) => tree.find(node => node.type === ElementInspector);
const workspace = (tree: ReactElement<any>[]) => tree.find(node => typeof node.props.className === 'string' && node.props.className.startsWith('overview__workspace'))!;
beforeEach(() => {
  hooks.slots = []; hooks.index = 0; hooks.effects = []; vi.clearAllMocks();
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.mocked(api.fetchSourceDefinitions).mockResolvedValue([]); vi.mocked(api.fetchDefinitionWorkflows).mockResolvedValue([]);
  vi.mocked(api.fetchOverviewControlStates).mockResolvedValue([]);
  const a = createOverviewElement('TEXT_LABEL', { id: 'A', x: 16, y: 32 }); a.name = 'Element A';
  const b = createOverviewElement('SWITCH', { id: 'B', x: 160, y: 32 }); b.name = 'Element B';
  const page = { id: 'page', name: 'Overview', description: '', designWidth: 1920, designHeight: 1080, backgroundColor: '#000', backgroundImage: null,
    elements: [{ ...a }, { ...b }], elementCount: 2, layerOrder: ['A', 'B'], revision: 7, createdAt: '', modifiedAt: '', savedViewport: { x: 73, y: -21, zoom: 0.75 } };
  vi.mocked(api.fetchOverviewPages).mockResolvedValue([page]); vi.mocked(api.fetchOverviewPage).mockResolvedValue(page);
});
afterEach(() => vi.unstubAllGlobals());
async function loaded() {
  draw(); const effects = [...hooks.effects]; effects.forEach(effect => effect()); await flush();
  let tree = draw(); component(tree, OverviewCommandBar).props.onEdit(); return draw();
}
describe('dev.4 Inspector entire-panel visibility / protected Page state', () => {
  it('initial Edit with no selection mounts neither Inspector panel nor collapsed rail', async () => {
    const tree = await loaded(); expect(inspector(tree)).toBeUndefined();
    expect(tree.some(node => node.props.className?.includes('overview-inspector'))).toBe(false);
    expect(workspace(tree).props.className).toContain('overview__workspace--inspector-hidden');
  });
  it('A → blank → B restores correct fields while selection leaves Draft, history, revision and viewport untouched', async () => {
    let tree = await loaded(); const initial = component(tree, OverviewCanvas).props;
    const command = component(tree, OverviewCommandBar).props;
    initial.onSelectElement('A'); tree = draw(); expect(inspector(tree)?.props.element.name).toBe('Element A');
    component(tree, OverviewCanvas).props.onSelectElement(null); tree = draw(); expect(inspector(tree)).toBeUndefined();
    component(tree, OverviewCanvas).props.onSelectElement('B'); tree = draw(); expect(inspector(tree)?.props.element.name).toBe('Element B');
    const final = component(tree, OverviewCanvas).props, after = component(tree, OverviewCommandBar).props;
    expect(final.elements).toBe(initial.elements); expect(final.viewport).toEqual(initial.viewport); expect(final.restoreViewportEpoch).toBe(initial.restoreViewportEpoch);
    expect(after.saveState).toBe(command.saveState); expect(after.revision).toBe(command.revision);
    expect(after.canUndo).toBe(command.canUndo); expect(after.canRedo).toBe(command.canRedo);
    expect(api.updateOverviewPage).not.toHaveBeenCalled(); expect(api.patchOverviewControlState).not.toHaveBeenCalled();
  });
  it('field edits, selected drag/resize and Data Sources navigation do not hide the selected Inspector', async () => {
    let tree = await loaded(); component(tree, OverviewCanvas).props.onSelectElement('A'); tree = draw();
    inspector(tree)!.props.onPatch({ name: 'Changed A' }); tree = draw(); expect(inspector(tree)?.props.element.name).toBe('Changed A');
    component(tree, OverviewCanvas).props.onMoveElement('A', 48, 64); tree = draw(); expect(inspector(tree)?.props.element.id).toBe('A');
    component(tree, OverviewCanvas).props.onResizeElement('A', { x: 48, y: 64, width: 240, height: 80 }); tree = draw(); expect(inspector(tree)?.props.element.id).toBe('A');
    tree.find(node => node.type === 'button' && node.props.children === 'Data Sources')!.props.onClick(); expect(openSources).toHaveBeenCalledTimes(1);
    expect(inspector(draw(false))?.props.element.id).toBe('A'); expect(inspector(draw(true))?.props.element.id).toBe('A');
    expect(api.updateOverviewPage).not.toHaveBeenCalled();
  });
  it('no selection hides even a collapsed Inspector; user collapse preference remains presentation-only', () => {
    expect(overviewInspectorPresentation('EDIT', null, true)).toBe('hidden');
    expect(overviewInspectorPresentation('EDIT', 'B', false)).toBe('expanded');
    expect(overviewInspectorPresentation('EDIT', 'B', true)).toBe('collapsed');
    expect(overviewInspectorPresentation('VIEW', 'B', false)).toBe('hidden');
    const css = readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.overview--edit \.overview__workspace--inspector-hidden\s*\{\s*grid-template-columns: var\(--shell-library-width\) minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.overview__workspace--inspector-hidden\.overview__workspace--library-collapsed\s*\{\s*grid-template-columns: 44px minmax\(0, 1fr\)/);
  });
});
