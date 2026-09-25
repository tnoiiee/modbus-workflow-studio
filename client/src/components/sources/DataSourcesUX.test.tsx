import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DataSourcesPage, DefinitionTable } from './DataSourcesPage.js';
import { DefinitionCatalogEditor } from '../overview/DefinitionCatalogEditor.js';
import { DeleteDefinitionDialog } from './DeleteDefinitionDialog.js';
import { ReferenceDetails } from './ReferenceDetails.js';
import { definitionKey } from '../../lib/definitionList.js';
import { definitionIdentity } from '../../lib/sourceDefinitions.js';
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
vi.mock('../../lib/overviewApi.js', () => ({ fetchSourceDefinitions: vi.fn(), fetchDefinitionWorkflows: vi.fn(), fetchDefinitionReferences: vi.fn(), fetchDefinitionReferenceBatch: vi.fn(), updateSourceDefinition: vi.fn(), createSourceDefinition: vi.fn() }));
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
  vi.mocked(api.fetchDefinitionReferenceBatch).mockImplementation(async sources => ({ scope: 'SAVED_OVERVIEW_PAGES', unsavedDraftsIncluded: false, results: sources.map(source => ({ source, found: true, pageCount: 1, bindingCount: 2 })) }));
  vi.mocked(api.fetchDefinitionReferences).mockResolvedValue({ scope: 'SAVED_OVERVIEW_PAGES', pageCount: 1, bindingCount: 2, references: [] });
});
afterEach(() => vi.unstubAllGlobals());
async function loadedPage() { draw(DataSourcesPage); hooks.effects[0](); await flush(); return draw(DataSourcesPage); }
describe('dev.3 Data Sources interaction surface', () => {
  it('loads configuration lists, then source-type/search/status filters compose without API calls', async () => {
    let tree = await loadedPage(); expect(byType(tree, DefinitionTable).props.definitions).toHaveLength(2);
    button(tree, 'Shared Tags').props.onClick(); tree = draw(DataSourcesPage); expect(byType(tree, DefinitionTable).props.definitions).toEqual([shared]);
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
  it('reference counts load automatically in one batch; details load only for the activated identity', async () => {
    let tree = await loadedPage(); expect(api.fetchDefinitionReferences).not.toHaveBeenCalled();
    expect(api.fetchDefinitionReferenceBatch).toHaveBeenCalledWith([definitionIdentity(shared), definitionIdentity(variable)]);
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
  it.each(['Create', 'Edit', 'Delete'])('%s Modal focuses initial input, cycles Tab, supports Escape and returns to invoker', title => {
    const listeners = new Map<string, any>(); const documentStub = { activeElement: null as any, addEventListener: (type: string, handler: any) => listeners.set(type, handler), removeEventListener: vi.fn() };
    class Focusable { focus = vi.fn(() => { documentStub.activeElement = this; }); }
    vi.stubGlobal('HTMLElement', Focusable); vi.stubGlobal('document', documentStub);
    const invoker = new Focusable(), first = new Focusable(), last = new Focusable(); documentStub.activeElement = invoker;
    const close = vi.fn(); draw(() => Modal({ open: true, title, onClose: close, initialFocusRef: { current: first as any } }));
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

describe('dev.4 readable responsive definition rows', () => {
  it('preserves Unit exactly, names every action, shows every critical cell and uses only loaded reference counts', () => {
    const definition = { ...shared, unit: '  kPa / raw  ' }; const before = JSON.stringify(definition);
    const tree = nodes(DefinitionTable({ definitions: [definition], workflows: [], busy: false, references: {}, onEdit: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn(), onReferences: vi.fn() }));
    expect(byType(tree, 'table').props.role).toBe('table');
    expect(tree.filter(node => node.props.role === 'columnheader')).toHaveLength(8);
    expect(tree.filter(node => node.props.role === 'rowheader')).toHaveLength(1);
    expect(tree.filter(node => node.props.role === 'cell')).toHaveLength(7);
    expect(tree.find(node => node.props['data-label'] === 'Unit')!.props.children).toBe('  kPa / raw  ');
    expect(tree.some(node => node.props['data-label'] === 'Status')).toBe(true);
    expect(button(tree, 'Edit').props['aria-label']).toBe('Edit Pressure'); expect(button(tree, 'Disable').props['aria-label']).toBe('Disable Pressure');
    expect(button(tree, 'Delete').props['aria-label']).toBe('Delete Pressure');
    expect(tree.some(node => node.props.children === 'Loading references…')).toBe(true); expect(api.fetchDefinitionReferences).not.toHaveBeenCalled();
    expect(JSON.stringify(definition)).toBe(before);
  });
});

describe('dev.4 removed invoker focus fallback', () => {
  it('returns to Create or the toolbar after a filtered-away row, without stealing restored invoker focus', async () => {
    const frames: Array<() => void> = []; vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { frames.push(fn); return frames.length; });
    const body = {}; const doc = { body, activeElement: body as object }; vi.stubGlobal('document', doc);
    let tree = await loadedPage();
    const create = { focus: vi.fn(), disabled: false }, toolbar = { focus: vi.fn() };
    (tree.find(node => node.props['aria-label'] === 'Create Definition') as any).ref.current = create;
    (tree.find(node => node.props['aria-label'] === 'Definition toolbar') as any).ref.current = toolbar;
    byType(tree, DefinitionTable).props.onEdit(shared); tree = draw(DataSourcesPage);
    byType(tree, DefinitionCatalogEditor).props.onClose(); frames.pop()!(); expect(create.focus).toHaveBeenCalledTimes(1);
    create.disabled = true; byType(tree, DefinitionCatalogEditor).props.onClose(); frames.pop()!(); expect(toolbar.focus).toHaveBeenCalledTimes(1);
    doc.activeElement = { invoker: true }; byType(tree, DefinitionCatalogEditor).props.onClose(); frames.pop()!();
    expect(create.focus).toHaveBeenCalledTimes(1); expect(toolbar.focus).toHaveBeenCalledTimes(1);
  });
});

describe('dev.5 automatic summary and on-demand reading pane', () => {
  it('rerenders/search do not reload counts; Refresh refreshes counts and invalidates details', async () => {
    let tree = await loadedPage(); const table = byType(tree, DefinitionTable);
    table.props.onReferences(shared); await flush(); tree = draw(DataSourcesPage);
    expect(byType(tree, ReferenceDetails).props.state.data.bindingCount).toBe(2);
    byType(tree, DefinitionTable).props.onReferences(shared); await flush(); expect(api.fetchDefinitionReferences).toHaveBeenCalledTimes(1);
    draw(DataSourcesPage); expect(api.fetchDefinitionReferenceBatch).toHaveBeenCalledTimes(1);
    tree.find(node => node.props['aria-label'] === 'Refresh definitions')!.props.onClick(); await flush(); tree = draw(DataSourcesPage);
    expect(api.fetchDefinitionReferenceBatch).toHaveBeenCalledTimes(2); expect(tree.some(node => node.type === ReferenceDetails)).toBe(false);
    byType(tree, DefinitionTable).props.onReferences(shared); await flush(); expect(api.fetchDefinitionReferences).toHaveBeenCalledTimes(2);
  });
  it.each(['toggle', 'save', 'delete'])('%s refreshes reference counts using the catalog, never a detail sweep', async operation => {
    let tree = await loadedPage();
    if (operation === 'toggle') byType(tree, DefinitionTable).props.onToggle(shared);
    else if (operation === 'save') { byType(tree, DefinitionTable).props.onEdit(shared); tree = draw(DataSourcesPage); byType(tree, DefinitionCatalogEditor).props.onChanged(); }
    else { byType(tree, DefinitionTable).props.onDelete(shared); tree = draw(DataSourcesPage); byType(tree, DeleteDefinitionDialog).props.onDeleted(); }
    await flush(); expect(api.fetchDefinitionReferenceBatch).toHaveBeenCalledTimes(2); expect(api.fetchDefinitionReferences).not.toHaveBeenCalled();
  });
  it('reference failure is non-blocking and Retry reloads counts without presenting zero', async () => {
    vi.mocked(api.fetchDefinitionReferenceBatch).mockRejectedValueOnce(Error('offline')); let tree = await loadedPage();
    const table = byType(tree, DefinitionTable); expect(table.props.busy).toBe(false); expect(table.props.references[definitionKey(shared)]).toEqual({ error: 'Counts unavailable' });
    table.props.onEdit(shared); expect(byType(draw(DataSourcesPage), DefinitionCatalogEditor)).toBeDefined();
    table.props.onRetryReferences(); await flush(); tree = draw(DataSourcesPage); expect(byType(tree, DefinitionTable).props.references[definitionKey(shared)].count).toBe(2);
  });
  it('old catalog responses cannot overwrite refreshed counts', async () => {
    let finish!: (value: api.DefinitionReferenceBatch) => void;
    vi.mocked(api.fetchDefinitionReferenceBatch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let tree = await loadedPage(); expect(byType(tree, DefinitionTable).props.references[definitionKey(shared)].loading).toBe(true);
    tree.find(node => node.props['aria-label'] === 'Refresh definitions')!.props.onClick(); await flush();
    finish({ scope: 'SAVED_OVERVIEW_PAGES', unsavedDraftsIncluded: false, results: [{ source: definitionIdentity(shared), found: true, pageCount: 9, bindingCount: 99 }] });
    await flush(); tree = draw(DataSourcesPage); expect(byType(tree, DefinitionTable).props.references[definitionKey(shared)].count).toBe(2);
  });
  it('unmount invalidates count and detail responses', async () => {
    let finish!: (value: api.DefinitionReferenceBatch) => void, finishDetail!: (value: api.DefinitionReferenceSummary) => void;
    vi.mocked(api.fetchDefinitionReferenceBatch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(api.fetchDefinitionReferences).mockImplementationOnce(() => new Promise(resolve => { finishDetail = resolve; }));
    draw(DataSourcesPage); const cleanup = hooks.effects[0](); await flush(); let tree = draw(DataSourcesPage);
    byType(tree, DefinitionTable).props.onReferences(shared); tree = draw(DataSourcesPage);
    cleanup(); const before = JSON.stringify(hooks.slots);
    finish({ scope: 'SAVED_OVERVIEW_PAGES', unsavedDraftsIncluded: false, results: [] }); finishDetail({ scope: 'SAVED_OVERVIEW_PAGES', bindingCount: 99, pageCount: 9, references: [] });
    await flush(); expect(JSON.stringify(hooks.slots)).toBe(before);
  });
  it('switching details shows the current source only; loads only activated identities and caches per session', async () => {
    let finish!: (value: api.DefinitionReferenceSummary) => void;
    vi.mocked(api.fetchDefinitionReferences).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let tree = await loadedPage(); byType(tree, DefinitionTable).props.onReferences(shared); tree = draw(DataSourcesPage);
    expect(byType(tree, ReferenceDetails).props.state.loading).toBe(true);
    byType(tree, DefinitionTable).props.onReferences(variable); await flush();
    finish({ scope: 'SAVED_OVERVIEW_PAGES', bindingCount: 8, pageCount: 1, references: [] }); await flush(); tree = draw(DataSourcesPage);
    expect(byType(tree, ReferenceDetails).props.definition).toBe(variable); expect(byType(tree, ReferenceDetails).props.state.data.bindingCount).toBe(2);
    expect(api.fetchDefinitionReferences).toHaveBeenCalledTimes(2);
  });
  it('detail failure supports local retry and closing returns focus to the invoker, with toolbar fallback', async () => {
    const frames: Array<() => void> = []; vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { frames.push(fn); return 1; });
    vi.mocked(api.fetchDefinitionReferences).mockRejectedValueOnce(Error('offline'));
    let tree = await loadedPage(); const toolbar = { focus: vi.fn() }, invoker = { isConnected: true, disabled: false, focus: vi.fn() };
    (tree.find(node => node.props['aria-label'] === 'Definition toolbar') as any).ref.current = toolbar;
    byType(tree, DefinitionTable).props.onReferences(shared, invoker); await flush(); tree = draw(DataSourcesPage);
    expect(byType(tree, ReferenceDetails).props.state.error).toContain('Unable to load');
    byType(tree, ReferenceDetails).props.onRetry(); await flush(); tree = draw(DataSourcesPage); expect(byType(tree, ReferenceDetails).props.state.data).toBeDefined();
    byType(tree, ReferenceDetails).props.onClose(); frames.pop()!(); expect(invoker.focus).toHaveBeenCalledWith({ preventScroll: true });
    invoker.isConnected = false; byType(tree, ReferenceDetails).props.onClose(); frames.pop()!(); expect(toolbar.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it('the non-modal details pane enters focus at Close, supports Escape and never intercepts Tab', () => {
    const close = vi.fn(); const tree = draw(() => ReferenceDetails({ definition: shared, state: { loading: true }, onClose: close, onRetry: vi.fn() }));
    const focus = vi.fn(); (tree.find(node => node.props['aria-label'] === 'Close saved references') as any).ref.current = { focus };
    hooks.effects[0](); expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    const pane = tree.find(node => node.props.role === 'dialog')!; expect(pane.props['aria-modal']).toBe('false');
    const preventDefault = vi.fn(), stopPropagation = vi.fn(); pane.props.onKeyDown({ key: 'Tab', preventDefault, stopPropagation }); expect(preventDefault).not.toHaveBeenCalled();
    pane.props.onKeyDown({ key: 'Escape', preventDefault, stopPropagation }); expect(close).toHaveBeenCalledTimes(1); expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
