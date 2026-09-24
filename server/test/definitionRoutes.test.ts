import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { DefinitionCatalog } from '../src/definitionCatalog.js';
import { registerDefinitionRoutes } from '../src/definitionRoutes.js';
let dir: string, server: http.Server, url: string;
const workflowId = randomUUID();
const input = { sourceType: 'SHARED_TAG', name: 'Temperature', dataType: 'Number', capability: 'MONITOR_ONLY' };
const request = (pathname = '', method = 'GET', body?: unknown) => fetch(url + pathname, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-definition-routes-'));
  const app = express(); app.use(express.json()); registerDefinitionRoutes(app, new DefinitionCatalog(dir, id => id === workflowId));
  server = http.createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-definitions`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(dir, { recursive: true, force: true }); });
describe('O2-A definition HTTP API', () => {
  it.each(['SHARED_TAG', 'WORKFLOW_VARIABLE'])('creates/reads/lists/renames/disables/deletes %s', async sourceType => {
    const created = await request('', 'POST', { ...input, sourceType, ...(sourceType === 'WORKFLOW_VARIABLE' ? { workflowId } : {}) });
    expect(created.status).toBe(201); const source = await created.json();
    const route = sourceType === 'SHARED_TAG' ? `/shared-tags/${source.sourceId}` : `/workflow-variables/${workflowId}/${source.variableId}`;
    expect(await (await request(route)).json()).toEqual(source);
    expect(await (await request()).json()).toHaveLength(1);
    expect((await (await request(route, 'PATCH', { name: 'New', enabled: false })).json())).toMatchObject({ name: 'New', enabled: false });
    expect((await request(route, 'DELETE')).status).toBe(200);
    expect((await request(route)).status).toBe(404);
  });
  it('rejects identity injection and Runtime fields with 400', async () => {
    expect((await request('', 'POST', { ...input, sourceId: randomUUID() })).status).toBe(400);
    const source = await (await request('', 'POST', input)).json();
    expect((await request(`/shared-tags/${source.sourceId}`, 'PATCH', { sourceId: randomUUID() })).status).toBe(400);
    expect((await request(`/shared-tags/${source.sourceId}`, 'PATCH', { value: 1 })).status).toBe(400);
  });
  it('unknown Workflow and deleted definition do not produce fake catalog data', async () => {
    expect((await request('', 'POST', { ...input, sourceType: 'WORKFLOW_VARIABLE', workflowId: randomUUID() })).status).toBe(404);
    expect(await (await request()).json()).toEqual([]);
  });
  it('exposes no command or Runtime route', async () => {
    for (const path of ['/run', '/stop', '/trigger', '/snapshot', '/runtime', '/write']) expect((await request(path, 'POST', {})).status).toBe(404);
  });
});
