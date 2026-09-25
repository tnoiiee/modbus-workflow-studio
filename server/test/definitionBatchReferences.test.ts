import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DefinitionCatalog, type SourceIdentity } from '../src/definitionCatalog.js';
import { definitionReferences, definitionReferenceBatch } from '../src/definitionReferences.js';
import { registerDefinitionRoutes } from '../src/definitionRoutes.js';
import { OverviewPageManager } from '../src/overviewPages.js';
import { definitionIdentity } from '../../client/src/lib/sourceDefinitions.js';
import { createOverviewElement, patchOverviewBinding } from '../../client/src/lib/overviewElements.js';

const workflowId = randomUUID();
let dir: string, catalog: DefinitionCatalog, pages: OverviewPageManager, server: http.Server, url: string;
const request = (body: unknown) => fetch(url + '/references/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const create = (sourceType: 'SHARED_TAG' | 'WORKFLOW_VARIABLE' = 'SHARED_TAG') => catalog.create({ sourceType, ...(sourceType === 'WORKFLOW_VARIABLE' ? { workflowId } : {}), name: 'Shared name', dataType: 'Boolean', capability: 'MONITOR_ONLY' });
function element(id: string, source: SourceIdentity, direction: 'MONITOR' | 'COMMAND' | 'NONE' = 'MONITOR') {
  const result = createOverviewElement('STATUS_LIGHT', { id, x: 0, y: 0 });
  result.binding = patchOverviewBinding(result.category, result.binding, { source, dataType: 'Boolean', direction });
  return result;
}
const route = (source: SourceIdentity) => source.sourceType === 'SHARED_TAG' ? `/shared-tags/${source.sourceId}` : `/workflow-variables/${source.workflowId}/${source.variableId}`;
function bytes(directory: string): Record<string, string> {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? Object.entries(bytes(path.join(directory, item.name))).map(([name, value]) => [`${item.name}/${name}`, value])
    : [[item.name, fs.readFileSync(path.join(directory, item.name), 'utf8')]]));
}
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-batch-reference-')); catalog = new DefinitionCatalog(dir, id => id === workflowId); pages = new OverviewPageManager(dir);
  const app = express(); app.use(express.json()); registerDefinitionRoutes(app, catalog, source => definitionReferences(pages, source), sources => definitionReferenceBatch(pages, catalog, sources));
  server = http.createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-definitions`;
});
afterEach(async () => { vi.restoreAllMocks(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(dir, { recursive: true, force: true }); });

describe('dev.5 bounded read-only reference batch HTTP contract', () => {
  it.each(['SHARED_TAG', 'WORKFLOW_VARIABLE'] as const)('one %s uses stable identity and returns explicit zero', async type => {
    const source = definitionIdentity(create(type)); const response = await request({ sources: [source] });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ scope: 'SAVED_OVERVIEW_PAGES', unsavedDraftsIncluded: false,
      results: [{ source, found: true, pageCount: 0, bindingCount: 0 }] });
  });
  it('mixed types/multiple definitions count Elements once and distinct Pages, preserving first-request order', async () => {
    const tag = definitionIdentity(create()), variable = definitionIdentity(create('WORKFLOW_VARIABLE')), zero = definitionIdentity(create());
    const first = pages.create({ name: 'Kiln' }), second = pages.create({ name: 'Pump' });
    pages.update(first.id, { expectedRevision: 1, elements: [element('a', tag), element('b', tag), element('c', variable)] });
    pages.update(second.id, { expectedRevision: 1, elements: [element('d', tag)] });
    const result = await (await request({ sources: [variable, tag, tag, zero, variable] })).json();
    expect(result.results).toEqual([{ source: variable, found: true, pageCount: 1, bindingCount: 1 }, { source: tag, found: true, pageCount: 2, bindingCount: 3 }, { source: zero, found: true, pageCount: 0, bindingCount: 0 }]);
  });
  it('distinguishes a missing definition from existing zero even if saved bindings retain the missing identity', async () => {
    const missing = definitionIdentity(create()), zero = definitionIdentity(create()); const page = pages.create({ name: 'Saved' });
    pages.update(page.id, { expectedRevision: 1, elements: [element('retained', missing)] }); catalog.delete(missing);
    expect((await (await request({ sources: [missing, zero] })).json()).results).toEqual([
      { source: missing, found: false, pageCount: 0, bindingCount: 0 }, { source: zero, found: true, pageCount: 0, bindingCount: 0 }]);
  });
  it('enumerates once and scans each saved Page once for 100 identities, without invoking per-source calculations', async () => {
    const sources = Array.from({ length: 100 }, () => definitionIdentity(create())); pages.create({ name: 'Second' });
    const pageCount = pages.list().length, list = vi.spyOn(pages, 'list'), get = vi.spyOn(pages, 'get');
    const response = await request({ sources }); expect(response.status).toBe(200);
    expect((await response.json()).results).toHaveLength(100); expect(list).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(pageCount);
    expect(new Set(get.mock.calls.map(([id]) => id)).size).toBe(pageCount);
  });
  it('deduplicates 100 identical identities before catalog lookups and scanning', async () => {
    const source = definitionIdentity(create()), get = vi.spyOn(catalog, 'get');
    expect((await (await request({ sources: Array(100).fill(source) })).json()).results).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { sources: [] }, { sources: 'wrong' }, { sources: null }, { sources: [{}] },
    { sources: [{ sourceType: 'OTHER', sourceId: randomUUID() }] }, { sources: [{ sourceType: 'SHARED_TAG', sourceId: 'name-not-id' }] },
    { sources: [{ sourceType: 'WORKFLOW_VARIABLE', workflowId }] },
    { sources: [{ sourceType: 'SHARED_TAG', sourceId: randomUUID(), name: 'injected' }] },
    { sources: [{ sourceType: 'SHARED_TAG', sourceId: randomUUID() }], runtime: true },
    { sources: Array.from({ length: 101 }, () => ({ sourceType: 'SHARED_TAG', sourceId: randomUUID() })) },
  ])('rejects invalid shape/identity/size without scanning: %#', async body => {
    const list = vi.spyOn(pages, 'list'); const response = await request(body); expect(response.status).toBe(400);
    const error = await response.json(); expect(error.error).toContain('1–100'); expect(JSON.stringify(error)).not.toContain(dir); expect(list).not.toHaveBeenCalled();
  });
  it('excludes unsaved Drafts and preserves all page bytes, revision, definitions and bindings', async () => {
    const source = definitionIdentity(create()), page = pages.create({ name: 'Saved only' });
    const unsavedDraft = { ...pages.get(page.id)!, elements: [element('unsaved', source)] }; expect(unsavedDraft.elements).toHaveLength(1);
    const before = bytes(dir), definitions = catalog.list(), revision = pages.get(page.id)!.revision;
    const data = await (await request({ sources: [source] })).json();
    expect(data.unsavedDraftsIncluded).toBe(false); expect(data.results[0].bindingCount).toBe(0);
    expect(bytes(dir)).toEqual(before); expect(pages.get(page.id)!.revision).toBe(revision); expect(catalog.list()).toEqual(definitions);
  });
  it.each(['MONITOR', 'COMMAND', 'NONE'] as const)('individual details retain compatibility and return saved direction %s, without inference', async direction => {
    const source = definitionIdentity(create()), page = pages.create({ name: 'Readable page' });
    // Saved configuration direction is deliberately independent of Source capability.
    const bound = element('saved-element', source); bound.binding.direction = direction;
    pages.update(page.id, { expectedRevision: 1, elements: [bound] });
    const before = bytes(dir), response = await fetch(url + route(source) + '/references');
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ scope: 'SAVED_OVERVIEW_PAGES', pageCount: 1, bindingCount: 1,
      references: [{ pageName: 'Readable page', elementId: 'saved-element', elementType: 'STATUS_LIGHT', direction }] });
    expect(bytes(dir)).toEqual(before);
  });
  it.each([undefined, 'INVALID'])('legacy direction %s stays absent and saved bytes are not rewritten', direction => {
    const source = definitionIdentity(create()), page = pages.create({ name: 'Legacy' });
    const file = path.join(dir, 'overview-pages', `${page.id}.json`), saved = pages.get(page.id)!;
    saved.elements = [{ id: 'legacy', type: 'TEXT_LABEL', binding: { source, ...(direction ? { direction } : {}) } }];
    fs.writeFileSync(file, JSON.stringify(saved)); const loaded = new OverviewPageManager(dir), before = bytes(dir);
    const details = definitionReferences(loaded, source); expect(details.bindingCount).toBe(1); expect(details.references[0]).not.toHaveProperty('direction'); expect(bytes(dir)).toEqual(before);
  });
  it('never matches names, legacy text or other workflows; batch follows the individual stable-identity calculation', () => {
    const source = definitionIdentity(create('WORKFLOW_VARIABLE')); if (source.sourceType !== 'WORKFLOW_VARIABLE') throw Error('fixture');
    const page = pages.create({ name: 'Isolation' });
    const saved = pages.get(page.id)!;
    saved.elements = [{ ...element('yes', source) }, { id: 'legacy', type: 'TEXT_LABEL', binding: { tagId: source.variableId, tagName: 'Shared name' } },
      { id: 'wrong-owner', type: 'TEXT_LABEL', binding: { source: { ...source, workflowId: randomUUID() } } },
      { id: 'navigation', type: 'NAVIGATION_LINK', binding: { source } }];
    // Include historical navigation-shaped data to prove exclusion on read, not validation.
    fs.writeFileSync(path.join(dir, 'overview-pages', `${page.id}.json`), JSON.stringify(saved)); const loaded = new OverviewPageManager(dir);
    expect(definitionReferenceBatch(loaded, catalog, [source]).results[0].bindingCount).toBe(1);
    expect(definitionReferences(loaded, source).bindingCount).toBe(1);
  });
  it('malformed JSON is a clear 400 without internal paths', async () => {
    const response = await fetch(url + '/references/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'Invalid batch reference JSON request' });
  });
  it('does not expose exception paths or secrets when summary loading fails', async () => {
    const source = definitionIdentity(create()); vi.spyOn(pages, 'list').mockImplementation(() => { throw Error(`${dir}/secret`); });
    const response = await request({ sources: [source] }); expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'Unable to load saved reference counts' });
  });
});
