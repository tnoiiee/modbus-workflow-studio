export const WRITE_TYPES_BY_FUNCTION_CODE: Readonly<Record<5 | 6 | 16, readonly string[]>> = Object.freeze({
  5: ['Boolean'],
  6: ['UInt16', 'Int16'],
  16: ['UInt32', 'Int32', 'Float32', 'Float64'],
});

export const WRITE_WIDTH: Readonly<Record<string, number>> = Object.freeze({
  Boolean: 1, UInt16: 1, Int16: 1, UInt32: 2, Int32: 2, Float32: 2, Float64: 4,
});

export interface WriteTransition { functionCode: 5 | 6 | 16; dataType: string; quantity: number }

/** Pure, atomic FC/type transition. A compatible current type is preserved. */
export function transitionWriteFunctionCode(functionCode: number, currentType: string): WriteTransition {
  if (functionCode !== 5 && functionCode !== 6 && functionCode !== 16) throw new Error('UNSUPPORTED_FUNCTION_CODE');
  const allowed = WRITE_TYPES_BY_FUNCTION_CODE[functionCode];
  const dataType = allowed.includes(currentType) ? currentType : functionCode === 5 ? 'Boolean' : functionCode === 6 ? 'UInt16' : 'Float32';
  return { functionCode, dataType, quantity: functionCode === 5 || functionCode === 6 ? 1 : WRITE_WIDTH[dataType] };
}

/** Performs one undo snapshot and one complete parameter update for an FC transition. */
export function commitWriteFunctionTransition(
  functionCode: number,
  current: Record<string, unknown>,
  recordHistory: () => void,
  update: (transition: WriteTransition) => void,
): boolean {
  if (functionCode === current.functionCode) return false;
  const transition = transitionWriteFunctionCode(functionCode, String(current.dataType ?? 'Boolean'));
  recordHistory();
  update(transition);
  return true;
}

export interface WriteGuidance { code: string; message: string }
const ORDERS = new Set(['ABCD', 'BADC', 'CDAB', 'DCBA']);
const reason = (code: string, message: string): WriteGuidance => ({ code, message });

/** Client guidance mirrors the existing Server validator; the Server remains authoritative. */
export function validateWriteGuidance(params: Record<string, unknown>, value?: unknown): WriteGuidance[] {
  const fc = params.functionCode === undefined ? 5 : params.functionCode;
  const type = params.dataType === undefined ? 'Boolean' : params.dataType;
  const address = params.address === undefined ? 0 : params.address;
  const order = params.order === undefined ? 'ABCD' : params.order;
  const findings: WriteGuidance[] = [];
  if (typeof fc !== 'number' || ![5, 6, 16].includes(fc)) return [reason('UNSUPPORTED_FUNCTION_CODE', 'Unsupported Function Code; choose FC05, FC06, or FC16.')];
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(WRITE_WIDTH, type)) return [reason('UNSUPPORTED_DATA_TYPE', 'Unsupported datatype for a guarded write.')];
  if (fc === 5 && type !== 'Boolean') findings.push(reason('FC05_REQUIRES_BOOLEAN', 'FC05 requires Boolean datatype.'));
  if (fc === 5 && !['NORMAL', 'ACTIVE_LOW'].includes(String(params.polarity ?? 'NORMAL'))) findings.push(reason('INVALID_POLARITY', 'FC05 polarity must be NORMAL or ACTIVE_LOW.'));
  const unitId = params.unitId === undefined ? 1 : params.unitId;
  if (typeof unitId !== 'number' || !Number.isInteger(unitId) || unitId < 0 || unitId > 255) findings.push(reason('INVALID_UNIT_ID', 'Unit ID must be an integer from 0 through 255.'));
  if (fc === 6 && !['UInt16', 'Int16'].includes(type)) findings.push(reason('FC06_REQUIRES_16_BIT_INTEGER', 'FC06 requires UInt16 or Int16 datatype.'));
  if (fc === 16 && !['UInt32', 'Int32', 'Float32', 'Float64'].includes(type)) findings.push(reason('FC16_REQUIRES_MULTI_REGISTER_TYPE', 'FC16 requires UInt32, Int32, Float32, or Float64 datatype.'));
  if (fc !== 5 && type === 'Boolean') findings.push(reason('REGISTER_WRITE_REQUIRES_NUMERIC_TYPE', 'Register writes require a numeric datatype.'));
  if (!Number.isInteger(address) || (address as number) < 0 || (address as number) > 65535) {
    findings.push(reason('INVALID_ZERO_BASED_ADDRESS', 'Address must be an integer from 0 through 65535 (zero-based).'));
  } else if ((address as number) + WRITE_WIDTH[type] > 65536) {
    findings.push(reason('ADDRESS_SPAN_EXCEEDS_MODBUS_RANGE', `Address span ${address}–${(address as number) + WRITE_WIDTH[type] - 1} exceeds the Modbus address space.`));
  }
  if (typeof order !== 'string' || !ORDERS.has(order)) findings.push(reason('INVALID_BYTE_WORD_ORDER', 'Invalid byte or word order; choose ABCD, BADC, CDAB, or DCBA.'));
  const quantity = params.quantity;
  const expectedQuantity = fc === 5 || fc === 6 ? 1 : WRITE_WIDTH[type];
  if (quantity !== undefined && quantity !== expectedQuantity) findings.push(reason('INVALID_WRITE_QUANTITY', `Quantity is derived from datatype width and must be ${expectedQuantity}.`));
  if (value !== undefined) {
    if (type === 'Boolean' ? typeof value !== 'boolean' : typeof value !== 'number' || !Number.isFinite(value)) {
      findings.push(reason(type === 'Boolean' ? 'COMMAND_TYPE_MISMATCH' : 'COMMAND_MUST_BE_FINITE_NUMBER', type === 'Boolean' ? 'Boolean commands must be true or false.' : 'Commanded numeric value must be finite.'));
    } else if (typeof value === 'number') {
      const outOfRange = type === 'UInt16' ? !Number.isInteger(value) || value < 0 || value > 65535
        : type === 'Int16' ? !Number.isInteger(value) || value < -32768 || value > 32767
          : type === 'UInt32' ? !Number.isSafeInteger(value) || value < 0 || value > 4294967295
            : type === 'Int32' ? !Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647
              : type === 'Float32' ? !Number.isFinite(Math.fround(value)) : false;
      if (outOfRange) findings.push(reason('COMMAND_OUT_OF_RANGE', `Commanded value is outside the ${type} range.`));
    }
  }
  return findings;
}

export function writeAddressSpan(address: unknown, dataType: string, functionCode: number): { width: number; quantity: number; finalAddress: number | null; overflow: boolean } {
  const width = functionCode === 5 ? 1 : Object.prototype.hasOwnProperty.call(WRITE_WIDTH, dataType) ? WRITE_WIDTH[dataType]! : 1;
  const quantity = functionCode === 5 || functionCode === 6 ? 1 : width;
  const validAddress = typeof address === 'number' && Number.isInteger(address) && address >= 0 && address <= 65535;
  const finalAddress = validAddress ? address + width - 1 : null;
  return { width, quantity, finalAddress, overflow: validAddress && finalAddress! > 65535 };
}
