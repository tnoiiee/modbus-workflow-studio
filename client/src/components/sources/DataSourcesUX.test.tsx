import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DataSourcesPage, DefinitionTable } from './DataSourcesPage.js';
import { DefinitionCatalogEditor } from '../overview/DefinitionCatalogEditor.js';
import { DeleteDefinitionDialog } from './DeleteDefinitionDialog.js';
import { Modal } from '../ui/Modal.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
import * as api from '../../lib/overviewApi.js';

// Component event harness, not DOM/browser hit-testing. Uses existing React/Vitest only.
const hooks = vi.hoisted(() => ({ slots: [] as any[], index: 0, effects: [] as Array<() => any> }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual,
    useState: (initial: any) => {
      const index = hooks.index++;
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.slots[index], (next: any) => { hooks.slots[index] = typeof next === 'function' ? next(hooks.slots[index]) : next; }];
    },
    useRef: (initial: any) => { const index = hooks.index++; return hooks.slots[index] ?? (hooks.slots[index] = { current: initial }); },
    useId: () => `test-${hooks.index++}`,
    useEffect: (effect: () => any) => { hooks.effects.push(effect); },
    useCallback: (fn: any) => fn, useMemo: (fn: () => any) => fn(),
  };
});
vi.mock('../../lib/overviewApi.js', () => ({ fetchSourceDefinitions: vi.fn(), fetchDefinitionWorkflows: vi.fn(), fetchDefinitionReferences: vi.fn(), updateSourceDefinition: vi.fn(), createSourceDefinition: vi.fn() }));
const shared: SourceDefinition = { sourceType: 'SHARED_TAG', sourceId: 's1', name: 'Pressure', description: 'Outlet', unit: 'bar', dataType: 'Number', capability: 'MONITOR_ONLY', enabled: true };
const variable: SourceDefinition = { ...shared, sourceType: 'WORKFLOW_VARIABLE', workflowId: 'w1', variableId: 'v1', name: 'Trip' };
function nodes(node: ReactNode): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement(node)) return [];
  return [node, ...nodes((node.props as any).children)];
}
const draw = (fn: () => ReactNode) => { hooks.index = 0; hooks.effects = []; return nodes(fn()); };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const byType = (tree: ReactElement<any>[], type: any) => tree.find(node => node.type === type)!;
const button = (tree: ReactElement<any>[], text: string) => tree.find(node => node.type === 'button' && node.props.children === text)!;
beforeEach(() => {
  hooks.slots = []; hooks.index = 0; hooks.effects = []; vi.clearAllMocks();
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.mocked(api.fetchSourceDefinitions).mockResolvedValue([shared, variable]);
  vi.mocked(api.fetchDefinitionWorkflows).mockResolvedValue([{ id: 'w1', name: 'Kiln' }]);
  vi.mocked(api.updateSourceDefinition).mockResolvedValue(shared); vi.mocked(api.createSourceDefinition).mockResolvedValue(shared);
  vi.mocked(api.fetchDefinitionReferences).mockResolvedValue({ scope: 'SAVED_OVERVIEW_PAGES', pageCount: 1, bindingCount: 2, references: [] });
});
afterEach(() => vi.unstubAllGlobals());
async function loadedPage() { draw(DataSourcesPage); hooks.effects[0](); await flush(); return draw(DataSourcesPage); }
describe('dev.3 Data Sources interaction surface', () => {
  it('loads configuration lists, then source-type/search/status filters compose without API calls', async () => {
    let tree = await loadedPage(); expect(byType(tree, DefinitionTable).props.definitions).toHaveLength(2);
    button(tree, 'Shared tags').props.onClick(); tree = draw(DataSourcesPage); expect(byType(tree, DefinitionTable).props.definitions).toEqual([shared]);
    tree.find(node => node.type === 'input' && node.props.type === 'search')!.props.onChange({ target: { value: 'not found' } });
    tree = draw(DataSourcesPage); expect(tree.some(node => node.type === 'h3' && node.props.children === 'No matching definitions')).toBe(true);
    button(tree, 'Clear filters').props.onClick(); tree = draw(DataSourcesPage);
    byType(tree, 'select').props.onChange({ target: { value: 'DISABLED' } }); tree = draw(DataSourcesPage);
    expect(tree.some(node => node.type === DefinitionTable)).toBe(false); expect(api.fetchSourceDefinitions).toHaveBeenCalledTimes(1);
  });
  it('opens row Edit directly; close removes editor and keeps configuration page', async () => {
    let tree = await loadedPage(); byType(tree, DefinitionTable).props.onEdit(variable); tree = draw(DataSourcesPage);
    expect(byType(tree, DefinitionCatalogEditor).props.initialDefinition).toBe(variable);
    byType(tree, DefinitionCatalogEditor).props.onClose(); expect(draw(DataSourcesPage).some(node => node.type === DefinitionCatalogEditor)).toBe(false);
  });
  it('direct Enable/Disable uses only the existing metadata PATCH helper', async () => {
    const tree = await loadedPage(); byType(tree, DefinitionTable).props.onToggle(shared); await flush();
    expect(api.updateSourceDefinition).toHaveBeenCalledWith(shared, { enabled: false });
    expect(api.createSourceDefinition).not.toHaveBeenCalled(); expect(api.fetchSourceDefinitions).toHaveBeenCalledTimes(2);
  });
  it('Delete opens existing impact confirmation; Cancel closes without metadata write', async () => {
    let tree = await loadedPage(); byType(tree, DefinitionTable).props.onDelete(shared); tree = draw(DataSourcesPage);
    expect(byType(tree, DeleteDefinitionDialog).props.definition).toBe(shared);
    byType(tree, DeleteDefinitionDialog).props.onClose(); expect(draw(DataSourcesPage).some(node => node.type === DeleteDefinitionDialog)).toBe(false);
    expect(api.updateSourceDefinition).not.toHaveBeenCalled();
  });
  it('reference counts are fetched on request only, with exact identity and no background sweep', async () => {
    let tree = await loadedPage(); expect(api.fetchDefinitionReferences).not.toHaveBeenCalled();
    byType(tree, DefinitionTable).props.onReferences(variable); await flush(); tree = draw(DataSourcesPage);
    expect(api.fetchDefinitionReferences).toHaveBeenCalledWith({ sourceType: 'WORKFLOW_VARIABLE', workflowId: 'w1', variableId: 'v1' });
    expect(byType(tree, DefinitionTable).props.references['WORKFLOW_VARIABLE:w1:v1'].count).toBe(2);
  });
  it('renders a loading status, actionable empty state and retryable error', async () => {
    let tree = draw(DataSourcesPage); expect(tree.some(node => node.props.role === 'status' && node.props.children === 'Loading definitions…')).toBe(true);
    vi.mocked(api.fetchSourceDefinitions).mockResolvedValue([]); hooks.effects[0](); await flush(); tree = draw(DataSourcesPage);
    button(tree, 'Create your first definition').props.onClick(); expect(byType(draw(DataSourcesPage), DefinitionCatalogEditor)).toBeDefined();
    hooks.slots = []; vi.mocked(api.fetchSourceDefinitions).mockRejectedValue(new Error('offline'));
    draw(DataSourcesPage); hooks.effects[0](); await flush(); tree = draw(DataSourcesPage);
    expect(tree.some(node => node.props.role === 'alert')).toBe(true); expect(button(tree, 'Retry loading definitions')).toBeDefined();
  });
  it('rows expose native keyboard actions, non-color status, unit and compact stable identity', () => {
    const edit = vi.fn(), toggle = vi.fn(), remove = vi.fn();
    const tree = nodes(DefinitionTable({ definitions: [shared], workflows: [], busy: false, references: {}, onEdit: edit, onToggle: toggle, onDelete: remove, onReferences: vi.fn() }));
    button(tree, 'Edit').props.onClick(); button(tree, 'Disable').props.onClick(); button(tree, 'Delete').props.onClick();
    expect(edit).toHaveBeenCalledWith(shared); expect(toggle).toHaveBeenCalledWith(shared); expect(remove).toHaveBeenCalledWith(shared);
    expect(tree.some(node => node.type === 'details')).toBe(true); expect(tree.some(node => node.props.children === 'bar')).toBe(true);
    expect(tree.some(node => node.props.children === 'Enabled')).toBe(true);
  });
});
describe('dev.3 focused definition form and dialog accessibility', () => {
  it.each([shared, variable])('saves existing metadata without changing immutable identity: $sourceType', async definition => {
    const close = vi.fn(), changed = vi.fn(async () => {});
    const props = { initialDefinition: definition, definitions: [definition], workflows: [{ id: 'w1', name: 'Kiln' }], available: true, onClose: close, onChanged: changed };
    let tree = draw(() => DefinitionCatalogEditor(props));
    const name = tree.find(node => node.type === 'input' && node.props.maxLength === 100)!;
    name.props.onChange({ target: { value: 'Renamed' } }); tree = draw(() => DefinitionCatalogEditor(props));
    byType(tree, 'form').props.onSubmit({ preventDefault: vi.fn() }); await flush();
    expect(api.updateSourceDefinition).toHaveBeenCalledWith(definition, expect.objectContaining({ name: 'Renamed' }));
    expect(changed).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
  });
  it('Create uses selected type, required fields, and associates the name error with its input', async () => {
    const props = { initialSourceType: 'SHARED_TAG' as const, definitions: [], workflows: [], available: true, onClose: vi.fn(), onChanged: vi.fn(async () => {}) };
    let tree = draw(() => DefinitionCatalogEditor(props));
    let name = tree.find(node => node.type === 'input' && node.props.maxLength === 100)!;
    name.props.onBlur(); tree = draw(() => DefinitionCatalogEditor(props)); name = tree.find(node => node.type === 'input' && node.props.maxLength === 100)!;
    expect(name.props['aria-invalid']).toBe(true); expect(name.props['aria-describedby']).toBeTruthy();
    byType(tree, 'form').props.onSubmit({ preventDefault: vi.fn() }); expect(api.createSourceDefinition).not.toHaveBeenCalled();
    name.props.onChange({ target: { value: 'New tag' } }); tree = draw(() => DefinitionCatalogEditor(props));
    byType(tree, 'form').props.onSubmit({ preventDefault: vi.fn() }); await flush();
    expect(api.createSourceDefinition).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SHARED_TAG', name: 'New tag' }));
  });
  it('existing Modal focuses initial input, cycles Tab, supports Escape and returns to invoker', () => {
    const listeners = new Map<string, any>(); const documentStub = { activeElement: null as any, addEventListener: (type: string, handler: any) => listeners.set(type, handler), removeEventListener: vi.fn() };
    class Focusable { focus = vi.fn(() => { documentStub.activeElement = this; }); }
    vi.stubGlobal('HTMLElement', Focusable); vi.stubGlobal('document', documentStub);
    const invoker = new Focusable(), first = new Focusable(), last = new Focusable(); documentStub.activeElement = invoker;
    const close = vi.fn(); draw(() => Modal({ open: true, title: 'Edit', onClose: close, initialFocusRef: { current: first as any } }));
    hooks.slots[0].current = { querySelectorAll: () => [first, last], contains: (item: any) => [first, last].includes(item), focus: vi.fn() };
    hooks.effects[0](); const cleanup = hooks.effects[1](); expect(first.focus).toHaveBeenCalled();
    documentStub.activeElement = last; listeners.get('keydown')({ key: 'Tab', preventDefault: vi.fn() }); expect(documentStub.activeElement).toBe(first);
    listeners.get('keydown')({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() }); expect(close).toHaveBeenCalledTimes(1);
    cleanup(); expect(invoker.focus).toHaveBeenCalledTimes(1);
  });
  it('new configuration UI owns no Overview mutation, transport or command path', () => {
    const page = readFileSync(new URL('./DataSourcesPage.tsx', import.meta.url), 'utf8');
    expect(page).not.toMatch(/setDraft|setHistory|updateOverviewPage|setInterval|WebSocket|\/runtime|\/write/);
    expect(page).toContain('createRef.current?.focus()');
  });
});
