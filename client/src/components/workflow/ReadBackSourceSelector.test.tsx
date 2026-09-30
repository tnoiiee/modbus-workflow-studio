import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReadBackSourceSelector } from './ReadBackSourceSelector.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
import type { MappingResult } from '../../lib/acquisitionApi.js';
const id = '11111111-1111-4111-8111-111111111111';
const definitions: SourceDefinition[] = [
  { sourceType: 'SHARED_TAG', sourceId: id, name: 'Pressure', dataType: 'Number', capability: 'MONITOR_ONLY', description: '', unit: 'bar', enabled: true },
  { sourceType: 'WORKFLOW_VARIABLE', workflowId: '22222222-2222-4222-8222-222222222222', variableId: '33333333-3333-4333-8333-333333333333', name: 'Internal', dataType: 'Boolean', capability: 'COMMAND_ONLY', description: '', unit: '', enabled: true },
];
const mapping: MappingResult = { availability: 'READY', mapping: { sourceId: id, deviceId: 'plc', unitId: 1, functionCode: 1, address: 1, width: 1, dataType: 'Boolean', byteOrder: 'BIG_ENDIAN', wordOrder: 'HIGH_FIRST', scale: 1, offset: 0, pollIntervalMs: 1000, staleAfterMs: 3000, enabled: true } };
describe('MODBUS_OUTPUT read-back catalog selector', () => {
  it('lists SHARED_TAG details and an existing read-only acquisition mapping only', () => {
    const html = renderToStaticMarkup(<ReadBackSourceSelector definitions={definitions} mappings={[mapping]} devices={[{ id: 'plc', name: 'Simulator' }]} value={id} onChange={vi.fn()}/>);
    expect(html).toContain('Pressure'); expect(html).toContain(id); expect(html).toContain('Number'); expect(html).toContain('bar');
    expect(html).toContain('Enabled'); expect(html).toContain('FC01 Unit 1 Address 1'); expect(html).toContain('Simulator');
    expect(html).not.toContain('Internal'); expect(html).toContain('does not create a Poller or connect a Device');
  });
  it('preserves and warns for an unresolved UUID without a free-form entry field', () => {
    const html = renderToStaticMarkup(<ReadBackSourceSelector definitions={[]} mappings={[]} devices={[]} value={id} onChange={vi.fn()}/>);
    expect(html).toContain('Saved ID · definition missing'); expect(html).toContain('currently missing'); expect(html).toContain(id);
    expect(html).toContain('<input readonly='); expect(html).not.toContain('type="text"');
  });
  it('warns when definition or mapping is disabled or missing', () => {
    const disabled: SourceDefinition[] = [{ ...definitions[0], enabled: false }];
    const html = renderToStaticMarkup(<ReadBackSourceSelector definitions={disabled} mappings={[{ ...mapping, availability: 'DISABLED', mapping: { ...mapping.mapping!, enabled: false } }]} devices={[]} value={id} onChange={vi.fn()}/>);
    expect(html).toContain('definition is disabled'); expect(html).toContain('Read-back acquisition is unavailable'); expect(html).toContain('mapping disabled');
    const missing = renderToStaticMarkup(<ReadBackSourceSelector definitions={[definitions[0]]} mappings={[]} devices={[]} value={id} onChange={vi.fn()}/>);
    expect(missing).toContain('Acquisition mapping missing');
  });
});
