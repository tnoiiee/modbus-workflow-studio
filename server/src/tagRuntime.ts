import { randomUUID } from 'node:crypto';
import type { SourceIdentity } from './definitionCatalog.js';
export type SharedTagIdentity = Extract<SourceIdentity, { sourceType: 'SHARED_TAG' }>;
export type TagQuality = 'GOOD' | 'UNCERTAIN' | 'STALE' | 'BAD' | 'DISCONNECTED';
export type TagDataType = 'Boolean' | 'Number' | 'String';
export type TagValue = boolean | number | string;
export interface TagSample {
  source: SharedTagIdentity; dataType: TagDataType; value: TagValue | null; hasValue: boolean;
  quality: TagQuality; reason: string; sourceTimestamp: string | null; receiveTimestamp: string | null;
  stateUpdatedAt: string; serverEpoch: string; sampleSequence: number;
  lastGoodValue: TagValue | null; lastGoodReceiveTimestamp: string | null;
}
export interface AcquisitionToken { sourceId: string; generation: number }
export type TagUpdate = { kind: 'updated'; sample: TagSample } | { kind: 'removed'; source: SharedTagIdentity; serverEpoch: string; sampleSequence: number; reason: string };
export const TAG_RUNTIME_LIMITS = Object.freeze({ maxTags: 2000, maxTextBytes: 1024, maxBytes: 16 * 1024 * 1024, maxSubscribers: 32 });
type Entry = { sample: TagSample; generation: number; inputSequence: number; receivedAt?: number; bytes: number };
/** Scalar canonical cache. Synchronous bounded update observers; no delivery queues or persistence. */
export class TagRuntimeStore {
  readonly serverEpoch = randomUUID();
  private entries = new Map<string, Entry>();
  private listeners = new Set<(update: TagUpdate) => void>();
  private generation = 0;
  private sequence = 0;
  private bytes = 0;
  observerErrors = 0;
  constructor(private clock = { wall: () => Date.now(), mono: () => performance.now() }, private limits: { [K in keyof typeof TAG_RUNTIME_LIMITS]: number } = TAG_RUNTIME_LIMITS) {}
  get size() { return this.entries.size; }
  get payloadBytes() { return this.bytes; }
  get(sourceId: string): TagSample | undefined { const e = this.entries.get(sourceId); return e ? structuredClone(e.sample) : undefined; }
  activate(sourceId: string, dataType: TagDataType): AcquisitionToken {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId)) throw Error('Stable SHARED_TAG UUID required');
    if (!['Boolean', 'Number', 'String'].includes(dataType)) throw Error('Unsupported normalized type');
    if (!this.entries.has(sourceId) && this.size >= this.limits.maxTags) throw Error('Tag Runtime capacity reached');
    const generation = ++this.generation;
    this.save(sourceId, { generation, inputSequence: 0, bytes: 0, sample: {
      source: { sourceType: 'SHARED_TAG', sourceId }, dataType, value: null, hasValue: false,
      quality: 'UNCERTAIN', reason: 'NO_SAMPLE', sourceTimestamp: null, receiveTimestamp: null,
      stateUpdatedAt: this.now(), serverEpoch: this.serverEpoch, sampleSequence: ++this.sequence,
      lastGoodValue: null, lastGoodReceiveTimestamp: null,
    } });
    return { sourceId, generation };
  }
  fence(token: AcquisitionToken, quality: 'DISCONNECTED' | 'UNCERTAIN', reason: string): AcquisitionToken | undefined {
    const e = this.current(token); if (!e) return;
    const generation = ++this.generation;
    this.save(token.sourceId, { ...e, generation, inputSequence: 0, sample: { ...e.sample, quality, reason: reason.slice(0, 256), stateUpdatedAt: this.now(), sampleSequence: ++this.sequence } });
    return { sourceId: token.sourceId, generation };
  }
  good(token: AcquisitionToken, inputSequence: number, value: unknown): boolean {
    const e = this.current(token, inputSequence); if (!e) return false;
    const valid = e.sample.dataType === 'Boolean' ? typeof value === 'boolean'
      : e.sample.dataType === 'Number' ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === 'string' && Buffer.byteLength(value) <= this.limits.maxTextBytes;
    if (!valid) return this.bad(token, inputSequence, 'INVALID_VALUE');
    const time = this.now();
    this.save(token.sourceId, { ...e, inputSequence, receivedAt: this.clock.mono(), sample: { ...e.sample,
      value: value as TagValue, hasValue: true, quality: 'GOOD', reason: 'READ_OK', sourceTimestamp: null,
      receiveTimestamp: time, stateUpdatedAt: time, sampleSequence: ++this.sequence,
      lastGoodValue: value as TagValue, lastGoodReceiveTimestamp: time,
    } }); return true;
  }
  bad(token: AcquisitionToken, inputSequence: number, reason: string): boolean {
    const e = this.current(token, inputSequence); if (!e) return false;
    this.save(token.sourceId, { ...e, inputSequence, sample: { ...e.sample, quality: 'BAD', reason: reason.slice(0, 256), stateUpdatedAt: this.now(), sampleSequence: ++this.sequence } }); return true;
  }
  expire(token: AcquisitionToken, staleAfterMs: number): void {
    const e = this.current(token);
    if (!e || e.receivedAt === undefined || e.sample.quality !== 'GOOD' || this.clock.mono() - e.receivedAt < staleAfterMs) return;
    this.save(token.sourceId, { ...e, sample: { ...e.sample, quality: 'STALE', reason: 'FRESHNESS_EXCEEDED', stateUpdatedAt: this.now(), sampleSequence: ++this.sequence } });
  }
  remove(sourceId: string, reason: string) {
    const e = this.entries.get(sourceId); if (!e) return;
    this.bytes -= e.bytes; this.entries.delete(sourceId);
    this.emit({ kind: 'removed', source: e.sample.source, serverEpoch: this.serverEpoch, sampleSequence: ++this.sequence, reason: reason.slice(0, 256) });
  }
  subscribe(listener: (update: TagUpdate) => void) {
    if (this.listeners.size >= this.limits.maxSubscribers) throw Error('Tag Runtime subscriber limit');
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  private now() { return new Date(this.clock.wall()).toISOString(); }
  private current(token: AcquisitionToken, sequence?: number) {
    const e = this.entries.get(token.sourceId);
    return e && e.generation === token.generation && (sequence === undefined || Number.isSafeInteger(sequence) && sequence > e.inputSequence) ? e : undefined;
  }
  private save(id: string, entry: Entry) {
    const bytes = Buffer.byteLength(JSON.stringify(entry.sample));
    const total = this.bytes - (this.entries.get(id)?.bytes ?? 0) + bytes;
    if (total > this.limits.maxBytes) throw Error('Tag Runtime byte limit');
    this.entries.set(id, { ...entry, bytes }); this.bytes = total;
    this.emit({ kind: 'updated', sample: entry.sample });
  }
  private emit(event: TagUpdate) { for (const listener of this.listeners) { try { listener(structuredClone(event)); } catch { this.observerErrors++; } } }
}
