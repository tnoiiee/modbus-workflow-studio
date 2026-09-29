import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { DefinitionCatalog } from './definitionCatalog.js';
import type { DeviceConfig } from './types.js';

export const ACQUISITION_LIMITS = Object.freeze({ maxTags: 2000, maxGroupsPerDevice: 128,
  maxConcurrentReads: 32, minPollMs: 100, maxPollMs: 3600000, minStaleMs: 100,
  maxStaleMs: 86400000, tickMs: 50 });
export const CODEC_WIDTH = { Boolean: 1, UInt16: 1, Int16: 1, UInt32: 2, Int32: 2, Float32: 2, Float64: 4 } as const;
export const acquisitionSchema = z.object({
  sourceId: z.string().uuid(), deviceId: z.string().min(1).max(128), unitId: z.number().int().min(0).max(255),
  functionCode: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  address: z.number().int().min(0).max(65535), width: z.number().int().min(1).max(4),
  dataType: z.enum(['Boolean', 'UInt16', 'Int16', 'UInt32', 'Int32', 'Float32', 'Float64']),
  byteOrder: z.enum(['BIG_ENDIAN', 'LITTLE_ENDIAN']), wordOrder: z.enum(['HIGH_FIRST', 'LOW_FIRST']),
  scale: z.number().finite(), offset: z.number().finite(),
  pollIntervalMs: z.number().int().min(ACQUISITION_LIMITS.minPollMs).max(ACQUISITION_LIMITS.maxPollMs),
  staleAfterMs: z.number().int().min(ACQUISITION_LIMITS.minStaleMs).max(ACQUISITION_LIMITS.maxStaleMs), enabled: z.boolean(),
}).strict().superRefine((m, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (m.width !== CODEC_WIDTH[m.dataType]) issue('Width does not match codec');
  if ((m.functionCode <= 2) !== (m.dataType === 'Boolean')) issue('FC01/02 require Boolean; FC03/04 require a numeric codec');
  if (m.address + m.width > 65536) issue('Address range exceeds zero-based Modbus space');
  if (m.staleAfterMs < m.pollIntervalMs) issue('Stale threshold must be at least the poll interval');
  if (m.dataType === 'Boolean' && (m.scale !== 1 || m.offset !== 0)) issue('Boolean requires scale 1 and offset 0');
});
export type AcquisitionMapping = z.infer<typeof acquisitionSchema>;
export type AcquisitionAvailability = 'READY' | 'UNCONFIGURED' | 'DISABLED' | 'MISSING_DEFINITION' | 'MISSING_DEVICE' | 'INCOMPATIBLE';
export interface PollGroup { key: string; deviceId: string; unitId: number; functionCode: number; address: number; width: number; pollIntervalMs: number; mappings: AcquisitionMapping[] }
/** Conservative grouping: identical wire codec/cadence and explicitly configured range only.
 * Devices have no declared block-read capability today; never expand a configured read span. */
export function buildPollGroups(mappings: AcquisitionMapping[]): PollGroup[] {
  const buckets = new Map<string, AcquisitionMapping[]>();
  for (const m of mappings.filter(m => m.enabled)) {
    const key = JSON.stringify([m.deviceId, m.unitId, m.functionCode, m.pollIntervalMs, m.dataType, m.byteOrder, m.wordOrder]);
    const bucket = buckets.get(key) ?? []; bucket.push(m); buckets.set(key, bucket);
  }
  const groups: PollGroup[] = [];
  for (const [key, bucket] of buckets) {
    let group: PollGroup | undefined;
    for (const m of bucket.sort((a, b) => a.address - b.address || a.sourceId.localeCompare(b.sourceId))) {
      const end = m.address + m.width, limit = CODEC_WIDTH[m.dataType];
      if (!group || m.address > group.address + group.width || end - group.address > limit) {
        group = { key: `${key}:${m.address}`, deviceId: m.deviceId, unitId: m.unitId, functionCode: m.functionCode,
          address: m.address, width: m.width, pollIntervalMs: m.pollIntervalMs, mappings: [] };
        groups.push(group);
      }
      group.width = Math.max(group.width, end - group.address); group.mappings.push(m);
    }
  }
  return groups;
}
const problem = (status: number, message: string): never => { throw Object.assign(Error(message), { status }); };
export class AcquisitionConfig {
  private records = new Map<string, AcquisitionMapping>();
  private file: string;
  private listeners = new Set<() => void>();
  constructor(dataDir: string, private catalog: DefinitionCatalog, private devices: () => DeviceConfig[]) {
    this.file = path.join(dataDir, 'shared-tag-acquisition.json');
    if (fs.existsSync(this.file)) {
      const data = z.object({ version: z.literal(1), mappings: z.array(acquisitionSchema).max(ACQUISITION_LIMITS.maxTags) }).strict().parse(JSON.parse(fs.readFileSync(this.file, 'utf8')));
      for (const m of data.mappings) {
        if (this.records.has(m.sourceId)) throw Error('Duplicate acquisition sourceId');
        this.records.set(m.sourceId, m);
      }
      this.checkLimits(this.list());
    }
  }
  list() { return structuredClone([...this.records.values()]); }
  get(id: string) { const m = this.records.get(id); return m ? structuredClone(m) : undefined; }
  availability(m: AcquisitionMapping): AcquisitionAvailability {
    const d = this.catalog.get({ sourceType: 'SHARED_TAG', sourceId: m.sourceId });
    if (!d) return 'MISSING_DEFINITION';
    const device = this.devices().find(device => device.id === m.deviceId);
    if (!device) return 'MISSING_DEVICE';
    if (d.dataType !== (m.dataType === 'Boolean' ? 'Boolean' : 'Number') || d.capability === 'COMMAND_ONLY') return 'INCOMPATIBLE';
    if (!m.enabled || !d.enabled || !device.enabled) return 'DISABLED';
    return 'READY';
  }
  put(input: unknown) {
    const m = acquisitionSchema.parse(input);
    const availability = this.availability(m);
    if (availability === 'MISSING_DEFINITION') problem(404, 'SHARED_TAG definition not found');
    if (availability === 'MISSING_DEVICE') problem(404, 'Device not found');
    if (availability === 'INCOMPATIBLE') problem(400, 'Definition type/capability incompatible with acquisition codec; String decoding is not supported');
    const next = new Map(this.records); next.set(m.sourceId, m); this.checkLimits([...next.values()]); this.commit(next); return this.get(m.sourceId)!;
  }
  delete(id: string) { z.string().uuid().parse(id); const next = new Map(this.records); next.delete(id); this.commit(next); }
  subscribe(listener: () => void) { if (this.listeners.size >= 8) throw Error('Configuration listener limit'); this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private checkLimits(mappings: AcquisitionMapping[]) {
    if (mappings.length > ACQUISITION_LIMITS.maxTags) problem(409, 'Maximum Shared Tag mappings reached');
    const counts = new Map<string, number>();
    for (const g of buildPollGroups(mappings)) {
      const count = (counts.get(g.deviceId) ?? 0) + 1; counts.set(g.deviceId, count);
      if (count > ACQUISITION_LIMITS.maxGroupsPerDevice) problem(409, 'Maximum polling groups per Device reached');
    }
  }
  private commit(next: Map<string, AcquisitionMapping>) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify({ version: 1, mappings: [...next.values()] }, null, 2));
    fs.renameSync(`${this.file}.tmp`, this.file); this.records = next;
    for (const listener of this.listeners) listener();
  }
}
