import { ACQUISITION_CODECS, type AcquisitionMapping } from './acquisitionApi.js';
import { isStableId, type DefinitionMetadata } from './sourceDefinitions.js';

export const ACQUISITION_FIELD_ORDER = ['deviceId', 'unitId', 'functionCode', 'address', 'dataType', 'width', 'byteOrder', 'wordOrder', 'scale', 'offset', 'pollIntervalMs', 'staleAfterMs', 'enabled', 'sourceId'] as const;
export type AcquisitionField = typeof ACQUISITION_FIELD_ORDER[number];
export type AcquisitionDraft = Record<Exclude<AcquisitionField, 'enabled'>, string> & { enabled: unknown };
export type AcquisitionErrors = Partial<Record<AcquisitionField, string>>;
export type AcquisitionDevice = { id: string; name: string; enabled: boolean };
export const FUNCTION_CODES = ['1', '2', '3', '4'] as const;
export const BYTE_ORDERS = ['BIG_ENDIAN', 'LITTLE_ENDIAN'] as const;
export const WORD_ORDERS = ['HIGH_FIRST', 'LOW_FIRST'] as const;
export const WIRE_TYPES = Object.keys(ACQUISITION_CODECS) as Array<keyof typeof ACQUISITION_CODECS>;
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
/** Keep exact edit strings, including empty, '-', '1e', NaN and stale enums. Never coerce to zero. */
export function acquisitionDraft(mapping: AcquisitionMapping): AcquisitionDraft {
  const draft = Object.fromEntries(ACQUISITION_FIELD_ORDER.map(key => [key, key === 'enabled' ? mapping[key] : text(mapping[key])])) as AcquisitionDraft;
  return draft;
}
export function codecWidth(dataType: string): number | undefined {
  return Object.hasOwn(ACQUISITION_CODECS, dataType) ? ACQUISITION_CODECS[dataType as keyof typeof ACQUISITION_CODECS] : undefined;
}
export function changeAcquisitionField(draft: AcquisitionDraft, field: AcquisitionField, value: string | boolean): { draft: AcquisitionDraft; impact: string } {
  const next = { ...draft, [field]: value } as AcquisitionDraft;
  const width = field === 'dataType' ? codecWidth(String(value)) : undefined;
  if (width !== undefined) next.width = String(width);
  return { draft: next, impact: field === 'dataType' && width !== undefined
    ? `Wire data type changed. Derived Width is ${width}. Function code, Scale and Offset were not changed.`
    : field === 'functionCode' ? 'Function code changed. Wire data type, Width, Scale and Offset were not changed; check compatibility below.' : '' };
}
export function validateAcquisition(draft: AcquisitionDraft, definition: Pick<DefinitionMetadata, 'dataType' | 'capability'>, devices: readonly AcquisitionDevice[], sourceId: string) {
  const errors: AcquisitionErrors = {};
  const numbers: Partial<Record<AcquisitionField, number>> = {};
  const numeric = (field: AcquisitionField, label: string, min?: number, max?: number, integer = false) => {
    const raw = String(draft[field]).trim();
    if (!raw) { errors[field] = `${label} is required.`; return; }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) {
      errors[field] = `Enter a complete finite number for ${label}.`; return;
    }
    const value = Number(raw); numbers[field] = value;
    if (min !== undefined && value < min) errors[field] = field === 'address' ? 'Address must be zero or greater.' : `${label} must be at least ${min}.`;
    else if (max !== undefined && value > max) errors[field] = `${label} must be ${max} or less.`;
    else if (integer && !Number.isInteger(value)) errors[field] = `${label} must be a whole number.`;
  };
  if (!draft.deviceId) errors.deviceId = 'Select a Device.';
  else if (draft.deviceId.length > 128) errors.deviceId = 'Device ID must be 128 characters or fewer.';
  else if (!devices.some(d => d.id === draft.deviceId)) errors.deviceId = 'This Device is unavailable. Select an existing Device; the Server validates existence on Save.';
  numeric('unitId', 'Unit ID', 0, 255, true);
  numeric('address', 'Address', 0, 65535, true);
  numeric('width', 'Width', 1, 4, true);
  numeric('scale', 'Scale'); numeric('offset', 'Offset');
  numeric('pollIntervalMs', 'Poll interval', 100, 3600000, true);
  numeric('staleAfterMs', 'Stale threshold', 100, 86400000, true);
  if (!FUNCTION_CODES.includes(draft.functionCode as typeof FUNCTION_CODES[number])) errors.functionCode = 'Select supported FC01, FC02, FC03 or FC04.';
  if (!WIRE_TYPES.includes(draft.dataType as typeof WIRE_TYPES[number])) errors.dataType = 'Select a supported Boolean or numeric wire codec. String decoding is not supported.';
  if (!BYTE_ORDERS.includes(draft.byteOrder as typeof BYTE_ORDERS[number])) errors.byteOrder = 'Select BIG_ENDIAN or LITTLE_ENDIAN.';
  if (!WORD_ORDERS.includes(draft.wordOrder as typeof WORD_ORDERS[number])) errors.wordOrder = 'Select HIGH_FIRST or LOW_FIRST.';
  if (typeof draft.enabled !== 'boolean') errors.enabled = 'Enabled must be checked or unchecked; select a valid Boolean state.';
  if (draft.sourceId !== sourceId || !isStableId(draft.sourceId)) errors.sourceId = 'Loaded mapping identity does not match this Shared Tag. Close and reload configuration.';
  if (!errors.dataType) {
    const boolean = draft.dataType === 'Boolean';
    if (definition.dataType === 'String') errors.dataType = 'String acquisition is not supported. The Definition remains valid.';
    else if (boolean !== (definition.dataType === 'Boolean')) errors.dataType = `Wire data type must match the ${definition.dataType} Definition.`;
    if (!errors.functionCode && (Number(draft.functionCode) <= 2) !== boolean) errors.functionCode = 'FC01/02 require Boolean; FC03/04 require a numeric wire codec.';
    const width = codecWidth(draft.dataType);
    if (!errors.width && numbers.width !== width) errors.width = `Width must be ${width} for ${draft.dataType}. Use the required codec width.`;
    if (boolean && !errors.scale && numbers.scale !== 1) errors.scale = 'Boolean acquisition requires Scale 1.';
    if (boolean && !errors.offset && numbers.offset !== 0) errors.offset = 'Boolean acquisition requires Offset 0.';
  }
  if (!errors.address && !errors.width && numbers.address! + numbers.width! > 65536) errors.address = 'Address plus Width must not exceed 65536 (last zero-based address is 65535).';
  if (!errors.pollIntervalMs && !errors.staleAfterMs && numbers.staleAfterMs! < numbers.pollIntervalMs!) errors.staleAfterMs = 'Stale threshold must be at least the Poll interval.';
  if (definition.capability === 'COMMAND_ONLY') errors.dataType = 'COMMAND_ONLY Definitions do not support read-only acquisition.';
  const firstInvalid = ACQUISITION_FIELD_ORDER.find(field => errors[field]);
  const mapping: AcquisitionMapping | undefined = firstInvalid ? undefined : {
    sourceId: draft.sourceId, deviceId: draft.deviceId, unitId: numbers.unitId!, functionCode: Number(draft.functionCode) as AcquisitionMapping['functionCode'],
    address: numbers.address!, width: numbers.width!, dataType: draft.dataType as AcquisitionMapping['dataType'],
    byteOrder: draft.byteOrder as AcquisitionMapping['byteOrder'], wordOrder: draft.wordOrder as AcquisitionMapping['wordOrder'],
    scale: numbers.scale!, offset: numbers.offset!, pollIntervalMs: numbers.pollIntervalMs!, staleAfterMs: numbers.staleAfterMs!, enabled: draft.enabled as boolean,
  };
  return { errors, firstInvalid, mapping };
}
/** Invalid Save remains keyboard-activatable but never sends a request. */
export function focusAcquisitionError(errors: AcquisitionErrors, fields: Partial<Record<AcquisitionField, { focus: () => void } | null>>): AcquisitionField | undefined {
  const first = ACQUISITION_FIELD_ORDER.find(field => errors[field]);
  if (first) fields[first]?.focus();
  return first;
}
