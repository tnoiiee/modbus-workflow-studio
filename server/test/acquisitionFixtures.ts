import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DefinitionCatalog } from '../src/definitionCatalog.js';
import { AcquisitionConfig, type AcquisitionMapping } from '../src/acquisitionConfig.js';
import type { DeviceConfig } from '../src/types.js';
export const device: DeviceConfig = { id: 'plc', name: 'PLC', host: '127.0.0.1', port: 502, defaultUnitId: 1, timeout: 500, retryCount: 0, interRequestDelay: 0, reconnectDelay: 100, enabled: true };
export function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-o2b1-'));
  const catalog = new DefinitionCatalog(dir, () => true);
  let devices = [{ ...device }];
  const config = new AcquisitionConfig(dir, catalog, () => devices);
  const definition = (type = 'Number', extra = {}) => catalog.create({ sourceType: 'SHARED_TAG', name: 'Tag', dataType: type, capability: 'MONITOR_ONLY', ...extra }) as Extract<ReturnType<DefinitionCatalog['create']>, { sourceType: 'SHARED_TAG' }>;
  const map = (sourceId = definition().sourceId, patch: Partial<AcquisitionMapping> = {}): AcquisitionMapping => ({
    sourceId, deviceId: device.id, unitId: 1, functionCode: 3, address: 0, width: 1, dataType: 'UInt16',
    byteOrder: 'BIG_ENDIAN', wordOrder: 'HIGH_FIRST', scale: 1, offset: 0, pollIntervalMs: 100, staleAfterMs: 300, enabled: true, ...patch,
  });
  return { dir, catalog, config, definition, map, setDevices: (list: DeviceConfig[]) => { devices = list; }, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
export const readResponse = (value = 42, fc = 3) => Buffer.from([0, 1, 0, 0, 0, fc <= 2 ? 4 : 5, 1, fc, fc <= 2 ? 1 : 2, ...(fc <= 2 ? [value ? 1 : 0] : [value >> 8, value & 255])]);
