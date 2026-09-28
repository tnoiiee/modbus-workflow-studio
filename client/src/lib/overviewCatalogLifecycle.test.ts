import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { OverviewCatalog, observeOverviewCatalog, overviewCatalogNotice } from './overviewCatalog.js';
import { bindingPresentation } from './overviewBinding.js';
import { overviewRuntimeSelection, runtimeViewAllowed } from './overviewRuntimeSelection.js';
import { overviewRuntimeSessionKey, startOverviewRuntimeSession } from './overviewRuntimeSession.js';
import { configuration, harness, settle, id } from './overviewRuntimeFixtures.js';
import { beginOverviewEdit, cancelOverviewEdit, finishOverviewSave } from './overviewState.js';
import type { SourceDefinition, DefinitionWorkflow } from './sourceDefinitions.js';
import type { OverviewElement } from './overviewElements.js';

type Data = [SourceDefinition[], DefinitionWorkflow[]];
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const disposers: Array<() => void> = [];
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(.5); });
afterEach(() => { disposers.splice(0).forEach(stop => stop()); vi.useRealTimers(); vi.restoreAllMocks(); });
/** Headless effect integration: real Catalog -> resolver -> selection -> Provider
 * effect body -> unchanged adapter/B2. This is NOT a mounted React/browser test.
 * Dependency comparison mirrors the Provider and is checked against its wiring.
 */
function driver(initial: Partial<{ active: boolean; mode: string; ready: boolean }> = {}) {
  const f = harness(), configs = [configuration(), configuration(2)];
  const data = (): Data => [configs.map(c => structuredClone(c.definition)), []];
  const load = vi.fn(async (): Promise<Data> => data());
  const catalog = new OverviewCatalog(load), window = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false }), navigator = { onLine: true };
  const browser = { window, document, navigator };
  const state = { active: true, mode: 'VIEW', ready: true, pageId: 'A', elements: [configs[0].element] as OverviewElement[], ...initial };
  let previous = '', cleanup: (() => void) | undefined, stopCatalog: (() => void) | undefined;
  const resolve = () => bindingPresentation(state.elements, catalog.getSnapshot()).resolutions;
  const selection = () => overviewRuntimeSelection(state.elements, resolve());
  const render = () => {
    const resolutions = resolve(), selected = overviewRuntimeSelection(state.elements, resolutions);
    const enabled = runtimeViewAllowed(state.active, state.mode, state.ready, selected);
    const dependencies = JSON.stringify([enabled, state.pageId, selected.key, selected.error, overviewRuntimeSessionKey(selected, resolutions)]);
    if (dependencies === previous) return;
    cleanup?.(); previous = dependencies;
    cleanup = startOverviewRuntimeSession(f.adapter, enabled, state.pageId, selected, browser);
  };
  const off = catalog.subscribe(render);
  render(); if (state.active) stopCatalog = observeOverviewCatalog(catalog, window);
  const set = (patch: Partial<typeof state>) => {
    const active = state.active; Object.assign(state, patch);
    if (active !== state.active) { stopCatalog?.(); stopCatalog = undefined; }
    render();
    if (!active && state.active) stopCatalog = observeOverviewCatalog(catalog, window);
  };
  const dispose = () => { off(); stopCatalog?.(); stopCatalog = undefined; cleanup?.(); cleanup = undefined; catalog.cancel(); f.adapter.stop(); };
  disposers.push(dispose);
  const focus = () => window.dispatchEvent(new Event('focus'));
  const hidden = (value: boolean) => { document.hidden = value; document.dispatchEvent(new Event('visibilitychange')); };
  const online = (value: boolean) => { navigator.onLine = value; window.dispatchEvent(new Event(value ? 'online' : 'offline')); };
  const activeSockets = () => f.sockets.filter(s => s.readyState === 0 || s.readyState === 1).length;
  return { f, configs, catalog, load, data, state, resolve, selection, render, set, focus, hidden, online, activeSockets, dispose };
}
async function healthy() { const d = driver(); await settle(); d.f.accept(); return d; }
function unchanged(d: ReturnType<typeof driver>, socket = d.f.sockets[0]) {
  expect(d.f.io.snapshot).toHaveBeenCalledTimes(1); expect(d.f.io.socket).toHaveBeenCalledTimes(1);
  expect(d.f.socket()).toBe(socket); expect(d.activeSockets()).toBe(1);
  expect(socket.sent.map(message => message.type)).toEqual(['subscribe']);
  expect(d.f.store.getStatus().transport).toBe('Connected');
}

describe('dev.11 initial readiness and focus integration', () => {
  it('pending initial metadata cannot Snapshot/subscribe; first success creates one client', async () => {
    const d = driver(), reply = deferred<Data>(); d.load.mockReturnValueOnce(reply.promise); await settle();
    expect(d.catalog.getSnapshot().available).toBe(false); expect(d.f.io.snapshot).not.toHaveBeenCalled(); expect(d.activeSockets()).toBe(0);
    reply.resolve(d.data()); await settle(); d.f.accept(); unchanged(d);
  });
  it('failed initial Catalog never opens Runtime, including after timer advancement', async () => {
    const d = driver(); d.load.mockRejectedValueOnce(Error('down')); await settle(); await vi.advanceTimersByTimeAsync(60000);
    expect(d.f.io.snapshot).not.toHaveBeenCalled(); expect(d.f.io.socket).not.toHaveBeenCalled(); expect(d.load).toHaveBeenCalledTimes(1);
  });
  it('pending focus refresh preserves BOUND, selection, generation owner and subscription', async () => {
    const d = await healthy(), reply = deferred<Data>(), selected = d.selection();
    const activate = vi.spyOn(d.f.adapter, 'activate'), stop = vi.spyOn(d.f.adapter, 'stop');
    d.load.mockReturnValueOnce(reply.promise); d.focus(); await settle();
    expect(d.catalog.getSnapshot()).toMatchObject({ available: true, pending: true });
    expect(d.resolve()[d.configs[0].element.id].status).toBe('BOUND'); expect(d.selection()).toEqual(selected); unchanged(d);
    reply.resolve(d.data()); await settle(); unchanged(d); expect(activate).not.toHaveBeenCalled(); expect(stop).not.toHaveBeenCalled();
  });
  it('new arrays, objects, reordered definitions and unrelated Workflow metadata do not restart', async () => {
    const d = await healthy(), next = d.data(); next[0].reverse(); next[1].push({ id: 'other-workflow', name: 'Changed name' });
    d.load.mockResolvedValueOnce(next); d.focus(); await settle(); unchanged(d);
  });
  it('irrelevant Definition name/description and non-selected metadata do not restart', async () => {
    const d = await healthy(), next = d.data(); next[0][0].name = 'New catalog label'; next[0][0].description = 'New description'; next[0][1].unit = 'unrelated';
    d.load.mockResolvedValueOnce(next); d.focus(); await settle(); unchanged(d);
    expect(d.catalog.getSnapshot().definitions[0].name).toBe('New catalog label');
  });
  it('explicit Refresh with unchanged metadata also preserves the healthy session', async () => {
    const d = await healthy(); await d.catalog.refresh(); await settle(); unchanged(d);
  });
  it('failed background refresh retains BOUND and healthy transport with a non-blocking warning', async () => {
    const d = await healthy(); d.load.mockRejectedValueOnce(Error('Catalog request failed')); d.focus(); await settle();
    expect(d.resolve()[d.configs[0].element.id].status).toBe('BOUND'); unchanged(d);
    expect(overviewCatalogNotice(d.catalog.getSnapshot())).toContain('Catalog refresh warning:');
    await vi.advanceTimersByTimeAsync(60000); expect(d.load).toHaveBeenCalledTimes(2); unchanged(d);
    await d.catalog.refresh(); await settle(); expect(overviewCatalogNotice(d.catalog.getSnapshot())).toBe(''); unchanged(d);
  });
  it('rapid focus shares one pending request, then unchanged success leaves one client', async () => {
    const d = await healthy(), reply = deferred<Data>(); d.load.mockReturnValueOnce(reply.promise);
    for (let n = 0; n < 50; n++) d.focus(); await settle(); expect(d.load).toHaveBeenCalledTimes(2); unchanged(d);
    reply.resolve(d.data()); await settle(); unchanged(d);
  });
});

describe('dev.11 real semantic changes reconcile only required sessions', () => {
  it.each(['removed', 'disabled', 'type', 'capability'] as const)('%s selected Definition disposes, with no replacement for empty selection', async change => {
    const d = await healthy(), old = d.f.socket(), next = d.data();
    if (change === 'removed') next[0].shift();
    if (change === 'disabled') next[0][0].enabled = false;
    if (change === 'type') next[0][0].dataType = 'Boolean';
    if (change === 'capability') next[0][0].capability = 'COMMAND_ONLY';
    d.load.mockResolvedValueOnce(next); d.focus(); await settle();
    expect(d.selection().sources).toEqual([]); expect(old.sent.at(-1).type).toBe('unsubscribe'); expect(old.readyState).toBe(3);
    expect(d.activeSockets()).toBe(0); expect(d.f.io.snapshot).toHaveBeenCalledTimes(1); await vi.advanceTimersByTimeAsync(60000); expect(d.f.io.socket).toHaveBeenCalledTimes(1);
  });
  it('changed unit is a semantic presentation input: same wire selection, one fenced replacement', async () => {
    const d = await healthy(), selected = d.selection().key, old = d.f.socket(), late = old.onmessage!, context = d.f.context();
    const next = d.data(); next[0][0].unit = 'kPa'; d.load.mockResolvedValueOnce(next); d.focus(); await settle();
    expect(d.selection().key).toBe(selected); expect(d.f.io.snapshot).toHaveBeenCalledTimes(2); expect(old.readyState).toBe(3);
    expect(old.sent.at(-1).type).toBe('unsubscribe'); expect(d.activeSockets()).toBe(1); d.f.accept();
    late({ data: JSON.stringify({ ...context, type: 'checkpoint', fromExclusive: 'wrong', toInclusive: 'bad', updates: [] }) });
    await vi.advanceTimersByTimeAsync(1000); expect(d.f.io.snapshot).toHaveBeenCalledTimes(2); expect(d.f.store.getStatus().transport).toBe('Connected');
  });
  it('changed subset fences old client and subscribes only to remaining eligible identities', async () => {
    const d = driver(); d.set({ elements: d.configs.map(c => c.element) }); await settle(); d.f.accept(); const old = d.f.socket();
    const next = d.data(); next[0][0].enabled = false; d.load.mockResolvedValueOnce(next); d.focus(); await settle(); d.f.accept();
    expect(d.selection().sources.map(s => s.sourceId)).toEqual([id(2)]); expect(d.f.socket().sent[0].sources).toEqual(d.selection().sources);
    expect(d.f.io.snapshot).toHaveBeenCalledTimes(2); expect(old.readyState).toBe(3); expect(d.activeSockets()).toBe(1);
  });
  it('restoring a removed Definition enables exactly one fresh session', async () => {
    const d = await healthy(); d.load.mockResolvedValueOnce([[], []]); d.focus(); await settle(); expect(d.activeSockets()).toBe(0);
    d.focus(); await settle(); d.f.accept(); expect(d.f.io.snapshot).toHaveBeenCalledTimes(2); expect(d.activeSockets()).toBe(1);
  });
  it('old recovery timer cannot revive a client fenced by a semantic change', async () => {
    const d = await healthy(); d.f.socket().onclose?.(); const next = d.data(); next[0][0].enabled = false;
    d.load.mockResolvedValueOnce(next); d.focus(); await settle(); await vi.advanceTimersByTimeAsync(60000);
    expect(d.activeSockets()).toBe(0); expect(d.f.io.socket).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
});

describe('dev.11 browser event convergence and protected lifecycle', () => {
  it.each(['visibility-first', 'focus-first', 'online-first', 'focus-before-online'] as const)('%s converges to one replacement without a focus-created lifecycle', async order => {
    const d = await healthy(), old = d.f.socket();
    if (order.includes('online')) d.online(false); else d.hidden(true);
    expect(d.activeSockets()).toBe(0);
    if (order.startsWith('focus')) d.focus();
    if (order.includes('online')) d.online(true); else d.hidden(false);
    if (!order.startsWith('focus')) d.focus();
    await settle(); d.f.accept(); expect(d.f.io.snapshot).toHaveBeenCalledTimes(2); expect(d.f.io.socket).toHaveBeenCalledTimes(2);
    expect(d.activeSockets()).toBe(1); expect(old.readyState).toBe(3);
    d.online(true); d.hidden(false); d.focus(); await settle(); expect(d.f.io.snapshot).toHaveBeenCalledTimes(2);
  });
  it.each(['visibility', 'online'] as const)('failed focus refresh during %s recovery does not add a second lifecycle', async event => {
    const d = await healthy(); d.load.mockRejectedValueOnce(Error('refresh failed'));
    if (event === 'visibility') d.hidden(true); else d.online(false);
    d.focus(); if (event === 'visibility') d.hidden(false); else d.online(true);
    await settle(); d.f.accept(); expect(d.f.io.snapshot).toHaveBeenCalledTimes(2); expect(d.activeSockets()).toBe(1);
    expect(d.catalog.getSnapshot()).toMatchObject({ available: true, error: 'refresh failed' });
  });
  it('StrictMode-style Provider setup/cleanup/setup fences scheduled start', async () => {
    const f = harness(), c = configuration(), browser = { window: new EventTarget(), document: Object.assign(new EventTarget(), { hidden: false }), navigator: { onLine: true } };
    startOverviewRuntimeSession(f.adapter, true, 'A', c.selection, browser)!();
    const cleanup = startOverviewRuntimeSession(f.adapter, true, 'A', c.selection, browser)!; disposers.push(cleanup);
    await settle(); f.accept(); expect(f.io.snapshot).toHaveBeenCalledTimes(1); expect(f.sockets.filter(s => s.readyState === 1)).toHaveLength(1);
    cleanup(); browser.window.dispatchEvent(new Event('online')); browser.document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(60000);
    expect(f.io.snapshot).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['EDIT', 'inactive'] as const)('%s during pending refresh stays unsubscribed after late Catalog success', async mode => {
    const d = await healthy(), reply = deferred<Data>(); d.load.mockReturnValueOnce(reply.promise); d.focus(); await settle();
    if (mode === 'EDIT') d.set({ mode }); else d.set({ active: false });
    reply.resolve(d.data()); await settle(); d.focus(); await settle(); await vi.advanceTimersByTimeAsync(60000);
    expect(d.activeSockets()).toBe(0); expect(d.f.io.snapshot).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('startup outside Overview makes neither Catalog request nor Tag client', async () => {
    const d = driver({ active: false }); d.focus(); await settle(); await vi.advanceTimersByTimeAsync(45000);
    expect(d.load).not.toHaveBeenCalled(); expect(d.f.io.snapshot).not.toHaveBeenCalled(); expect(d.f.io.socket).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'save', 'failed-save'] as const)('%s preserves saved/View/Edit subscription boundary', async action => {
    const d = await healthy(), page = { id: id(), elements: [d.configs[0].element], revision: 1 } as any;
    d.set({ mode: beginOverviewEdit(page).mode }); expect(d.activeSockets()).toBe(0);
    if (action === 'cancel') d.set({ mode: cancelOverviewEdit(page).mode });
    if (action === 'save') d.set({ mode: finishOverviewSave(page).mode });
    await settle(); expect(d.f.io.snapshot).toHaveBeenCalledTimes(action === 'failed-save' ? 1 : 2);
    expect(d.activeSockets()).toBe(action === 'failed-save' ? 0 : 1);
  });
  it('Page navigation fences old Snapshot completion and late socket callbacks', async () => {
    const d = await healthy(), reply = deferred<unknown>(), original = d.f.io.snapshot;
    const old = d.f.socket(), late = old.onmessage!, context = d.f.context();
    vi.mocked(d.f.io.snapshot).mockImplementationOnce(() => reply.promise);
    d.set({ pageId: 'B', elements: [d.configs[1].element] }); await settle();
    d.set({ pageId: 'A', elements: [d.configs[0].element] }); await settle(); d.f.accept();
    reply.resolve(await original(d.configs[1].selection.sources, new AbortController().signal)); await settle();
    late({ data: JSON.stringify({ ...context, type: 'resync-required' }) }); await vi.advanceTimersByTimeAsync(500);
    expect(d.activeSockets()).toBe(1); expect(d.f.io.socket).toHaveBeenCalledTimes(2); expect(d.f.store.getStatus().pageId).toBe('A'); expect(d.f.store.getItem(id(2))).toBeUndefined();
  });
  it('isolation: frozen Page/Draft/history/revision/geometry/viewport remain byte-identical', async () => {
    const d = driver();
    const protectedState = { page: { revision: 7, elements: d.state.elements, savedViewport: { x: 10, y: 20, zoom: .5 } }, draft: { name: 'draft' }, undo: ['unchanged'], redo: [] };
    const freeze = (value: any): void => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } };
    freeze(protectedState); const before = JSON.stringify(protectedState); await settle(); d.f.accept();
    d.focus(); await settle(); d.load.mockRejectedValueOnce(Error('failure')); d.focus(); await settle();
    expect(JSON.stringify(protectedState)).toBe(before); unchanged(d);
    expect(Object.keys(d.f.io).sort()).toEqual(['scheduleApply', 'snapshot', 'socket']);
  });
  it('Page and Provider wire the tested Catalog/effect and accessible warning without persistence or Device actions', () => {
    const page = readFileSync(new URL('../components/overview/OverviewPage.tsx', import.meta.url), 'utf8');
    const provider = readFileSync(new URL('../components/overview/OverviewRuntimeProvider.tsx', import.meta.url), 'utf8');
    const catalog = readFileSync(new URL('./overviewCatalog.ts', import.meta.url), 'utf8');
    const session = readFileSync(new URL('./overviewRuntimeSession.ts', import.meta.url), 'utf8');
    expect(page).toContain('useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot)');
    expect(page).toContain('if (!active) return;\n    return observeOverviewCatalog(catalog, window)');
    expect(page).not.toContain('setCatalogAvailable(false)');
    expect(page).toContain('<span role="status" aria-live="polite" aria-atomic="true">{catalogNotice}</span>');
    expect(provider).toContain('overviewRuntimeSessionKey(selection, resolutions)');
    expect(provider).toContain('[adapter, enabled, pageId, selection.key, selection.error, sessionKey]');
    expect(provider).toContain('startOverviewRuntimeSession(adapter, enabled, pageId, selection)');
    expect(catalog + session).not.toMatch(/updateOverviewPage|setDraft|setHistory|savedViewport|\/api\/devices|modbus|workflow.*command|setInterval|setTimeout/i);
  });
});
