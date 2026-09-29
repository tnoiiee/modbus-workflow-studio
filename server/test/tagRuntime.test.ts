import { describe, expect, it, vi } from 'vitest';
import { TagRuntimeStore, TAG_RUNTIME_LIMITS } from '../src/tagRuntime.js';
const id = '11111111-1111-4111-8111-111111111111', id2 = '22222222-2222-4222-8222-222222222222';
function setup() { let wall = 10000, mono = 0; const store = new TagRuntimeStore({ wall: () => wall, mono: () => mono }); return { store, advance: (n: number) => { wall += n; mono += n; }, wall: (n: number) => { wall = n; } }; }
describe('canonical transport-neutral Tag Runtime Store', () => {
  it('starts UNCERTAIN with explicit NO_SAMPLE and null source/receive times', () => {
    const { store } = setup(); store.activate(id, 'Number'); expect(store.get(id)).toMatchObject({ source: { sourceType: 'SHARED_TAG', sourceId: id }, hasValue: false, value: null, quality: 'UNCERTAIN', reason: 'NO_SAMPLE', sourceTimestamp: null, receiveTimestamp: null, lastGoodReceiveTimestamp: null });
  });
  it.each([['Number', 0], ['Boolean', false]] as const)('preserves %s value %s', (type, value) => {
    const { store } = setup(), token = store.activate(id, type); expect(store.good(token, 1, value)).toBe(true);
    expect(store.get(id)).toMatchObject({ value, hasValue: true, quality: 'GOOD', lastGoodValue: value, sourceTimestamp: null, receiveTimestamp: new Date(10000).toISOString() });
  });
  it('updates receive time and sequence on identical successful values', () => {
    const { store, advance } = setup(), token = store.activate(id, 'Number'); store.good(token, 1, 42); const before = store.get(id)!;
    advance(100); store.good(token, 2, 42); expect(store.get(id)!.sampleSequence).toBeGreaterThan(before.sampleSequence); expect(store.get(id)!.receiveTimestamp).not.toBe(before.receiveTimestamp);
  });
  it('STALE, BAD and DISCONNECTED preserve last-good and receive time', () => {
    const { store, advance } = setup(), token = store.activate(id, 'Number'); store.good(token, 1, 7); const good = store.get(id)!;
    advance(100); store.expire(token, 100); expect(store.get(id)!.quality).toBe('STALE');
    advance(100); store.bad(token, 2, 'TIMEOUT'); expect(store.get(id)!.quality).toBe('BAD');
    advance(100); const next = store.fence(token, 'DISCONNECTED', 'DEVICE_DISCONNECTED')!; store.expire(next, 100);
    expect(store.get(id)).toMatchObject({ quality: 'DISCONNECTED', value: 7, lastGoodValue: 7, receiveTimestamp: good.receiveTimestamp, lastGoodReceiveTimestamp: good.lastGoodReceiveTimestamp });
    expect(store.get(id)!.stateUpdatedAt).not.toBe(good.stateUpdatedAt);
  });
  it('freshness uses monotonic elapsed time rather than Device/server wall-clock jumps', () => {
    const { store, advance, wall } = setup(), token = store.activate(id, 'Number'); store.good(token, 1, 1); wall(-10000000); store.expire(token, 100); expect(store.get(id)!.quality).toBe('GOOD'); advance(100); store.expire(token, 100); expect(store.get(id)!.quality).toBe('STALE');
  });
  it.each([NaN, Infinity, -Infinity, '42', undefined, null])('rejects invalid Number %s as BAD, retaining last good', value => {
    const { store } = setup(), token = store.activate(id, 'Number'); store.good(token, 1, 0); store.good(token, 2, value); expect(store.get(id)).toMatchObject({ quality: 'BAD', reason: 'INVALID_VALUE', lastGoodValue: 0 });
  });
  it('rejects Boolean coercion and old/duplicate input sequences', () => {
    const { store } = setup(), token = store.activate(id, 'Boolean'); store.good(token, 2, false); const good = store.get(id);
    expect(store.good(token, 1, true)).toBe(false); expect(store.bad(token, 2, 'late')).toBe(false); expect(store.good(token, NaN, true)).toBe(false); expect(store.get(id)).toEqual(good);
    store.good(token, 3, 0); expect(store.get(id)!.quality).toBe('BAD');
  });
  it('fences both old success and error after reconnect, removal and reactivation', () => {
    const { store } = setup(), old = store.activate(id, 'Number'); store.good(old, 1, 3);
    const fenced = store.fence(old, 'DISCONNECTED', 'offline')!; expect(store.good(old, 9, 99)).toBe(false); expect(store.bad(old, 10, 'late')).toBe(false);
    const fresh = store.fence(fenced, 'UNCERTAIN', 'recovering')!; store.good(fresh, 1, 7); expect(store.get(id)!.value).toBe(7);
    store.remove(id, 'disabled'); const newMapping = store.activate(id, 'Number'); expect(store.good(fresh, 999, 99)).toBe(false); expect(store.get(id)!.hasValue).toBe(false); store.good(newMapping, 1, 0); expect(store.get(id)!.value).toBe(0);
  });
  it('has bounded scalar text, tag count, payload bytes and observer count', () => {
    const store = new TagRuntimeStore(undefined, { ...TAG_RUNTIME_LIMITS, maxTags: 1, maxSubscribers: 1 }); const token = store.activate(id, 'String');
    store.good(token, 1, 'a'.repeat(1024)); expect(store.get(id)!.quality).toBe('GOOD'); store.good(token, 2, 'a'.repeat(1025)); expect(store.get(id)!.quality).toBe('BAD');
    expect(() => store.activate(id2, 'Number')).toThrow('capacity'); const off = store.subscribe(() => {}); expect(() => store.subscribe(() => {})).toThrow('subscriber'); off();
    store.remove(id, 'deleted'); expect(store.payloadBytes).toBe(0); store.activate(id2, 'Boolean'); expect(store.size).toBe(1);
    const tiny = new TagRuntimeStore(undefined, { ...TAG_RUNTIME_LIMITS, maxBytes: 1 }); expect(() => tiny.activate(id, 'Number')).toThrow('byte limit'); expect(tiny.size).toBe(0);
  });
  it('observers and getters cannot mutate canonical values; exceptions are isolated', () => {
    const { store } = setup(), observer = vi.fn(); store.subscribe(() => { throw Error('adapter failed'); }); const off = store.subscribe(observer);
    const token = store.activate(id, 'Number'); store.good(token, 1, 42); const sample = store.get(id)!; sample.value = 999;
    const event = observer.mock.calls.at(-1)![0]; event.sample.value = 123; expect(store.get(id)!.value).toBe(42); expect(store.observerErrors).toBe(2);
    off(); store.remove(id, 'deleted'); expect(observer).toHaveBeenCalledTimes(2);
  });
  it('emits normalized removal events and unique server epochs without persistence', () => {
    const { store } = setup(), fn = vi.fn(); store.subscribe(fn); store.activate(id, 'Number'); const before = store.get(id)!; store.remove(id, 'MAPPING_CHANGED');
    expect(fn.mock.calls.at(-1)![0]).toMatchObject({ kind: 'removed', source: before.source, serverEpoch: store.serverEpoch, sampleSequence: before.sampleSequence + 1 }); expect(new TagRuntimeStore().serverEpoch).not.toBe(store.serverEpoch);
  });
  it('requires stable identity instead of a name, node ID or address', () => { expect(() => new TagRuntimeStore().activate('node-1', 'Number')).toThrow('UUID'); });
});
