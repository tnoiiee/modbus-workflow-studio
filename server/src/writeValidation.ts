import { coilPayload, encodeValue, type Order } from './codec.js';
import type { DeviceConfig, WorkflowNode } from './types.js';

export const WRITE_FUNCTION_CODES = Object.freeze([5, 6, 16] as const);
export const WRITE_TYPES = Object.freeze(['Boolean', 'UInt16', 'Int16', 'UInt32', 'Int32', 'Float32', 'Float64'] as const);
export type WriteType = typeof WRITE_TYPES[number];
export const WRITE_WIDTH: Record<WriteType, number> = {
  Boolean: 1, UInt16: 1, Int16: 1, UInt32: 2, Int32: 2, Float32: 2, Float64: 4,
};
const ORDERS = new Set<Order>(['ABCD', 'BADC', 'CDAB', 'DCBA']);

export interface ValidatedWrite {
  functionCode: 5 | 6 | 16;
  dataType: WriteType;
  address: number;
  quantity: number;
  unitId: number;
  polarity: 'NORMAL' | 'ACTIVE_LOW';
  order: Order;
}

export function validateWriteConfiguration(node: WorkflowNode, device?: DeviceConfig): { config?: ValidatedWrite; reason?: string } {
  const p = node.params;
  const functionCode = p.functionCode === undefined ? 5 : p.functionCode;
  const dataType = p.dataType === undefined ? 'Boolean' : p.dataType;
  const address = p.address === undefined ? 0 : p.address;
  const quantity = p.quantity === undefined ? undefined : p.quantity;
  const unitId = p.unitId === undefined ? device?.defaultUnitId ?? 1 : p.unitId;
  const polarity = p.polarity === undefined ? 'NORMAL' : p.polarity;
  const order = p.order === undefined ? 'ABCD' : p.order;

  if (typeof functionCode !== 'number' || !WRITE_FUNCTION_CODES.includes(functionCode as 5 | 6 | 16)) return { reason: 'UNSUPPORTED_FUNCTION_CODE' };
  if (typeof dataType !== 'string' || !WRITE_TYPES.includes(dataType as WriteType)) return { reason: 'UNSUPPORTED_DATA_TYPE' };
  if (!Number.isInteger(address) || (address as number) < 0 || (address as number) > 65535) return { reason: 'INVALID_ZERO_BASED_ADDRESS' };
  if (typeof unitId !== 'number' || !Number.isInteger(unitId) || unitId < 0 || unitId > 255) return { reason: 'INVALID_UNIT_ID' };
  if (typeof order !== 'string' || !ORDERS.has(order as Order)) return { reason: 'INVALID_BYTE_WORD_ORDER' };
  if (p.writeOnChange !== undefined && typeof p.writeOnChange !== 'boolean') return { reason: 'INVALID_WRITE_ON_CHANGE_POLICY' };
  if (p.minimumWriteInterval !== undefined && (typeof p.minimumWriteInterval !== 'number' || !Number.isInteger(p.minimumWriteInterval) || p.minimumWriteInterval < 0 || p.minimumWriteInterval > 3600000)) return { reason: 'INVALID_MINIMUM_WRITE_INTERVAL' };
  if (p.writeMode !== undefined && !['AUTOMATIC', 'MANUAL_ONLY', 'AUTOMATIC_AND_MANUAL'].includes(String(p.writeMode))) return { reason: 'INVALID_WRITE_MODE' };
  if (p.initialWritePolicy !== undefined && !['DO_NOT_WRITE_UNTIL_CHANGE', 'WRITE_CURRENT_ONCE', 'READ_FIRST'].includes(String(p.initialWritePolicy))) return { reason: 'INVALID_INITIAL_WRITE_POLICY' };
  // Never imply that a read-before-write occurred: the guarded path has no on-demand read authority.
  if (p.initialWritePolicy === 'READ_FIRST') return { reason: 'READ_FIRST_NOT_SUPPORTED' };
  if (functionCode === 5) {
    if (dataType !== 'Boolean') return { reason: 'FC05_REQUIRES_BOOLEAN' };
    if (polarity !== 'NORMAL' && polarity !== 'ACTIVE_LOW') return { reason: 'INVALID_POLARITY' };
  } else {
    if (dataType === 'Boolean') return { reason: 'REGISTER_WRITE_REQUIRES_NUMERIC_TYPE' };
    if (functionCode === 6 && !['UInt16', 'Int16'].includes(dataType)) return { reason: 'FC06_REQUIRES_16_BIT_INTEGER' };
    if (functionCode === 16 && !['UInt32', 'Int32', 'Float32', 'Float64'].includes(dataType)) return { reason: 'FC16_REQUIRES_MULTI_REGISTER_TYPE' };
    if (typeof order !== 'string' || !ORDERS.has(order as Order)) return { reason: 'INVALID_BYTE_WORD_ORDER' };
  }
  const width = WRITE_WIDTH[dataType as WriteType];
  if ((address as number) + width > 65536) return { reason: 'ADDRESS_SPAN_EXCEEDS_MODBUS_RANGE' };
  const expectedQuantity = functionCode === 5 || functionCode === 6 ? 1 : width;
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity !== expectedQuantity)) return { reason: 'INVALID_WRITE_QUANTITY' };
  return { config: { functionCode: functionCode as 5 | 6 | 16, dataType: dataType as WriteType, address: address as number,
    quantity: expectedQuantity, unitId: unitId as number, polarity: polarity as 'NORMAL' | 'ACTIVE_LOW', order: order as Order } };
}

export function validateWriteValue(config: ValidatedWrite, value: unknown): string | undefined {
  if (config.dataType === 'Boolean') return typeof value === 'boolean' ? undefined : 'COMMAND_TYPE_MISMATCH';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'COMMAND_MUST_BE_FINITE_NUMBER';
  switch (config.dataType) {
    case 'UInt16': if (!Number.isInteger(value) || value < 0 || value > 65535) return 'COMMAND_OUT_OF_RANGE'; break;
    case 'Int16': if (!Number.isInteger(value) || value < -32768 || value > 32767) return 'COMMAND_OUT_OF_RANGE'; break;
    case 'UInt32': if (!Number.isSafeInteger(value) || value < 0 || value > 4294967295) return 'COMMAND_OUT_OF_RANGE'; break;
    case 'Int32': if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) return 'COMMAND_OUT_OF_RANGE'; break;
    case 'Float32': if (!Number.isFinite(Math.fround(value))) return 'COMMAND_OUT_OF_RANGE'; break;
    case 'Float64': break;
  }
  return undefined;
}

export function encodeWorkflowWrite(config: ValidatedWrite, value: unknown): { values: number[]; effectiveValue: boolean | number } {
  const problem = validateWriteValue(config, value);
  if (problem) throw Object.assign(new Error(problem), { code: problem });
  if (config.functionCode === 5) {
    const command = value as boolean;
    const effectiveValue = config.polarity === 'ACTIVE_LOW' ? !command : command;
    return { values: [coilPayload(command, config.polarity)], effectiveValue };
  }
  const numeric = value as number;
  if (config.dataType === 'Float32' && !Number.isFinite(Math.fround(numeric))) throw Error('COMMAND_OUT_OF_RANGE');
  return { values: encodeValue(numeric, config.dataType, config.order), effectiveValue: numeric };
}
