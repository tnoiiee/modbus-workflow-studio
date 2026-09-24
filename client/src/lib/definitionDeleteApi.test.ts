import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteSourceDefinition, fetchDefinitionReferences, sourceDefinitionPath } from './overviewApi.js';
import type { SourceIdentity } from './sourceDefinitions.js';
const id = '11111111-1111-4111-8111-111111111111';
afterEach(() => vi.unstubAllGlobals());
describe('O2-A punchlist Definition Delete API client', () => {
  it.each<SourceIdentity>([{ sourceType: 'SHARED_TAG', sourceId: id }, { sourceType: 'WORKFLOW_VARIABLE', workflowId: id, variableId: id }])('requests exact stable identity path without writing an Overview page: %j', async identity => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    await fetchDefinitionReferences(identity); await deleteSourceDefinition(identity);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${sourceDefinitionPath(identity)}/references`);
    expect(fetcher.mock.calls[1]?.[0]).toBe(sourceDefinitionPath(identity));
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('Delete failure remains an error instead of reporting success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Unable to persist Source definition' }), { status: 500, headers: { 'Content-Type': 'application/json' } })));
    await expect(deleteSourceDefinition({ sourceType: 'SHARED_TAG', sourceId: id })).rejects.toThrow('Unable to persist');
  });
});
