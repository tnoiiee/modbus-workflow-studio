import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcquisitionMappingEditor } from './AcquisitionMappingEditor.js';
import { DefinitionTable } from './DataSourcesPage.js';
import { acquisitionPath, acquisitionRequest, defaultAcquisition } from '../../lib/acquisitionApi.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
const id = '11111111-1111-4111-8111-111111111111';
const definition = { sourceType: 'SHARED_TAG' as const, sourceId: id, name: 'Pressure', dataType: 'Number' as const, capability: 'MONITOR_ONLY' as const, enabled: true, description: '', unit: '' };
afterEach(() => vi.unstubAllGlobals());
describe('O2-B1 configuration UI boundary (not browser interaction validation)', () => {
  it('offers acquisition only for Shared Tags, leaving Variable definitions present', () => {
    const variable: SourceDefinition = { ...definition, sourceType: 'WORKFLOW_VARIABLE', variableId: id, workflowId: id };
    const html = renderToStaticMarkup(<DefinitionTable definitions={[definition, variable]} workflows={[]} busy={false} references={{}} onEdit={() => {}} onToggle={() => {}} onDelete={() => {}} onReferences={() => {}} onAcquisition={() => {}} />);
    expect(html.match(/Configure acquisition for/g)).toHaveLength(1); expect(html).toContain('WORKFLOW_VARIABLE');
  });
  it('renders all mapping controls and read-only boundary without runtime fields', () => {
    const html = renderToStaticMarkup(<AcquisitionMappingEditor definition={definition} onClose={() => {}} />);
    for (const text of ['Device', 'Unit ID', 'Function code', 'Zero-based address', 'Width', 'Wire data type', 'Byte order', 'Word order', 'Scale', 'Offset', 'Poll interval', 'Stale threshold', 'Enable server acquisition', 'Save mapping', 'No auto-connect, writes or Overview live values']) expect(html).toContain(text);
    expect(html).toContain(id); expect(html).not.toContain('GOOD');
  });
  it('clearly explains unsupported String acquisition without declaring Definition MISSING', () => {
    const html = renderToStaticMarkup(<AcquisitionMappingEditor definition={{ ...definition, dataType: 'String' }} onClose={() => {}} />);
    expect(html).toContain('String decoding'); expect(html).toContain('Definition remains valid'); expect(html).not.toContain('MISSING');
  });
  it('defaults to disabled and explicit Boolean/numeric codecs', () => {
    expect(defaultAcquisition(id, true)).toMatchObject({ sourceId: id, enabled: false, dataType: 'Boolean', functionCode: 1, address: 0 });
    expect(defaultAcquisition(id, false)).toMatchObject({ enabled: false, dataType: 'UInt16', functionCode: 3 });
  });
  it('uses relative config-only CRUD and surfaces server validation errors', async () => {
    const fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Unsupported codec' }) })); vi.stubGlobal('fetch', fetch);
    expect(acquisitionPath(id)).toBe(`/api/shared-tag-acquisition/${id}`); await expect(acquisitionRequest(acquisitionPath(id))).rejects.toThrow('Unsupported codec');
  });
  it('does not call Device connect, Modbus reads, commands, socket subscriptions or Overview saves', () => {
    const source = readFileSync(new URL('./AcquisitionMappingEditor.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/WebSocket|setInterval|\/connect|\/read|\/write|\/runtime|updateOverviewPage|setDraft|setHistory|window\.confirm/);
    expect(source).toContain("method: 'PUT'"); expect(source).toContain("method: 'DELETE'"); expect(source).toContain('!loaded');
  });
});
