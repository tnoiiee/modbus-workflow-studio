import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const selector = readFileSync(new URL('./ReadBackSourceSelector.tsx', import.meta.url), 'utf8');
describe('MODBUS_OUTPUT Inspector and write diagnostic wiring', () => {
  it('keeps FC05/06/16 selectable and commits one atomic Function Code/type transition through history', () => {
    expect(app).toContain("{value:5,label:'05 (Write Single Coil)'}");
    expect(app).toContain("{value:6,label:'06 (Write Single Register)'}");
    expect(app).toContain("{value:16,label:'16 (Write Multiple Registers)'}");
    expect(app).not.toContain("disabled:dataType!=='Boolean'");
    expect(app).toContain('commitWriteFunctionTransition(nextCode,params,recordHistory');
    expect(app).toContain('recordHistory={()=>pushHistory({nodes:WNodes(),edges:WEdges()})}');
    expect(app).toContain('patchParams({...transition})');
  });
  it('provides contextual selectors, explicit address spans, Server guidance, and a Validation route', () => {
    for (const text of ['Zero-based Coil address', 'Zero-based Register address', 'Zero-based starting Register address', 'Register span', 'ADDRESS_SPAN_EXCEEDS_MODBUS_RANGE', 'Open Workflow Validation', 'Server validation remains authoritative']) expect(app).toContain(text);
    expect(app).toContain('WRITE_TYPES_BY_FUNCTION_CODE[functionCode');
    expect(app).toContain('value={Number(params[key]??0)}');
  });
  it('uses only catalog SHARED_TAG identities and surfaces unresolved/disabled acquisition state', () => {
    expect(app).toContain('<ReadBackSourceSelector definitions={sharedTagDefinitions} mappings={acquisitionMappings}');
    expect(app).toContain("fetchSourceDefinitions()"); expect(app).toContain("acquisitionRequest<MappingResult[]>('/api/shared-tag-acquisition')");
    expect(selector).toContain("item.sourceType === 'SHARED_TAG'");
    expect(selector).toContain('Saved SHARED_TAG definition is currently missing');
    expect(selector).toContain('mapping disabled'); expect(selector).toContain('does not create a Poller');
  });
  it('renders distinct read-only Runtime values, Audit fields, and preserves RAW JSON', () => {
    for (const text of ['Command ID', 'Commanded value', 'Admission result', 'Effective value', 'Write status', 'Queue state', 'Created time', 'Expiry time', 'Rejection reason', 'Cancellation reason', 'Error', 'Read-back value', 'Read-back quality', 'Read-back availability', 'Read-back timestamp', 'Read-back mismatch']) expect(app).toContain(`['${text}'`);
    expect(app).toContain('runtime={selected?nodeRuntime[selected]:undefined}');
    expect(app).toContain('row.readBackHasValue===true&&row.readBackValue!==undefined');
    expect(app).toContain("pick('commandId')"); expect(app).toContain("pick('decision','result')"); expect(app).toContain("['Rejection reason'"); expect(app).toContain("['Cancellation reason'"); expect(app).toContain("['Expiry reason'"); expect(app).toContain("pick('commandedValue')"); expect(app).toContain("pick('effectiveValue')");
    expect(app).toContain('<h4>RAW JSON</h4>'); expect(app).toContain('WRITTEN is not a read-back verification'); expect(app).toContain('MISMATCH does not retry automatically');
  });
});
