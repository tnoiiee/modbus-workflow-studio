import { describe, expect, it, vi } from 'vitest';
import { OverviewCatalog, observeOverviewCatalog, overviewCatalogNotice } from './overviewCatalog.js';
import { configuration, settle } from './overviewRuntimeFixtures.js';
import type { SourceDefinition, DefinitionWorkflow } from './sourceDefinitions.js';

type Data = [SourceDefinition[], DefinitionWorkflow[]];
const data = (): Data => [[configuration().definition], [{ id: 'workflow', name: 'Workflow' }]];
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
describe('dev.11 confirmed Catalog readiness', () => {
  it('construction does no I/O; initial pending is unavailable until a valid response', async () => {
    const reply = deferred<Data>(), load = vi.fn(() => reply.promise), catalog = new OverviewCatalog(load);
    expect(load).not.toHaveBeenCalled(); expect(catalog.getSnapshot().available).toBe(false);
    const task = catalog.refresh(); expect(catalog.getSnapshot()).toMatchObject({ available: false, pending: true });
    reply.resolve(data()); await task; expect(catalog.getSnapshot()).toMatchObject({ available: true, pending: false, error: '' });
  });
  it('initial failure fails closed and explicit retry may recover', async () => {
    const load = vi.fn<() => Promise<Data>>().mockRejectedValueOnce(Error('network unavailable')).mockResolvedValue(data());
    const catalog = new OverviewCatalog(load); await catalog.refresh();
    expect(catalog.getSnapshot()).toMatchObject({ available: false, pending: false, definitions: [] });
    expect(overviewCatalogNotice(catalog.getSnapshot())).toContain('Runtime is disabled');
    await catalog.refresh(); expect(catalog.getSnapshot()).toMatchObject({ available: true, error: '' });
  });
  it('pending and failed background refresh preserve confirmed data and warning until success', async () => {
    const reply = deferred<Data>(), load = vi.fn<() => Promise<Data>>().mockResolvedValueOnce(data()).mockReturnValueOnce(reply.promise).mockResolvedValue(data());
    const catalog = new OverviewCatalog(load); await catalog.refresh(); const confirmed = catalog.getSnapshot();
    const task = catalog.refresh(); expect(catalog.getSnapshot().definitions).toBe(confirmed.definitions);
    expect(catalog.getSnapshot()).toMatchObject({ available: true, pending: true });
    reply.reject(Error('refresh unavailable')); await task;
    expect(catalog.getSnapshot().definitions).toBe(confirmed.definitions); expect(catalog.getSnapshot().workflows).toBe(confirmed.workflows);
    expect(overviewCatalogNotice(catalog.getSnapshot())).toContain('Using last confirmed definitions; read-only Runtime continues');
    const retry = catalog.refresh(); expect(catalog.getSnapshot().error).toBe('refresh unavailable'); await retry;
    expect(overviewCatalogNotice(catalog.getSnapshot())).toBe('');
  });
  it('coalesces rapid repeated focus, without a timer/retry loop', async () => {
    const reply = deferred<Data>(), load = vi.fn(() => reply.promise), catalog = new OverviewCatalog(load), target = new EventTarget();
    const stop = observeOverviewCatalog(catalog, target);
    for (let i = 0; i < 50; i++) target.dispatchEvent(new Event('focus'));
    const same = catalog.refresh(); expect(catalog.refresh()).toBe(same); await settle(); expect(load).toHaveBeenCalledTimes(1);
    reply.reject(Error('down')); await same; await settle(); expect(load).toHaveBeenCalledTimes(1);
    stop(); target.dispatchEvent(new Event('focus')); await settle(); expect(load).toHaveBeenCalledTimes(1);
  });
  it('equivalent fresh arrays, record property order and Catalog ordering preserve references', async () => {
    const initial: Data = [[configuration().definition, configuration(2).definition], [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]];
    const changed: Data = [initial[0].map(d => Object.fromEntries(Object.entries(d).reverse()) as SourceDefinition).reverse(), [...initial[1]].reverse()];
    const load = vi.fn<() => Promise<Data>>().mockResolvedValueOnce(initial).mockResolvedValue(changed), catalog = new OverviewCatalog(load);
    await catalog.refresh(); const confirmed = catalog.getSnapshot(); await catalog.refresh();
    expect(catalog.getSnapshot().definitions).toBe(confirmed.definitions); expect(catalog.getSnapshot().workflows).toBe(confirmed.workflows);
  });
  it('commits changed confirmed metadata and owns its copy', async () => {
    const original = data(), next = data(); next[0][0].unit = 'kPa';
    const load = vi.fn<() => Promise<Data>>().mockResolvedValueOnce(original).mockResolvedValue(next), catalog = new OverviewCatalog(load);
    await catalog.refresh(); const previous = catalog.getSnapshot().definitions; await catalog.refresh();
    next[0][0].unit = 'external mutation'; expect(catalog.getSnapshot().definitions[0].unit).toBe('kPa'); expect(previous[0].unit).toBe('bar');
  });
  it.each(['resolve', 'reject'] as const)('late %s after cleanup cannot overwrite a newer response', async outcome => {
    const old = deferred<Data>(), load = vi.fn<() => Promise<Data>>().mockReturnValueOnce(old.promise).mockResolvedValue([[configuration(2).definition], []]);
    const catalog = new OverviewCatalog(load); const first = catalog.refresh(); await settle(); catalog.cancel(); await catalog.refresh(); const confirmed = catalog.getSnapshot();
    if (outcome === 'resolve') old.resolve(data()); else old.reject(Error('stale failure'));
    await first; expect(catalog.getSnapshot()).toBe(confirmed);
  });
  it('StrictMode-style effect replay starts only surviving metadata request and cleans listeners', async () => {
    const load = vi.fn(async () => data()), catalog = new OverviewCatalog(load), target = new EventTarget();
    observeOverviewCatalog(catalog, target)(); const stop = observeOverviewCatalog(catalog, target); await settle();
    expect(load).toHaveBeenCalledTimes(1); stop(); target.dispatchEvent(new Event('focus')); await settle(); expect(load).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, [{ sourceType: 'SHARED_TAG', sourceId: 'bad' }], [{ ...configuration().definition, enabled: 'true' }], [configuration().definition, configuration().definition]])('rejects malformed/ambiguous initial metadata %#', async definitions => {
    const catalog = new OverviewCatalog(async () => [definitions as SourceDefinition[], []]); await catalog.refresh();
    expect(catalog.getSnapshot()).toMatchObject({ available: false, error: 'Invalid Definition Catalog response' });
  });
  it('malformed background reply is not confirmed and cannot erase prior metadata', async () => {
    const load = vi.fn<() => Promise<Data>>().mockResolvedValueOnce(data()).mockResolvedValue([[] as SourceDefinition[], null as unknown as DefinitionWorkflow[]]);
    const catalog = new OverviewCatalog(load); await catalog.refresh(); const previous = catalog.getSnapshot().definitions; await catalog.refresh();
    expect(catalog.getSnapshot().definitions).toBe(previous); expect(catalog.getSnapshot().available).toBe(true); expect(catalog.getSnapshot().error).toBeTruthy();
  });
  it('notifies state subscribers, and unsubscribed observers stay silent', async () => {
    const catalog = new OverviewCatalog(async () => data()), listener = vi.fn(), off = catalog.subscribe(listener);
    await catalog.refresh(); expect(listener).toHaveBeenCalledTimes(2); off(); await catalog.refresh(); expect(listener).toHaveBeenCalledTimes(2);
  });
  it('empty valid Catalog is ready metadata, not an invented Runtime selection', async () => {
    const catalog = new OverviewCatalog(async () => [[], []]); await catalog.refresh(); expect(catalog.getSnapshot()).toMatchObject({ available: true, definitions: [] });
  });
});
