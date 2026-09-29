/** Acquisition configuration only. No sample, command, socket or connect API. */
export const ACQUISITION_CODECS = { Boolean: 1, UInt16: 1, Int16: 1, UInt32: 2, Int32: 2, Float32: 2, Float64: 4 } as const;
export interface AcquisitionMapping {
  sourceId: string; deviceId: string; unitId: number; functionCode: 1 | 2 | 3 | 4; address: number; width: number;
  dataType: keyof typeof ACQUISITION_CODECS; byteOrder: 'BIG_ENDIAN' | 'LITTLE_ENDIAN'; wordOrder: 'HIGH_FIRST' | 'LOW_FIRST';
  scale: number; offset: number; pollIntervalMs: number; staleAfterMs: number; enabled: boolean;
}
export interface MappingResult { mapping: AcquisitionMapping | null; availability: string }
export async function acquisitionRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw Error(body.error ?? 'Unable to load acquisition configuration');
  return body as T;
}
export const acquisitionPath = (sourceId: string) => `/api/shared-tag-acquisition/${encodeURIComponent(sourceId)}`;
export function defaultAcquisition(sourceId: string, boolean: boolean): AcquisitionMapping {
  return { sourceId, deviceId: '', unitId: 1, functionCode: boolean ? 1 : 3, address: 0, width: 1,
    dataType: boolean ? 'Boolean' : 'UInt16', byteOrder: 'BIG_ENDIAN', wordOrder: 'HIGH_FIRST', scale: 1, offset: 0,
    pollIntervalMs: 1000, staleAfterMs: 3000, enabled: false };
}
