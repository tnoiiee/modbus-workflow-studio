import { describe, expect, it, vi } from 'vitest';
import { bindingCountLabel, loadReferenceCounts } from './definitionReferences.js';
import { fetchDefinitionReferenceBatch, type DefinitionReferenceBatch } from './overviewApi.js';
import type { SourceDefinition, SourceIdentity } from './sourceDefinitions.js';
const definitions = (count: number): SourceDefinition[] => Array.from({ length: count }, (_, i) => ({ sourceType: 'SHARED_TAG', sourceId: `id-${i}`, name: `Source ${i}`, description: '', unit: '', dataType: 'Number', capability: 'MONITOR_ONLY', enabled: true }));
const result = (sources: readonly SourceIdentity[]): DefinitionReferenceBatch => ({ scope: 'SAVED_OVERVIEW_PAGES', unsavedDraftsIncluded: false, results: sources.map(source => ({ source, found: true, pageCount: 0, bindingCount: 0 })) });
describe('dev.5 bounded automatic reference summaries', () => {
  it.each([1, 50, 100])('uses one batch for %s definitions; publishes loading then explicit zero', async size => {
    const fetcher = vi.fn(async (sources: readonly SourceIdentity[]) => result(sources)), publish = vi.fn();
    await loadReferenceCounts(definitions(size), () => true, publish, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toHaveLength(size);
    expect(publish.mock.calls[0][0]['SHARED_TAG:id-0']).toEqual({ loading: true });
    expect(publish.mock.lastCall![0]['SHARED_TAG:id-0']).toEqual({ found: true, count: 0, pageCount: 0 });
  });
  it('uses sequential bounded batches above 100, with no concurrent fan-out', async () => {
    let active = 0, peak = 0; const fetcher = vi.fn(async (sources: readonly SourceIdentity[]) => { peak = Math.max(peak, ++active); await Promise.resolve(); active--; return result(sources); });
    await loadReferenceCounts(definitions(251), () => true, vi.fn(), fetcher);
    expect(fetcher.mock.calls.map(([sources]) => sources.length)).toEqual([100, 100, 51]); expect(peak).toBe(1);
  });
  it('deduplicates identities and sends no batch for an empty catalog', async () => {
    const fetcher = vi.fn(async (sources: readonly SourceIdentity[]) => result(sources)); const source = definitions(1)[0];
    await loadReferenceCounts([source, source], () => true, vi.fn(), fetcher); expect(fetcher.mock.calls[0][0]).toHaveLength(1);
    fetcher.mockClear(); await loadReferenceCounts([], () => true, vi.fn(), fetcher); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([0, 1, 7])('uses the correct human count label for %s', count => {
    expect(bindingCountLabel(count)).toBe(count === 1 ? '1 binding' : `${count} bindings`);
  });
  it('distinguishes not-found from existing zero', async () => {
    const publish = vi.fn(); await loadReferenceCounts(definitions(2), () => true, publish, async sources => ({ ...result(sources), results: result(sources).results.map((value, i) => ({ ...value, found: i !== 0 })) }));
    expect(publish.mock.lastCall![0]['SHARED_TAG:id-0'].found).toBe(false); expect(publish.mock.lastCall![0]['SHARED_TAG:id-1']).toMatchObject({ found: true, count: 0 });
  });
  it('failure is explicit, never false zero, and later batches still load', async () => {
    const publish = vi.fn(), fetcher = vi.fn(async (sources: readonly SourceIdentity[]) => result(sources)); fetcher.mockRejectedValueOnce(Error('offline'));
    await loadReferenceCounts(definitions(101), () => true, publish, fetcher);
    expect(publish.mock.lastCall![0]['SHARED_TAG:id-0']).toEqual({ error: 'Counts unavailable' }); expect(publish.mock.lastCall![0]['SHARED_TAG:id-100'].count).toBe(0);
  });
  it('missing results or an unexpected scope cannot become false counts', async () => {
    const publish = vi.fn(); await loadReferenceCounts(definitions(1), () => true, publish, async () => ({ scope: 'SAVED_OVERVIEW_PAGES', unsavedDraftsIncluded: false, results: [] }));
    expect(publish.mock.lastCall![0]['SHARED_TAG:id-0']).toEqual({ error: 'Counts unavailable' });
  });
  it.each(['refresh', 'navigation/unmount'])('obsolete %s work neither publishes nor dispatches queued batches', async () => {
    let current = true, resolve!: (value: DefinitionReferenceBatch) => void;
    const fetcher = vi.fn(() => new Promise<DefinitionReferenceBatch>(done => { resolve = done; })), publish = vi.fn();
    const promise = loadReferenceCounts(definitions(201), () => current, publish, fetcher);
    expect(publish).toHaveBeenCalledTimes(1); current = false; resolve(result([])); await promise;
    expect(publish).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('already invalidated work issues no requests', async () => {
    const fetcher = vi.fn(), publish = vi.fn(); await loadReferenceCounts(definitions(1), () => false, publish, fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
  });
  it('API helper posts only stable identities to the approved batch route', async () => {
    const sources: SourceIdentity[] = [{ sourceType: 'SHARED_TAG', sourceId: '11111111-1111-4111-8111-111111111111' }];
    const fetchMock = vi.fn(async () => ({ ok: true, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => result(sources) }));
    vi.stubGlobal('fetch', fetchMock);
    try { expect(await fetchDefinitionReferenceBatch(sources)).toEqual(result(sources));
      expect(fetchMock).toHaveBeenCalledWith('/api/source-definitions/references/batch', expect.objectContaining({ method: 'POST', body: JSON.stringify({ sources }) }));
    } finally { vi.unstubAllGlobals(); }
  });
});
