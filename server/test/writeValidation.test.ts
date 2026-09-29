import { describe, expect, it } from 'vitest';
import type { Workflow, WorkflowNode } from '../src/types.js';
import { validateWorkflow } from '../src/engine.js';
import { encodeWorkflowWrite, validateWriteConfiguration, validateWriteValue } from '../src/writeValidation.js';
const node = (params: Record<string, unknown>): WorkflowNode => ({ id: 'out', type: 'MODBUS_OUTPUT', name: 'OUT', position: { x: 0, y: 0 }, inputCount: 1, outputCount: 0, params });
describe('strict Workflow write contract', () => {
  it('supports only FC05 Boolean, FC06 signed/unsigned 16-bit, and FC16 approved multi-register values', () => {
    expect(validateWriteConfiguration(node({ functionCode: 5, dataType: 'Boolean', address: 65535 })).config?.quantity).toBe(1);
    expect(validateWriteConfiguration(node({ functionCode: 6, dataType: 'Int16', address: 0 })).reason).toBeUndefined();
    for (const dataType of ['UInt32', 'Int32', 'Float32', 'Float64']) expect(validateWriteConfiguration(node({ functionCode: 16, dataType, address: 0 })).reason).toBeUndefined();
    expect(validateWriteConfiguration(node({ functionCode: 15, dataType: 'Boolean' })).reason).toBe('UNSUPPORTED_FUNCTION_CODE');
    expect(validateWriteConfiguration(node({ functionCode: 6, dataType: 'Float32' })).reason).toBe('FC06_REQUIRES_16_BIT_INTEGER');
    expect(validateWriteConfiguration(node({ functionCode: 16, dataType: 'UInt16' })).reason).toBe('FC16_REQUIRES_MULTI_REGISTER_TYPE');
    expect(validateWriteConfiguration(node({ functionCode: 5, dataType: 'UInt16' })).reason).toBe('FC05_REQUIRES_BOOLEAN');
    expect(validateWriteConfiguration(node({ functionCode: 5, dataType: 'Boolean', initialWritePolicy: 'READ_FIRST' })).reason).toBe('READ_FIRST_NOT_SUPPORTED');
  });
  it('enforces zero-based addresses and the entire encoded address span', () => {
    expect(validateWriteConfiguration(node({ functionCode: 6, dataType: 'UInt16', address: 65535 })).reason).toBeUndefined();
    expect(validateWriteConfiguration(node({ functionCode: 16, dataType: 'Float32', address: 65534 })).reason).toBeUndefined();
    expect(validateWriteConfiguration(node({ functionCode: 16, dataType: 'Float64', address: 65532 })).reason).toBeUndefined();
    expect(validateWriteConfiguration(node({ functionCode: 16, dataType: 'Float32', address: 65535 })).reason).toBe('ADDRESS_SPAN_EXCEEDS_MODBUS_RANGE');
    expect(validateWriteConfiguration(node({ functionCode: 16, dataType: 'Float64', address: 65533 })).reason).toBe('ADDRESS_SPAN_EXCEEDS_MODBUS_RANGE');
    expect(validateWriteConfiguration(node({ functionCode: 6, dataType: 'UInt16', address: -1 })).reason).toBe('INVALID_ZERO_BASED_ADDRESS');
    expect(validateWriteConfiguration(node({ functionCode: 6, dataType: 'UInt16', address: 0, quantity: 2 })).reason).toBe('INVALID_WRITE_QUANTITY');
  });
  it('rejects invalid order, policy and lossy type/value coercion', () => {
    expect(validateWriteConfiguration(node({ functionCode: 16, dataType: 'Float32', order: 'ABCDZ' })).reason).toBe('INVALID_BYTE_WORD_ORDER');
    expect(validateWriteConfiguration(node({ functionCode: 5, dataType: 'Boolean', polarity: 'INVERT' })).reason).toBe('INVALID_POLARITY');
    const u16 = validateWriteConfiguration(node({ functionCode: 6, dataType: 'UInt16' })).config!;
    for (const value of [-1, 65536, 1.5, Infinity, NaN, '1', true]) expect(validateWriteValue(u16, value)).toBeTruthy();
    const i16 = validateWriteConfiguration(node({ functionCode: 6, dataType: 'Int16' })).config!;
    expect(validateWriteValue(i16, -32768)).toBeUndefined(); expect(validateWriteValue(i16, 32768)).toBe('COMMAND_OUT_OF_RANGE');
    const u32 = validateWriteConfiguration(node({ functionCode: 16, dataType: 'UInt32' })).config!;
    expect(validateWriteValue(u32, 4294967295)).toBeUndefined(); expect(validateWriteValue(u32, 4294967296)).toBe('COMMAND_OUT_OF_RANGE');
  });
  it('rejects invalid constant types before the Engine can coerce a write command', () => {
    const workflow: Workflow = { version: 1, mode: 'LIVE_ARMED', running: true, nodes: [
      { id: 'bool', type: 'BOOLEAN_CONSTANT', name: 'BOOL', position: { x: 0, y: 0 }, inputCount: 0, outputCount: 1, params: { value: 'false' } },
      { id: 'number', type: 'NUMERIC_CONSTANT', name: 'NUMBER', position: { x: 0, y: 0 }, inputCount: 0, outputCount: 1, params: { value: '1' } },
    ], edges: [], settings: {} };
    expect(validateWorkflow(workflow).map(issue => issue.message)).toEqual(expect.arrayContaining([
      'Boolean Constant value must be a Boolean', 'Numeric Constant value must be a finite number',
    ]));
  });
  it('encodes Boolean polarity and each numeric word order without implicit conversion', () => {
    const coil = validateWriteConfiguration(node({ functionCode: 5, dataType: 'Boolean', polarity: 'ACTIVE_LOW' })).config!;
    expect(encodeWorkflowWrite(coil, true)).toEqual({ values: [0], effectiveValue: false });
    expect(encodeWorkflowWrite(coil, false)).toEqual({ values: [0xff00], effectiveValue: true });
    const float = validateWriteConfiguration(node({ functionCode: 16, dataType: 'Float32', order: 'CDAB' })).config!;
    expect(encodeWorkflowWrite(float, 12.5).values).toHaveLength(2);
    expect(() => encodeWorkflowWrite(float, '12.5')).toThrow('COMMAND_MUST_BE_FINITE_NUMBER');
  });
});
