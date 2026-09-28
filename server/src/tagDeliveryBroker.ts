import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DefinitionCatalog } from './definitionCatalog.js';
import type { AcquisitionConfig } from './acquisitionConfig.js';
import type { DeviceConfig } from './types.js';
import type { TagRuntimeStore, SharedTagIdentity } from './tagRuntime.js';
import { DeliveryError, TAG_DELIVERY_LIMITS as L, selection, jsonBytes, type DeliveryEvent, type DeliveryItem, type TagSnapshot } from './tagDeliveryContract.js';
export function availabilityReader(catalog: DefinitionCatalog, config: AcquisitionConfig, devices: () => DeviceConfig[], store: TagRuntimeStore) {
  return (source: SharedTagIdentity): DeliveryItem => {
    const unavailable = (availability: DeliveryItem['availability'], reason = availability): DeliveryItem => ({ source, availability, reason, sample: store.get(source.sourceId) ?? null });
    const definition = catalog.get(source); if (!definition) return unavailable('DEFINITION_MISSING');
    if (!definition.enabled) return unavailable('DEFINITION_DISABLED');
    if (definition.dataType === 'String' || definition.capability === 'COMMAND_ONLY') return unavailable('UNSUPPORTED');
    const mapping = config.get(source.sourceId); if (!mapping) return unavailable('UNCONFIGURED');
    if (!mapping.enabled) return unavailable('MAPPING_DISABLED');
    const device = devices().find(d => d.id === mapping.deviceId); if (!device) return unavailable('DEVICE_MISSING');
    if (!device.enabled) return unavailable('DEVICE_DISABLED');
    if (config.availability(mapping) === 'INCOMPATIBLE') return unavailable('INCOMPATIBLE');
    const sample = store.get(source.sourceId);
    if (!sample) return unavailable('NO_SAMPLE');
    return { source, availability: sample.quality === 'DISCONNECTED' ? 'DISCONNECTED' : sample.hasValue ? 'AVAILABLE' : 'NO_SAMPLE', reason: sample.reason, sample };
  };
}
/** FIFO journal owns serialized-byte accounting, never pinned by subscribers. */
export class TagJournal {
  private events = new Map<number, { event: DeliveryEvent; bytes: number; at: number }>();
  bytes = 0; floor = 0; private head = 0;
  constructor(private now = () => performance.now(), readonly limits = { count: L.journalCount as number, bytes: L.journalBytes as number, ageMs: L.journalAgeMs as number }) {}
  prune() {
    for (const [seq, entry] of this.events) {
      if (this.now() - entry.at < this.limits.ageMs && this.events.size <= this.limits.count && this.bytes <= this.limits.bytes) break;
      this.events.delete(seq); this.bytes -= entry.bytes; this.floor = seq;
    }
  }
  append(event: DeliveryEvent) {
    if (event.deliverySequence !== this.head + 1) throw new DeliveryError('JOURNAL_ORDER', 503);
    this.head = event.deliverySequence;
    const bytes = jsonBytes(event); this.events.set(event.deliverySequence, { event, bytes, at: this.now() }); this.bytes += bytes; this.prune();
  }
  range(after: number, max = 128) {
    this.prune(); if (after < this.floor) throw new DeliveryError('REPLAY_EXPIRED', 409);
    const result: DeliveryEvent[] = [];
    for (let seq = after + 1; seq <= this.head && result.length < max; seq++) {
      const entry = this.events.get(seq); if (!entry) throw new DeliveryError('REPLAY_EXPIRED', 409); result.push(entry.event);
    }
    return result;
  }
  get count() { return this.events.size; }
  clear() { this.events.clear(); this.bytes = 0; this.floor = this.head; }
}
type Watch = { source: SharedTagIdentity; signature: string; refs: number; until: number; since: number };
/** One synchronous Store observer; no HTTP/WS/React dependencies, no producer mutation. */
export class TagDeliveryBroker {
  readonly serverEpoch: string;
  readonly journal: TagJournal;
  private head = 0;
  private signingKey = randomBytes(32);
  private watches = new Map<string, Watch>();
  private off: () => void;
  private stopped = false;
  private failed = false;
  constructor(store: TagRuntimeStore, private read: (source: SharedTagIdentity) => DeliveryItem, private now = () => performance.now(), journal?: TagJournal) {
    this.serverEpoch = store.serverEpoch; this.journal = journal ?? new TagJournal(now);
    this.off = store.subscribe(update => {
      try {
        const source = update.kind === 'updated' ? update.sample.source : update.source;
        const item = this.read(source); this.publish(update.kind, item, update.kind === 'updated' ? update.sample.sampleSequence : update.sampleSequence);
      } catch { this.failed = true; } // fail closed; do not throw into or block the producer
    });
  }
  private check() { if (this.stopped || this.failed) throw new DeliveryError('DELIVERY_UNAVAILABLE', 503); }
  get sequence() { return this.head; }
  get identities() { this.prune(); return this.watches.size; }
  private signature(item: DeliveryItem) { return JSON.stringify([item.availability, item.reason]); }
  private publish(kind: DeliveryEvent['kind'], item: DeliveryItem, sampleSequence?: number) {
    this.check(); if (this.head >= Number.MAX_SAFE_INTEGER) { this.failed = true; throw new DeliveryError('SEQUENCE_EXHAUSTED', 503); }
    const watch = this.watches.get(item.source.sourceId); if (watch) watch.signature = this.signature(item);
    this.journal.append({ deliverySequence: ++this.head, kind, item, sampleSequence });
  }
  prune() { this.journal.prune(); for (const [id, watch] of this.watches) if (watch.refs === 0 && this.now() >= watch.until) this.watches.delete(id); }
  /** Notification failure must never turn a successful configuration write into a failed CRUD response. */
  notifyInvalidation() { if (this.stopped) return; try { this.invalidate(); } catch { this.failed = true; } }
  invalidate() {
    this.check(); this.prune();
    for (const watch of this.watches.values()) { const item = this.read(watch.source); if (this.signature(item) !== watch.signature) this.publish('availability', item); }
  }
  cursor(key: string, sequence = this.head) {
    const body = Buffer.from(JSON.stringify([this.serverEpoch, sequence, createHash('sha256').update(key).digest('hex')])).toString('base64url');
    return body + '.' + createHmac('sha256', this.signingKey).update(body).digest('base64url');
  }
  decode(cursor: string, key: string): number {
    this.check(); if (cursor.length > 1024) throw new DeliveryError('INVALID_CURSOR', 409);
    const [body, mac, extra] = cursor.split('.'); if (!body || !mac || extra || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(mac)) throw new DeliveryError('INVALID_CURSOR', 409);
    const expected = createHmac('sha256', this.signingKey).update(body).digest(); const supplied = Buffer.from(mac, 'base64url');
    if (supplied.toString('base64url') !== mac || supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) throw new DeliveryError('CURSOR_CONTEXT_MISMATCH', 409);
    let parsed: unknown; try { parsed = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw new DeliveryError('INVALID_CURSOR', 409); }
    if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== this.serverEpoch || parsed[2] !== createHash('sha256').update(key).digest('hex') || !Number.isSafeInteger(parsed[1]) || parsed[1] < 0 || parsed[1] > this.head) throw new DeliveryError('CURSOR_CONTEXT_MISMATCH', 409);
    return parsed[1] as number;
  }
  snapshot(input: unknown): TagSnapshot {
    this.check(); const selected = selection(input); this.invalidate();
    const additions = selected.sources.filter(s => !this.watches.has(s.sourceId));
    if (this.watches.size + additions.length > L.globalIdentities) throw new DeliveryError('GLOBAL_IDENTITY_LIMIT', 429);
    // No await between item capture and cursor: all readers and Store notifications are synchronous.
    const items = selected.sources.map(source => this.read(source));
    const boundary = this.head + additions.length;
    if (!Number.isSafeInteger(boundary)) throw new DeliveryError('SEQUENCE_EXHAUSTED', 503);
    const result: TagSnapshot = { protocolVersion: 1, scope: 'TAG_RUNTIME', serverEpoch: this.serverEpoch, selectionKey: selected.key, cursor: this.cursor(selected.key, boundary), capturedAt: new Date().toISOString(), items };
    if (jsonBytes(result) > L.snapshotBytes) throw new DeliveryError('SNAPSHOT_TOO_LARGE', 413);
    for (const item of items) {
      const old = this.watches.get(item.source.sourceId);
      // New coverage must have a fresh boundary. Otherwise an expired watch re-created by
      // another snapshot could incorrectly validate an old cursor across unobserved metadata changes.
      if (!old) this.publish('availability', item);
      this.watches.set(item.source.sourceId, { source: { ...item.source }, signature: this.signature(item), refs: old?.refs ?? 0, until: this.now() + L.journalAgeMs, since: old?.since ?? this.head });
    }
    return result;
  }
  acquire(input: unknown, key: string, cursor: string) {
    const selected = selection(input); if (selected.key !== key) throw new DeliveryError('SELECTION_MISMATCH', 409);
    this.invalidate(); const after = this.decode(cursor, key); this.journal.range(after, 1);
    if (selected.sources.some(s => { const watch = this.watches.get(s.sourceId); return !watch || after < watch.since; })) throw new DeliveryError('SNAPSHOT_LEASE_EXPIRED', 409);
    for (const s of selected.sources) this.watches.get(s.sourceId)!.refs++;
    let released = false;
    return { sources: selected.sources, after, release: () => { if (released) return; released = true; for (const s of selected.sources) { const watch = this.watches.get(s.sourceId); if (watch) { watch.refs--; if (watch.refs === 0) watch.until = this.now() + L.journalAgeMs; } } this.prune(); } };
  }
  range(after: number) { this.check(); return this.journal.range(after); }
  dispose() { if (this.stopped) return; this.stopped = true; this.off(); this.watches.clear(); this.journal.clear(); }
}
