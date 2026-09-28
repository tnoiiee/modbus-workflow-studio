import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliveryFixture } from './tagDeliveryFixtures.js';
import { TagJournal, TagDeliveryBroker } from '../src/tagDeliveryBroker.js';
import { canonicalTagSelection, snapshotReply } from '../../client/src/lib/tagDeliveryProtocol.js';
import { TagRuntimeStore } from '../src/tagRuntime.js';
import { selection } from '../src/tagDeliveryContract.js';
const cleanup: Array<() => void> = []; afterEach(() => cleanup.splice(0).reverse().forEach(fn => fn()));
function setup(journal?: TagJournal, now?: () => number) { const f = deliveryFixture(journal, now); cleanup.push(f.cleanup); return f; }
describe('Tag broker and replay journal', () => {
  it('snapshot handoff replays events then live exactly at the next boundary', () => {
    const f = setup(), t = f.store.activate(f.source.sourceId, 'Number'), snapshot = f.broker.snapshot([f.source]);
    f.store.good(t, 1, 1); const sub = f.broker.acquire([f.source], snapshot.selectionKey, snapshot.cursor);
    const replay = f.broker.range(sub.after); expect(replay).toHaveLength(1); expect(replay[0].item.sample!.value).toBe(1);
    f.store.good(t, 2, 2); const live = f.broker.range(replay[0].deliverySequence); expect(live).toHaveLength(1); expect(live[0].item.sample!.value).toBe(2); sub.release();
  });
  it.each(['age','count','bytes'] as const)('evicts by %s and refuses replay without pinning', mode => {
    let now = 0; const journal = new TagJournal(() => now, { count: mode === 'count' ? 1 : 16384, bytes: mode === 'bytes' ? 1 : 16 * 1024 * 1024, ageMs: 60 });
    const f = setup(journal, () => now), snap = f.broker.snapshot([f.source]), acquired = f.broker.acquire([f.source], snap.selectionKey, snap.cursor);
    const t = f.store.activate(f.source.sourceId, 'Number'); f.store.good(t, 1, 4); if (mode === 'age') now = 61;
    expect(() => f.broker.range(acquired.after)).toThrow('REPLAY_EXPIRED'); expect(journal.bytes).toBeLessThanOrEqual(journal.limits.bytes); expect(journal.count).toBeLessThanOrEqual(journal.limits.count); acquired.release();
  });
  it('cursors reject wrong epoch/selection, future, tampered and malformed values', () => {
    const f = setup(), snap = f.broker.snapshot([f.source]); const other = setup();
    expect(() => other.broker.decode(snap.cursor, snap.selectionKey)).toThrow();
    expect(() => f.broker.decode(snap.cursor, selection([{ ...f.source, sourceId: '11111111-1111-4111-8111-111111111111' }]).key)).toThrow();
    expect(() => f.broker.decode(f.broker.cursor(snap.selectionKey, 999), snap.selectionKey)).toThrow();
    for (const value of ['garbage', snap.cursor + 'x', 'a'.repeat(1025)]) expect(() => f.broker.decode(value, snap.selectionKey)).toThrow();
  });
  it('ordered removal retains sampleSequence; availability changes without samples are journaled', () => {
    const f = setup(), snapshot = f.broker.snapshot([f.source]); f.store.activate(f.source.sourceId, 'Number'); f.store.remove(f.source.sourceId, 'CONFIGURATION_UNAVAILABLE');
    f.config.put({ ...f.mapping, enabled: false }); f.broker.invalidate();
    const events = f.broker.range(f.broker.decode(snapshot.cursor, snapshot.selectionKey));
    expect(events.map(e => e.kind)).toEqual(['updated','removed','availability']); expect(events[1].sampleSequence).toBe(2); expect(events[2].item.availability).toBe('MAPPING_DISABLED');
  });
  it('filtered ranges still include a global boundary and same Store epoch', () => {
    const f = setup(), snapshot = f.broker.snapshot([f.source]);
    f.store.activate('11111111-1111-4111-8111-111111111111', 'Number');
    const events = f.broker.range(f.broker.decode(snapshot.cursor, snapshot.selectionKey)); expect(events).toHaveLength(1); expect(events[0].item.source).not.toEqual(f.source);
    expect(f.broker.serverEpoch).toBe(f.store.serverEpoch);
  });
  it('one observer, cleanup, and connection release keeps a bounded resume lease', () => {
    let now = 0; const f = setup(undefined, () => now), spy = vi.spyOn(f.store, 'subscribe');
    const snap = f.broker.snapshot([f.source]); const a = f.broker.acquire([f.source], snap.selectionKey, snap.cursor); now = 70000; a.release();
    expect(f.broker.identities).toBe(1); expect(() => f.broker.acquire([f.source], snap.selectionKey, snap.cursor).release()).not.toThrow();
    now += 60001; f.broker.prune(); expect(f.broker.identities).toBe(0); expect(spy).not.toHaveBeenCalled(); f.broker.dispose(); expect(() => f.broker.snapshot([f.source])).toThrow('DELIVERY_UNAVAILABLE');
  });
  it('caps active requested identities at 2000 including pending snapshot leases', () => {
    const f = setup(); const ids = Array.from({ length: 2001 }, (_, n) => ({ sourceType: 'SHARED_TAG' as const, sourceId: `${n.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111` }));
    for (let i = 0; i < 2000; i += 200) f.broker.snapshot(ids.slice(i,i+200)); expect(f.broker.identities).toBe(2000); expect(() => f.broker.snapshot([ids[2000]])).toThrow('GLOBAL_IDENTITY_LIMIT');
  });
  it('client/server canonicalization and snapshot DTO stay byte-compatible, including actual Store samples', () => {
    const f = setup(), t = f.store.activate(f.source.sourceId, 'Number'); f.store.good(t, 1, 0);
    const snap = f.broker.snapshot([f.source, f.source]); expect(canonicalTagSelection([f.source]).key).toBe(snap.selectionKey); expect(snapshotReply.parse(snap)).toEqual(snap);
  });
  it('exactly one observer is registered once, released on disposal, never per subscriber', () => {
    const store = new TagRuntimeStore(), subscribe = vi.spyOn(store, 'subscribe');
    const broker = new TagDeliveryBroker(store, source => ({ source, sample: null, reason: 'UNCONFIGURED', availability: 'UNCONFIGURED' })); cleanup.push(() => broker.dispose());
    const source = { sourceType: 'SHARED_TAG' as const, sourceId: '11111111-1111-4111-8111-111111111111' };
    const snap = broker.snapshot([source]); for (let i = 0; i < 4; i++) broker.acquire([source], snap.selectionKey, snap.cursor).release();
    expect(subscribe).toHaveBeenCalledTimes(1); broker.dispose(); store.activate(source.sourceId, 'Number'); expect(broker.journal.count).toBe(0);
  });
  it('expired snapshot lease and metadata-only handoff both require correct continuity', () => {
    let now = 0; const f = setup(undefined, () => now), snap = f.broker.snapshot([f.source]);
    f.config.put({ ...f.mapping, enabled: false }); f.broker.notifyInvalidation();
    const acquired = f.broker.acquire([f.source], snap.selectionKey, snap.cursor); expect(f.broker.range(acquired.after)[0].item.availability).toBe('MAPPING_DISABLED'); acquired.release();
    const latest = f.broker.snapshot([f.source]); now = 60001;
    expect(() => f.broker.acquire([f.source], latest.selectionKey, latest.cursor)).toThrow('SNAPSHOT_LEASE_EXPIRED');
  });
  it('delivery reader failure fences continuity without throwing into the producer or config notification', () => {
    const store = new TagRuntimeStore(), broker = new TagDeliveryBroker(store, () => { throw Error('reader failed'); }); cleanup.push(() => broker.dispose());
    expect(() => store.activate('11111111-1111-4111-8111-111111111111', 'Number')).not.toThrow(); expect(store.observerErrors).toBe(0);
    expect(() => broker.notifyInvalidation()).not.toThrow(); expect(() => broker.range(0)).toThrow('DELIVERY_UNAVAILABLE');
  });

  it('recreated watch cannot legitimize an old cursor after unobserved metadata changes', () => {
    let now = 0; const f = setup(undefined, () => now), old = f.broker.snapshot([f.source]);
    now = 60001; f.broker.prune(); f.config.put({ ...f.mapping, enabled: false }); f.broker.notifyInvalidation();
    const fresh = f.broker.snapshot([f.source]); expect(fresh.cursor).not.toBe(old.cursor);
    expect(() => f.broker.acquire([f.source], old.selectionKey, old.cursor)).toThrow('SNAPSHOT_LEASE_EXPIRED');
    expect(() => f.broker.acquire([f.source], fresh.selectionKey, fresh.cursor).release()).not.toThrow();
  });

});
