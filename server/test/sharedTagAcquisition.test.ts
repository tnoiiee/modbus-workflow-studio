import { encodeValue, type Order } from '../src/codec.js';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedTagAcquisition } from '../src/sharedTagAcquisition.js';
import { TagRuntimeStore } from '../src/tagRuntime.js';
import type { DeviceConnection } from '../src/modbus.js';
import { OverviewPageManager } from '../src/overviewPages.js';
import { resolveOverviewBinding } from '../../client/src/lib/overviewBinding.js';
import { createOverviewElement, patchOverviewBinding } from '../../client/src/lib/overviewElements.js';
import { definitionIdentity } from '../../client/src/lib/sourceDefinitions.js';
import { fixture, readResponse, device } from './acquisitionFixtures.js';
const cleanup: (() => void)[] = [];
afterEach(() => { for (const fn of cleanup.splice(0).reverse()) fn(); vi.useRealTimers(); });
function setup() {
  vi.useFakeTimers();
  const f = fixture(); cleanup.push(f.cleanup);
  const connection = { generation: 1, manual: false, runtime: { actualState: 'connected' }, request: vi.fn(async () => readResponse()), connect: vi.fn(), cancelAcquisitionRequests: vi.fn() };
  const store = new TagRuntimeStore({ wall: () => Date.now(), mono: () => Date.now() });
  const service = new SharedTagAcquisition(f.config, store, () => connection as unknown as DeviceConnection, () => Date.now());
  cleanup.push(() => service.stop()); return { ...f, connection, store, service };
}
const flush = () => vi.advanceTimersByTimeAsync(0);
describe('independent bounded Shared Tag acquisition owner', () => {
  it('polls without Browser or running Workflow; repeated start does not duplicate ownership', async () => {
    const f = setup(), m = f.map(); f.config.put(m); f.service.start(); f.service.start(); await flush();
    expect(f.store.get(m.sourceId)).toMatchObject({ value: 42, quality: 'GOOD' }); expect(f.connection.request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250); expect(f.connection.request.mock.calls.length).toBeGreaterThan(1); expect(f.connection.connect).not.toHaveBeenCalled();
    for (const [request] of f.connection.request.mock.calls as unknown as [{ fc: number; requestClass: string; priority?: boolean; values?: unknown }][]) expect(request).toMatchObject({ fc: 3, requestClass: 'acquisition' });
  });
  it('one in-flight group and no overlapping/pending scan backlog', async () => {
    const f = setup(); let release!: (b: Buffer) => void; f.connection.request.mockImplementation(() => new Promise(resolve => { release = resolve; })); f.config.put(f.map()); f.service.start();
    await vi.advanceTimersByTimeAsync(10000); expect(f.connection.request).toHaveBeenCalledTimes(1); expect(f.service.diagnostics().activeReads).toBe(1);
    release(readResponse()); await flush(); await vi.advanceTimersByTimeAsync(50); expect(f.connection.request).toHaveBeenCalledTimes(1);
  });
  it('deduplicates identical Shared Tag reads but applies scale/offset per identity', async () => {
    const f = setup(), a = f.map(), b = f.map(undefined, { scale: 2, offset: 1 }); f.config.put(a); f.config.put(b); f.service.start(); await flush();
    expect(f.connection.request).toHaveBeenCalledTimes(1); expect(f.store.get(a.sourceId)!.value).toBe(42); expect(f.store.get(b.sourceId)!.value).toBe(85);
  });
  it('does not merge address gaps or different cadences', async () => {
    const f = setup(); f.config.put(f.map()); f.config.put(f.map(undefined, { address: 5 })); f.config.put(f.map(undefined, { pollIntervalMs: 200 })); f.service.start(); await flush(); expect(f.service.diagnostics().groups).toBe(3);
  });
  it('startup disconnected/manual latch never calls connect or enqueues reads', async () => {
    const f = setup(), m = f.map(); f.connection.manual = true; f.connection.runtime.actualState = 'disconnected'; f.config.put(m); f.service.start(); await vi.advanceTimersByTimeAsync(1000);
    expect(f.connection.request).not.toHaveBeenCalled(); expect(f.connection.connect).not.toHaveBeenCalled(); expect(f.store.get(m.sourceId)!.quality).toBe('DISCONNECTED');
  });
  it.each(['success', 'error'])('disconnect fences stale %s and waits for explicit Device reconnect', async outcome => {
    const f = setup(), m = f.map(); let resolve!: (b: Buffer) => void, reject!: (error: Error) => void;
    f.connection.request.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    f.config.put(m); f.service.start(); f.connection.manual = true; f.connection.generation++; f.connection.runtime.actualState = 'disconnected'; f.service.reconcile();
    if (outcome === 'success') resolve(readResponse(99)); else reject(Error('late error')); await flush();
    expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'DISCONNECTED', hasValue: false });
    await vi.advanceTimersByTimeAsync(500); expect(f.connection.request).toHaveBeenCalledTimes(1); expect(f.connection.connect).not.toHaveBeenCalled();
    f.connection.manual = false; f.connection.generation++; f.connection.runtime.actualState = 'connected'; f.service.reconcile(); await vi.advanceTimersByTimeAsync(50);
    expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'GOOD', value: 42 });
  });
  it.each(['success', 'error'])('mapping replacement fences stale %s and clears previous engineering value', async outcome => {
    const f = setup(), m = f.map(); let resolve!: (b: Buffer) => void, reject!: (e: Error) => void;
    f.connection.request.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; })); f.config.put(m); f.service.start();
    f.config.put({ ...m, scale: 2 }); if (outcome === 'success') resolve(readResponse(99)); else reject(Error('obsolete')); await flush();
    expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'UNCERTAIN', hasValue: false }); await vi.advanceTimersByTimeAsync(50); expect(f.store.get(m.sourceId)!.value).toBe(84);
  });
  it.each(['mapping-disable', 'mapping-delete', 'definition-disable', 'definition-delete', 'device-delete', 'type-change'])('%s invalidates runtime and stale completion', async action => {
    const f = setup(), m = f.map(); let release!: (b: Buffer) => void; f.connection.request.mockImplementationOnce(() => new Promise(yes => { release = yes; })); f.config.put(m); f.service.start();
    const id = { sourceType: 'SHARED_TAG' as const, sourceId: m.sourceId };
    if (action === 'mapping-disable') f.config.put({ ...m, enabled: false });
    else if (action === 'mapping-delete') f.config.delete(m.sourceId);
    else if (action === 'definition-disable') f.catalog.update(id, { enabled: false });
    else if (action === 'definition-delete') f.catalog.delete(id);
    else if (action === 'device-delete') f.setDevices([]);
    else f.catalog.update(id, { dataType: 'Boolean' });
    f.service.reconcile(); release(readResponse(99)); await flush(); expect(f.store.get(m.sourceId)).toBeUndefined(); expect(f.service.diagnostics().groups).toBe(0);
  });
  it('revalidates success before lifecycle notification has run', async () => {
    const f = setup(), m = f.map(); let release!: (b: Buffer) => void; f.connection.request.mockImplementationOnce(() => new Promise(yes => { release = yes; })); f.config.put(m); f.service.start();
    f.catalog.delete({ sourceType: 'SHARED_TAG', sourceId: m.sourceId }); release(readResponse(99)); await flush(); expect(f.store.get(m.sourceId)!.hasValue).toBe(false);
  });
  it('read failure and invalid/decode overflow values become BAD; last-good timestamps do not advance', async () => {
    const f = setup(), m = f.map(); f.config.put(m); f.service.start(); await flush(); const good = f.store.get(m.sourceId)!;
    f.connection.request.mockRejectedValueOnce(Error('TIMEOUT')); await vi.advanceTimersByTimeAsync(100); expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'BAD', lastGoodValue: 42, lastGoodReceiveTimestamp: good.lastGoodReceiveTimestamp });
    f.config.put({ ...m, scale: Number.MAX_VALUE }); await vi.advanceTimersByTimeAsync(50); expect(f.store.get(m.sourceId)!.quality).toBe('BAD');
  });
  it('marks elapsed good data STALE while a slow read remains single-flight', async () => {
    const f = setup(), m = f.map(); f.config.put(m); f.service.start(); await flush(); f.connection.request.mockImplementation(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(500); expect(f.store.get(m.sourceId)!.quality).toBe('STALE'); expect(f.connection.request).toHaveBeenCalledTimes(2);
  });
  it.each([1, 2])('FC0%i accepts false instead of no sample', async fc => {
    const f = setup(), d = f.definition('Boolean'), m = f.map(d.sourceId, { functionCode: fc as 1, dataType: 'Boolean' }); f.connection.request.mockResolvedValue(readResponse(0, fc)); f.config.put(m); f.service.start(); await flush(); expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'GOOD', value: false, hasValue: true });
  });
  it.each([
    ['BIG_ENDIAN', 'HIGH_FIRST', 'ABCD'], ['LITTLE_ENDIAN', 'HIGH_FIRST', 'BADC'],
    ['BIG_ENDIAN', 'LOW_FIRST', 'CDAB'], ['LITTLE_ENDIAN', 'LOW_FIRST', 'DCBA'],
  ] as const)('decodes Float64 FC04 %s / %s with per-Tag scale and offset', async (byteOrder, wordOrder, order) => {
    const f = setup(), m = f.map(undefined, { functionCode: 4, dataType: 'Float64', width: 4, byteOrder, wordOrder, scale: 2, offset: 1 });
    const response = Buffer.alloc(17); response.writeUInt16BE(1); response.writeUInt16BE(11, 4); response[6] = 1; response[7] = 4; response[8] = 8;
    encodeValue(12.5, 'Float64', order as Order).forEach((v, i) => response.writeUInt16BE(v, 9 + i * 2));
    f.connection.request.mockResolvedValue(response); f.config.put(m); f.service.start(); await flush();
    expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'GOOD', value: 26, sourceTimestamp: null });
    expect(f.connection.request).toHaveBeenCalledWith(expect.objectContaining({ fc: 4, quantity: 4 }));
  });
  it('rejects non-finite IEEE register payloads', async () => {
    const f = setup(), m = f.map(undefined, { dataType: 'Float32', width: 2 });
    f.connection.request.mockResolvedValue(Buffer.from([0, 1, 0, 0, 0, 7, 1, 3, 4, 0x7f, 0xc0, 0, 0])); f.config.put(m); f.service.start(); await flush();
    expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'BAD', hasValue: false, lastGoodValue: null });
  });
  it('malformed response is BAD rather than a coerced zero', async () => {
    const f = setup(), m = f.map(); f.connection.request.mockResolvedValue(Buffer.alloc(8)); f.config.put(m); f.service.start(); await flush(); expect(f.store.get(m.sourceId)).toMatchObject({ quality: 'BAD', hasValue: false });
  });
  it('global admission bounds outstanding reads across many Devices', async () => {
    const f = setup(), devices = Array.from({ length: 40 }, (_, i) => ({ ...device, id: `d${i}` })); f.setDevices(devices);
    f.connection.request.mockImplementation(() => new Promise(() => {}));
    for (const d of devices) f.config.put(f.map(undefined, { deviceId: d.id })); f.service.start(); await flush(); expect(f.connection.request).toHaveBeenCalledTimes(32); expect(f.service.diagnostics().activeReads).toBe(32);
  });
  it('never persists runtime into Definitions, Overview or a saved Draft; Workflow Variables remain BOUND', async () => {
    const f = setup(), m = f.map(); f.config.put(m); const variable = f.catalog.create({ sourceType: 'WORKFLOW_VARIABLE', workflowId: '11111111-1111-4111-8111-111111111111', name: 'V', dataType: 'Number', capability: 'MONITOR_ONLY' });
    const element = createOverviewElement('NUMERIC_LABEL', { id: 'e', x: 0, y: 0 }); element.binding = patchOverviewBinding(element.category, element.binding, { source: definitionIdentity(variable), dataType: 'Number' });
    const draft = structuredClone(element), pages = new OverviewPageManager(f.dir), page = pages.create({ name: 'Protected' }); pages.update(page.id, { expectedRevision: page.revision, elements: [element] });
    const files = [path.join(f.dir, 'source-definitions.json'), path.join(f.dir, 'overview-pages', `${page.id}.json`), path.join(f.dir, 'shared-tag-acquisition.json')]; const before = files.map(p => fs.readFileSync(p));
    f.service.start(); await vi.advanceTimersByTimeAsync(500); expect(files.map(p => fs.readFileSync(p))).toEqual(before); expect(element).toEqual(draft);
    expect(resolveOverviewBinding(element, { definitions: f.catalog.list(), available: true }).status).toBe('BOUND');
    expect(f.service.diagnostics().tags).toBe(1);
  });
});
