import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { acquisitionSchema, AcquisitionConfig, buildPollGroups, ACQUISITION_LIMITS } from '../src/acquisitionConfig.js';
import { registerAcquisitionRoutes } from '../src/acquisitionRoutes.js';
import { device, fixture } from './acquisitionFixtures.js';
const fixtures: ReturnType<typeof fixture>[] = [], servers: Server[] = [];
const setup = () => { const f = fixture(); fixtures.push(f); return f; };
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>(r => s.close(() => r())); } for (const f of fixtures.splice(0)) f.cleanup(); });
describe('Shared Tag acquisition configuration', () => {
  it('persists a separate stable sourceId mapping and reloads without runtime/Definition mutation', () => {
    const f = setup(), m = f.map(), before = fs.readFileSync(path.join(f.dir, 'source-definitions.json'));
    f.config.put(m); expect(new AcquisitionConfig(f.dir, f.catalog, () => [device]).get(m.sourceId)).toEqual(m);
    expect(fs.readFileSync(path.join(f.dir, 'source-definitions.json'))).toEqual(before);
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(f.dir, 'shared-tag-acquisition.json'), 'utf8')))).toEqual(['version', 'mappings']);
  });
  it.each([1, 2, 3, 4])('accepts FC0%i with compatible codec and zero-based address', fc => {
    const f = setup(), d = f.definition(fc <= 2 ? 'Boolean' : 'Number');
    expect(f.config.put(f.map(d.sourceId, { functionCode: fc as 1, dataType: fc <= 2 ? 'Boolean' : 'UInt16' })).address).toBe(0);
  });
  it.each(['UInt16', 'Int16', 'UInt32', 'Int32', 'Float32', 'Float64'] as const)('accepts %s exact codec width', dataType => {
    const f = setup(); const width = dataType === 'Float64' ? 4 : ['Int32', 'UInt32', 'Float32'].includes(dataType) ? 2 : 1;
    expect(f.config.put(f.map(undefined, { dataType, width })).width).toBe(width);
  });
  it.each([
    { address: -1 }, { address: 65536 }, { address: 0.5 }, { address: 65535, dataType: 'Float32', width: 2 },
    { functionCode: 5 }, { functionCode: 6 }, { functionCode: 16 }, { width: 0 }, { width: 2 }, { dataType: 'String' }, { dataType: 'Hex' },
    { dataType: 'Boolean' }, { functionCode: 1 }, { pollIntervalMs: 99 }, { pollIntervalMs: 3600001 },
    { staleAfterMs: 99 }, { pollIntervalMs: 1000, staleAfterMs: 999 }, { staleAfterMs: 86400001 },
    { scale: NaN }, { scale: Infinity }, { offset: -Infinity }, { unitId: -1 }, { unitId: 256 },
    { byteOrder: 'UNKNOWN' }, { wordOrder: 'UNKNOWN' }, { sourceId: 'name-not-id' }, { runtime: 3 }, { value: 2 },
  ])('rejects invalid bounds/codec/fields %j', patch => { const f = setup(); expect(() => f.config.put({ ...f.map(), ...patch })).toThrow(); });
  it('requires unscaled Boolean codec', () => {
    const f = setup(), d = f.definition('Boolean'); expect(() => f.config.put(f.map(d.sourceId, { dataType: 'Boolean', functionCode: 1, scale: 2 }))).toThrow('Boolean');
  });
  it('requires existing SHARED_TAG Definition and Device, not variable or node identity', () => {
    const f = setup(), m = f.map(); const v = f.catalog.create({ sourceType: 'WORKFLOW_VARIABLE', workflowId: '11111111-1111-4111-8111-111111111111', name: 'V', dataType: 'Number', capability: 'MONITOR_ONLY' });
    expect(() => f.config.put({ ...m, sourceId: v.sourceType === 'WORKFLOW_VARIABLE' ? v.variableId : '' })).toThrow('SHARED_TAG');
    expect(() => f.config.put({ ...m, deviceId: 'missing' })).toThrow('Device');
    f.catalog.delete({ sourceType: 'SHARED_TAG', sourceId: m.sourceId }); expect(() => f.config.put(m)).toThrow('definition');
  });
  it.each([{ dataType: 'String' }, { dataType: 'Boolean' }, { capability: 'COMMAND_ONLY' }])('rejects incompatible Definition %j', patch => {
    const f = setup(), d = f.definition('Number', patch); expect(() => f.config.put(f.map(d.sourceId))).toThrow('incompatible');
  });
  it('enable/disable and orphan status remain separate from Definition resolution on reload', () => {
    const f = setup(), m = f.map(); f.config.put({ ...m, enabled: false }); expect(f.config.availability(f.config.get(m.sourceId)!)).toBe('DISABLED');
    f.config.put(m); expect(f.config.availability(m)).toBe('READY');
    f.setDevices([]); expect(f.config.availability(m)).toBe('MISSING_DEVICE');
    const reload = new AcquisitionConfig(f.dir, f.catalog, () => []); expect(reload.get(m.sourceId)).toEqual(m);
    f.catalog.delete({ sourceType: 'SHARED_TAG', sourceId: m.sourceId }); expect(f.config.availability(m)).toBe('MISSING_DEFINITION');
    f.config.delete(m.sourceId); expect(f.config.list()).toEqual([]);
  });
  it('internally deduplicates identical compatible reads without arbitrary gaps or undeclared Device block sizes', () => {
    const f = setup(), m = f.map(), maps = [m, { ...m, sourceId: f.definition().sourceId }, { ...m, address: 1 }, { ...m, address: 20 }, { ...m, unitId: 2 }, { ...m, pollIntervalMs: 200 }, { ...m, byteOrder: 'LITTLE_ENDIAN' as const }];
    const groups = buildPollGroups(maps); expect(groups).toHaveLength(6); expect(groups[0]!.mappings).toHaveLength(2); expect(groups.every(g => g.width === 1)).toBe(true);
  });
  it('bounds groups per Device before persistence', () => {
    const f = setup(); for (let i = 0; i < ACQUISITION_LIMITS.maxGroupsPerDevice; i++) f.config.put(f.map(undefined, { address: i }));
    expect(() => f.config.put(f.map(undefined, { address: 129 }))).toThrow('groups'); expect(f.config.list()).toHaveLength(128);
  });
  it('bounds total mappings on reload and rejects duplicate identities', () => {
    const f = setup(), m = f.map(); const file = path.join(f.dir, 'shared-tag-acquisition.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, mappings: Array(2001).fill(m) })); expect(() => new AcquisitionConfig(f.dir, f.catalog, () => [device])).toThrow();
    fs.writeFileSync(file, JSON.stringify({ version: 1, mappings: [m, m] })); expect(() => new AcquisitionConfig(f.dir, f.catalog, () => [device])).toThrow('Duplicate');
  });
  it('accepts boundary intervals and finite zero scale/offset', () => {
    const f = setup(); expect(acquisitionSchema.parse(f.map(undefined, { pollIntervalMs: 3600000, staleAfterMs: 86400000, scale: 0, offset: 0 })).scale).toBe(0);
  });
});
describe('configuration-only HTTP API', () => {
  it('CRUD validates stable identity; no Runtime snapshot endpoint or sample fields', async () => {
    const f = setup(), app = express(); app.use(express.json()); registerAcquisitionRoutes(app, f.config);
    const server = app.listen(0, '127.0.0.1'); servers.push(server); await new Promise<void>(r => server.once('listening', r));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`, m = f.map(), url = `${base}/api/shared-tag-acquisition/${m.sourceId}`;
    const initial = await (await fetch(url)).json(); expect(initial).toEqual({ mapping: null, availability: 'UNCONFIGURED' });
    const put = (data: unknown) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    expect((await put({ ...m, sourceId: f.definition().sourceId })).status).toBe(400);
    expect((await put({ ...m, dataType: 'ASCII' })).status).toBe(400);
    expect((await put(m)).status).toBe(200);
    expect(await (await fetch(url)).json()).toEqual({ mapping: m, availability: 'READY' });
    expect(await (await fetch(`${base}/api/shared-tag-acquisition`)).json()).toEqual([{ mapping: m, availability: 'READY' }]);
    expect((await fetch(`${base}/api/tag-runtime/snapshot`, { method: 'POST' })).status).toBe(404);
    expect((await fetch(url, { method: 'DELETE' })).status).toBe(200); expect(f.catalog.get({ sourceType: 'SHARED_TAG', sourceId: m.sourceId })).toBeDefined();
  });
});
