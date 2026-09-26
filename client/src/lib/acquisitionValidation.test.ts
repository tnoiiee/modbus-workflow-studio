import { describe, expect, it, vi } from 'vitest';
import { acquisitionDraft, validateAcquisition, changeAcquisitionField, focusAcquisitionError, FUNCTION_CODES, WIRE_TYPES, BYTE_ORDERS, WORD_ORDERS, type AcquisitionDraft } from './acquisitionValidation.js';
import { defaultAcquisition } from './acquisitionApi.js';
const id = '11111111-1111-4111-8111-111111111111';
const definition = { dataType: 'Number' as const, capability: 'MONITOR_ONLY' as const };
const devices = [{ id: 'plc', name: 'PLC', enabled: true }];
const draft = (): AcquisitionDraft => ({ ...acquisitionDraft(defaultAcquisition(id, false)), deviceId: 'plc' });
const validate = (patch: Partial<AcquisitionDraft> = {}) => validateAcquisition({ ...draft(), ...patch }, definition, devices, id);
describe('frontend acquisition validation without contract changes', () => {
  it('accepts zero address, zero scale/offset and emits the existing exact mapping shape', () => {
    const result = validate({ address: '0', scale: '0', offset: '0' }); expect(result.errors).toEqual({});
    expect(result.mapping).toEqual({ ...defaultAcquisition(id, false), deviceId: 'plc', scale: 0 });
  });
  it('negative address gets the explicit zero-based reason', () => { expect(validate({ address: '-1' }).errors.address).toBe('Address must be zero or greater.'); });
  it.each(['', '-', '+', '.', '1e', '1e-', 'NaN', 'Infinity', '-Infinity', '0x10', 'abc'])('retains invalid/partial address %j without coercion', address => {
    const next = changeAcquisitionField(draft(), 'address', address).draft; expect(next.address).toBe(address);
    expect(validate({ address }).mapping).toBeUndefined(); expect(validate({ address }).errors.address).toBeTruthy();
  });
  it.each(['-1', '256', '1.5', 'Infinity'])('rejects Unit ID %s', unitId => { expect(validate({ unitId }).errors.unitId).toBeTruthy(); });
  it.each(['', '0', '5', '1.5', '2'])('rejects incompatible Width %s', width => { expect(validate({ width }).errors.width).toBeTruthy(); });
  it('validates address + width while keeping the final register valid', () => {
    expect(validate({ dataType: 'Float64', width: '4', address: '65533' }).errors.address).toContain('65536');
    expect(validate({ dataType: 'Float64', width: '4', address: '65532' }).mapping).toBeDefined();
    expect(validate({ address: '65535' }).mapping).toBeDefined();
  });
  it.each(['scale', 'offset'] as const)('rejects NaN/Infinity in %s, accepts finite exponent input', field => {
    for (const raw of ['NaN', 'Infinity', '-Infinity', '1e999']) expect(validate({ [field]: raw }).errors[field]).toBeTruthy();
    expect(validate({ [field]: '-1.25e2' }).mapping?.[field]).toBe(-125);
  });
  it.each(['99', '3600001', '100.1', ''])('rejects poll interval %s', pollIntervalMs => { expect(validate({ pollIntervalMs }).errors.pollIntervalMs).toBeTruthy(); });
  it.each(['99', '999', '86400001', '1000.1', ''])('rejects stale threshold %s', staleAfterMs => { expect(validate({ staleAfterMs }).errors.staleAfterMs).toBeTruthy(); });
  it('bounds thresholds exactly as the existing Server', () => { expect(validate({ pollIntervalMs: '3600000', staleAfterMs: '86400000' }).mapping).toBeDefined(); });
  it.each(['functionCode', 'dataType', 'byteOrder', 'wordOrder'] as const)('rejects stale unsupported %s without substitution', field => {
    const raw = { ...draft(), [field]: 'unsupported' }; expect(validateAcquisition(raw, definition, devices, id).errors[field]).toBeTruthy(); expect(raw[field]).toBe('unsupported');
  });
  it('exports only the supported combobox sets', () => {
    expect(FUNCTION_CODES).toEqual(['1', '2', '3', '4']); expect(WIRE_TYPES).toEqual(['Boolean', 'UInt16', 'Int16', 'UInt32', 'Int32', 'Float32', 'Float64']);
    expect(BYTE_ORDERS).toEqual(['BIG_ENDIAN', 'LITTLE_ENDIAN']); expect(WORD_ORDERS).toEqual(['HIGH_FIRST', 'LOW_FIRST']);
  });
  it('rejects missing/stale Device but allows a disabled existing Device mapping', () => {
    expect(validate({ deviceId: '' }).errors.deviceId).toBeTruthy(); expect(validate({ deviceId: 'deleted' }).errors.deviceId).toContain('unavailable');
    expect(validateAcquisition(draft(), definition, [{ ...devices[0], enabled: false }], id).mapping).toBeDefined();
  });
  it('never silently changes FC, scale or offset when codec changes; announces derived width', () => {
    const original = { ...draft(), scale: '2', offset: '3', functionCode: '4' };
    const changed = changeAcquisitionField(original, 'dataType', 'Float64'); expect(changed.draft).toMatchObject({ functionCode: '4', scale: '2', offset: '3', width: '4' }); expect(changed.impact).toContain('Derived Width is 4');
    const boolean = changeAcquisitionField(original, 'dataType', 'Boolean'); expect(boolean.draft).toMatchObject({ functionCode: '4', scale: '2', offset: '3', width: '1' });
    expect(validateAcquisition(boolean.draft, { ...definition, dataType: 'Boolean' }, devices, id).errors).toMatchObject({ functionCode: expect.any(String), scale: expect.any(String), offset: expect.any(String) });
  });
  it('FC change retains every other user value and reports impact', () => {
    const original = draft(), changed = changeAcquisitionField(original, 'functionCode', '1'); expect(changed.draft).toEqual({ ...original, functionCode: '1' }); expect(changed.impact).toContain('not changed'); expect(validate({ functionCode: '1' }).errors.functionCode).toBeTruthy();
  });
  it('unsupported String and COMMAND_ONLY definitions remain explicit errors', () => {
    expect(validateAcquisition(draft(), { ...definition, dataType: 'String' }, devices, id).errors.dataType).toContain('String acquisition');
    expect(validateAcquisition(draft(), { ...definition, capability: 'COMMAND_ONLY' }, devices, id).mapping).toBeUndefined();
  });
  it('rejects invalid enabled and identity while false remains valid', () => { expect(validate({ enabled: 'true' }).errors.enabled).toBeTruthy(); expect(validate({ enabled: false }).mapping?.enabled).toBe(false); expect(validate({ sourceId: 'node-name' }).errors.sourceId).toBeTruthy(); });
  it('focuses first invalid field in form order, then clears after correction', () => {
    const device = vi.fn(), address = vi.fn(); const invalid = validate({ deviceId: '', address: '-1' });
    expect(focusAcquisitionError(invalid.errors, { deviceId: { focus: device }, address: { focus: address } })).toBe('deviceId'); expect(device).toHaveBeenCalledOnce(); expect(address).not.toHaveBeenCalled();
    expect(validate().errors).toEqual({}); expect(focusAcquisitionError(validate().errors, {})).toBeUndefined();
  });
});
