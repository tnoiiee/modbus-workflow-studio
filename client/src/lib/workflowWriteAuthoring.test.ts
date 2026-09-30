import { describe, expect, it, vi } from 'vitest';
import { commitWriteFunctionTransition, transitionWriteFunctionCode, validateWriteGuidance, writeAddressSpan } from './workflowWriteAuthoring.js';

describe('guarded MODBUS_OUTPUT authoring guidance', () => {
  it('transitions FC/type atomically, preserves compatible types and selects explicit fallbacks', () => {
    expect(transitionWriteFunctionCode(5, 'Int16')).toEqual({ functionCode: 5, dataType: 'Boolean', quantity: 1 });
    expect(transitionWriteFunctionCode(6, 'Int16')).toEqual({ functionCode: 6, dataType: 'Int16', quantity: 1 });
    expect(transitionWriteFunctionCode(6, 'Boolean')).toEqual({ functionCode: 6, dataType: 'UInt16', quantity: 1 });
    expect(transitionWriteFunctionCode(16, 'Float64')).toEqual({ functionCode: 16, dataType: 'Float64', quantity: 4 });
    expect(transitionWriteFunctionCode(16, 'UInt16')).toEqual({ functionCode: 16, dataType: 'Float32', quantity: 2 });
    expect(() => transitionWriteFunctionCode(15, 'Boolean')).toThrow('UNSUPPORTED_FUNCTION_CODE');
  });

  it('creates exactly one Undo snapshot and one atomic persisted update per Function Code change', () => {
    const history = vi.fn(), update = vi.fn();
    expect(commitWriteFunctionTransition(6, { functionCode: 5, dataType: 'Boolean', address: 0 }, history, update)).toBe(true);
    expect(history).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ functionCode: 6, dataType: 'UInt16', quantity: 1 });
    expect(commitWriteFunctionTransition(6, { functionCode: 6, dataType: 'UInt16' }, history, update)).toBe(false);
    expect(history).toHaveBeenCalledTimes(1); expect(update).toHaveBeenCalledTimes(1);
  });

  it('matches Server function-code/type, zero-based address, span, quantity and ordering reasons', () => {
    expect(validateWriteGuidance({ functionCode: 5, dataType: 'UInt16' }).map(item => item.code)).toContain('FC05_REQUIRES_BOOLEAN');
    expect(validateWriteGuidance({ functionCode: 6, dataType: 'Float32' }).map(item => item.code)).toContain('FC06_REQUIRES_16_BIT_INTEGER');
    expect(validateWriteGuidance({ functionCode: 16, dataType: 'UInt16' }).map(item => item.code)).toContain('FC16_REQUIRES_MULTI_REGISTER_TYPE');
    expect(validateWriteGuidance({ functionCode: 16, dataType: 'Float64', address: 65533, quantity: 4 }).map(item => item.code)).toContain('ADDRESS_SPAN_EXCEEDS_MODBUS_RANGE');
    expect(validateWriteGuidance({ functionCode: 16, dataType: 'Float32', address: 0, quantity: 1, order: 'bad' }).map(item => item.code)).toEqual(expect.arrayContaining(['INVALID_WRITE_QUANTITY', 'INVALID_BYTE_WORD_ORDER']));
    expect(validateWriteGuidance({ functionCode: 6, dataType: 'UInt16', address: -1 }).map(item => item.code)).toContain('INVALID_ZERO_BASED_ADDRESS');
    expect(validateWriteGuidance({ functionCode: 16, dataType: 'Float32' }, Number.POSITIVE_INFINITY).map(item => item.code)).toContain('COMMAND_MUST_BE_FINITE_NUMBER');
    expect(validateWriteGuidance({ functionCode: 6, dataType: 'UInt16' }, 65536).map(item => item.code)).toContain('COMMAND_OUT_OF_RANGE');
    expect(validateWriteGuidance({ functionCode: 5, dataType: 'Boolean', polarity: 'broken' }).map(item => item.code)).toContain('INVALID_POLARITY');
    expect(validateWriteGuidance({ functionCode: 16, dataType: 'constructor' }).map(item => item.code)).toContain('UNSUPPORTED_DATA_TYPE');
  });

  it('derives FC16 occupied spans and keeps final boundary visible', () => {
    expect(writeAddressSpan(65534, 'Float32', 16)).toEqual({ width: 2, quantity: 2, finalAddress: 65535, overflow: false });
    expect(writeAddressSpan(65535, 'Float32', 16)).toEqual({ width: 2, quantity: 2, finalAddress: 65536, overflow: true });
    expect(writeAddressSpan('1', 'Float32', 16)).toEqual({ width: 2, quantity: 2, finalAddress: null, overflow: false });
  });
});
