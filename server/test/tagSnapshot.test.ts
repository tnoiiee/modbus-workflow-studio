import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { deliveryFixture } from './tagDeliveryFixtures.js';
import { registerTagSnapshot } from '../src/tagSnapshotRoutes.js';
import { tagOriginPolicy } from '../src/tagDeliveryAdmission.js';
import { selection, snapshotSchema } from '../src/tagDeliveryContract.js';
import { TagDeliveryBroker } from '../src/tagDeliveryBroker.js';
const cleanup: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
function setup() { const f = deliveryFixture(); cleanup.push(f.cleanup); return f; }
describe('B2 REST snapshot', () => {
  it('one/multiple/duplicate/order-independent selection, exact identity and zero/false values', () => {
    const f = setup(), second = f.definition('Boolean'); f.config.put(f.map(second.sourceId, { dataType: 'Boolean', functionCode: 1 }));
    f.store.good(f.store.activate(f.source.sourceId, 'Number'), 1, 0); f.store.good(f.store.activate(second.sourceId, 'Boolean'), 1, false);
    const b = { sourceType: 'SHARED_TAG' as const, sourceId: second.sourceId };
    const first = f.broker.snapshot([f.source, b, f.source]), secondOrder = f.broker.snapshot([b, f.source]);
    expect(first.selectionKey).toBe(secondOrder.selectionKey); expect(first.items).toHaveLength(2); expect(first.items.map(i => i.sample?.value)).toEqual(expect.arrayContaining([0,false]));
    expect(selection([f.source]).key).not.toBe(first.selectionKey); expect(first.scope).toBe('TAG_RUNTIME');
  });
  it.each([[], [{ sourceType: 'WORKFLOW_VARIABLE', workflowId: 'x', variableId: 'y' }], [{ sourceType: 'SHARED_TAG', sourceId: 'name' }], [{ sourceType: 'SHARED_TAG', sourceId: '*', address: 0 }], Array(201).fill({ sourceType: 'SHARED_TAG', sourceId: '11111111-1111-4111-8111-111111111111' })])('rejects invalid selection %j', sources => {
    expect(snapshotSchema.safeParse({ protocolVersion: 1, sources }).success).toBe(false);
  });
  it('returns one item for each missing/unconfigured identity, not a false quality', () => {
    const f = setup(), d = f.definition(), missing = { ...f.source, sourceId: '11111111-1111-4111-8111-111111111111' };
    const reply = f.broker.snapshot([missing, { ...f.source, sourceId: d.sourceId }]);
    expect(reply.items.map(i => i.availability)).toEqual(expect.arrayContaining(['DEFINITION_MISSING','UNCONFIGURED'])); expect(reply.items.every(i => i.sample === null)).toBe(true);
  });
  it.each(['definition', 'mapping', 'device', 'incompatible', 'String', 'COMMAND_ONLY', 'missing-device'] as const)('distinguishes unavailable %s', reason => {
    const f = setup();
    if (reason === 'definition') f.catalog.update(f.source, { enabled: false });
    if (reason === 'mapping') f.config.put({ ...f.mapping, enabled: false });
    if (reason === 'device') f.devices[0].enabled = false;
    if (reason === 'missing-device') f.devices.splice(0);
    if (reason === 'incompatible') f.catalog.update(f.source, { dataType: 'Boolean' });
    if (reason === 'String') f.catalog.update(f.source, { dataType: 'String' });
    if (reason === 'COMMAND_ONLY') f.catalog.update(f.source, { capability: 'COMMAND_ONLY' });
    const statuses = { definition: 'DEFINITION_DISABLED', mapping: 'MAPPING_DISABLED', device: 'DEVICE_DISABLED', incompatible: 'INCOMPATIBLE', String: 'UNSUPPORTED', COMMAND_ONLY: 'UNSUPPORTED', 'missing-device': 'DEVICE_MISSING' };
    expect(f.broker.snapshot([f.source]).items[0]).toMatchObject({ availability: statuses[reason], sample: null });
  });
  it('preserves actual NO_SAMPLE, GOOD, STALE, BAD and DISCONNECTED without rewriting quality', () => {
    const f = setup(), t = f.store.activate(f.source.sourceId, 'Number');
    const item = () => f.broker.snapshot([f.source]).items[0]!;
    expect(item()).toMatchObject({ availability: 'NO_SAMPLE', sample: { hasValue: false, quality: 'UNCERTAIN', reason: 'NO_SAMPLE' } });
    f.store.good(t, 1, 0); expect(item().sample!.quality).toBe('GOOD'); f.store.expire(t, 0); expect(item().sample!.quality).toBe('STALE');
    f.store.bad(t, 2, 'read error'); expect(item().sample!.quality).toBe('BAD'); f.store.fence(t, 'DISCONNECTED', 'DEVICE_DISCONNECTED');
    expect(item()).toMatchObject({ availability: 'DISCONNECTED', sample: { quality: 'DISCONNECTED', lastGoodValue: 0 } });
  });
  it('rejects >512 KiB instead of truncating', () => {
    const f = setup(); const broker = new TagDeliveryBroker(f.store, source => ({ source, availability: 'NO_SAMPLE', sample: null, reason: 'X'.repeat(512 * 1024) })); cleanup.push(() => broker.dispose());
    expect(() => broker.snapshot([f.source])).toThrow('SNAPSHOT_TOO_LARGE');
  });
  it('actual HTTP no-store, body/version/origin/rate bounds; snapshot performs no disk mutation', async () => {
    const f = setup(), app = express(); registerTagSnapshot(app, () => f.broker, tagOriginPolicy({ TAG_ALLOWED_ORIGINS: 'https://trusted.invalid' }));
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening'); cleanup.push(() => new Promise<void>(resolve => server.close(() => resolve())));
    const url = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/tag-runtime/snapshot`;
    const names = fs.readdirSync(f.dir); const before = names.map(n => fs.readFileSync(path.join(f.dir, n)));
    const post = (body: unknown, origin?: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
    const reply = await post({ protocolVersion: 1, sources: [f.source] }); expect(reply.status).toBe(200); expect(reply.headers.get('cache-control')).toBe('no-store');
    expect((await post({ protocolVersion: 9, sources: [f.source] })).status).toBe(400);
    expect((await post({ protocolVersion: 1, sources: [f.source], address: 0 })).status).toBe(400);
    expect((await post({}, 'https://evil.invalid')).status).toBe(403);
    expect((await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://trusted.invalid' } })).status).toBe(204);
    expect((await fetch(url)).status).toBe(405);
    expect((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status).toBe(400);
    expect((await post({ padding: 'x'.repeat(33000) })).status).toBe(413);
    let last = 0; for (let i = 0; i < 25; i++) last = (await post({})).status; expect(last).toBe(429);
    expect(names.map(n => fs.readFileSync(path.join(f.dir, n)))).toEqual(before); expect(f.store.size).toBe(0);
  });
  it('concurrent slow bodies are capped, disconnect frees slots', async () => {
    const f = setup(), app = express(); registerTagSnapshot(app, () => f.broker, tagOriginPolicy({}));
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
    const url = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/tag-runtime/snapshot`;
    const pending: http.ClientRequest[] = []; cleanup.push(() => pending.forEach(q => q.destroy()));
    for (let n = 0; n < 8; n++) { const admitted = once(server, 'request'); const q = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }); q.on('error', () => {}); pending.push(q); q.write('{'); await admitted; }
    const rejected = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolVersion: 1, sources: [f.source] }) });
    expect(rejected.status).toBe(429); expect((await rejected.json()).error).toBe('SNAPSHOT_CONCURRENCY_LIMIT');
    pending.forEach(q => q.destroy()); await new Promise(resolve => setTimeout(resolve, 20));
    const accepted = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolVersion: 1, sources: [f.source] }) }); expect(accepted.status).toBe(200);
  });

  it('slow-body deadline terminates the admitted request without a second response', async () => {
    const f = setup(), app = express(); registerTagSnapshot(app, () => f.broker, tagOriginPolicy({}));
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
    const status = await new Promise<number>((resolve, reject) => {
      const request = http.request(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/tag-runtime/snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode!); });
      request.on('error', reject); cleanup.push(() => request.destroy()); request.write('{');
    }); expect(status).toBe(408);
  }, 10000);

});
