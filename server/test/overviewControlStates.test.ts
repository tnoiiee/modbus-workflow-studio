import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewPageManager } from '../src/overviewPages.js';
import { OverviewControlStateStore } from '../src/overviewControlStates.js';
import { registerOverviewControlRoutes } from '../src/overviewControlRoutes.js';

let dir: string;
let pages: OverviewPageManager;
let store: OverviewControlStateStore;
let server: http.Server;
let base: string;
let id: string;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-controls-'));
  pages = new OverviewPageManager(dir);
  store = new OverviewControlStateStore(dir);
  const page = pages.create({ name: 'Controls' });
  id = page.id;
  pages.update(id, { expectedRevision: page.revision, elements: [
    { id: 'switch', category: 'CONTROL', type: 'SWITCH', controlState: { value: true, updatedAt: '2026-09-23T00:00:00.000Z' } },
    { id: 'button', category: 'CONTROL', type: 'PUSH_BUTTON' },
    { id: 'label', category: 'MONITORING', type: 'TEXT_LABEL' },
  ] });
  const app = express();
  app.use(express.json());
  registerOverviewControlRoutes(app, pages, store);
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/overview-control-states`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(dir, { recursive: true, force: true });
});
const patch = (page: string, element: string, body: unknown) => fetch(`${base}/${page}/${element}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
describe('Independent control HTTP contract', () => {
  it('uses read-only legacy fallback then authoritative independent state, without rewriting Page JSON', async () => {
    const file = path.join(dir, 'overview-pages', `${id}.json`);
    const bytes = fs.readFileSync(file, 'utf8');
    const revision = pages.get(id)!.revision;
    expect((await (await fetch(`${base}/${id}`)).json())[0].value).toBe(true);
    expect(fs.existsSync(path.join(dir, 'overview-control-states.json'))).toBe(false);
    const response = await patch(id, 'switch', { value: false });
    expect(response.status).toBe(200);
    const record = await response.json();
    expect(Object.keys(record).sort()).toEqual(['elementId', 'pageId', 'updatedAt', 'value']);
    expect(record.value).toBe(false);
    expect(Number.isNaN(Date.parse(record.updatedAt))).toBe(false);
    expect((await (await fetch(`${base}/${id}`)).json())[0].value).toBe(false);
    expect(pages.get(id)!.revision).toBe(revision);
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes);
    expect(new OverviewControlStateStore(dir).get(id, 'switch')).toEqual(record);
    expect(fs.existsSync(path.join(dir, 'overview-control-states.json.tmp'))).toBe(false);
  });
  it('last write wins across clients without revision conflicts and config save still uses its own revision', async () => {
    const revision = pages.get(id)!.revision;
    expect((await patch(id, 'switch', { value: true })).status).toBe(200);
    expect((await patch(id, 'switch', { value: false })).status).toBe(200);
    expect(store.get(id, 'switch')!.value).toBe(false);
    expect(pages.update(id, { expectedRevision: revision, description: 'Saved' }).revision).toBe(revision + 1);
    expect(() => pages.update(id, { expectedRevision: revision })).toThrow('revision conflict');
    expect(store.get(id, 'switch')!.value).toBe(false);
  });
  it('validates page, element, category, type and boolean payload', async () => {
    expect((await patch('11111111-1111-4111-8111-111111111111', 'switch', { value: true })).status).toBe(404);
    expect((await patch(id, 'missing', { value: true })).status).toBe(404);
    expect((await patch(id, 'label', { value: true })).status).toBe(400);
    expect((await patch(id, 'button', { value: true })).status).toBe(400);
    expect((await patch(id, 'switch', { value: 'true' })).status).toBe(400);
    expect((await patch(id, 'switch', { value: true, expectedRevision: 2 })).status).toBe(400);
  });
  it('does not change confirmed state on disk write failure', async () => {
    await patch(id, 'switch', { value: false });
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('Disk failure'); });
    expect((await patch(id, 'switch', { value: true })).status).toBe(500);
    expect(store.get(id, 'switch')!.value).toBe(false);
  });
  it('isolates identical element ids across pages', async () => {
    const other = pages.create({ name: 'Other' });
    pages.update(other.id, { expectedRevision: other.revision, elements: [{ id: 'switch', category: 'CONTROL', type: 'SWITCH' }] });
    await patch(id, 'switch', { value: true });
    await patch(other.id, 'switch', { value: false });
    expect(store.get(id, 'switch')!.value).toBe(true);
    expect(store.get(other.id, 'switch')!.value).toBe(false);
  });
});
