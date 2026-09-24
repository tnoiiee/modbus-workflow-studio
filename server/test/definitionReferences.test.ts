import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { DefinitionCatalog } from '../src/definitionCatalog.js';
import { definitionReferences } from '../src/definitionReferences.js';
import { registerDefinitionRoutes } from '../src/definitionRoutes.js';
import { OverviewPageManager } from '../src/overviewPages.js';
import { definitionIdentity } from '../../client/src/lib/sourceDefinitions.js';
import { createOverviewElement, patchOverviewBinding } from '../../client/src/lib/overviewElements.js';
import { resolveOverviewBinding } from '../../client/src/lib/overviewBinding.js';

const workflowA = '11111111-1111-4111-8111-111111111111';
const workflowB = '22222222-2222-4222-8222-222222222222';
let dir: string, catalog: DefinitionCatalog, pages: OverviewPageManager, server: http.Server, base: string;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-definition-impact-'));
  catalog = new DefinitionCatalog(dir, id => [workflowA, workflowB].includes(id)); pages = new OverviewPageManager(dir);
  const app = express(); app.use(express.json()); registerDefinitionRoutes(app, catalog, identity => definitionReferences(pages, identity));
  server = http.createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-definitions`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(dir, { recursive: true, force: true }); });

describe('O2-A punchlist Definition Delete reference impact', () => {
  it.each(['SHARED_TAG', 'WORKFLOW_VARIABLE'])('%s impact is read-only; Delete preserves saved identity and resolves MISSING', async sourceType => {
    const source = catalog.create({ sourceType, ...(sourceType === 'WORKFLOW_VARIABLE' ? { workflowId: workflowA } : {}), name: 'Source', dataType: 'Boolean', capability: 'MONITOR_ONLY' });
    const identity = definitionIdentity(source), first = pages.create({ name: 'First' }), second = pages.create({ name: 'Second' });
    const element = createOverviewElement('STATUS_LIGHT', { id: 'element', x: 0, y: 0 });
    element.binding = patchOverviewBinding(element.category, element.binding, { source: identity, dataType: 'Boolean' });
    pages.update(first.id, { expectedRevision: 1, elements: [element, { ...element, id: 'another' }] });
    pages.update(second.id, { expectedRevision: 1, elements: [{ ...element, id: 'third' }] });
    const bytes = [first, second].map(p => fs.readFileSync(path.join(dir, 'overview-pages', `${p.id}.json`), 'utf8'));
    const url = source.sourceType === 'SHARED_TAG' ? `${base}/shared-tags/${source.sourceId}` : `${base}/workflow-variables/${source.workflowId}/${source.variableId}`;
    const response = await fetch(`${url}/references`); expect(response.status).toBe(200);
    const impact = await response.json(); expect(impact).toMatchObject({ scope: 'SAVED_OVERVIEW_PAGES', pageCount: 2, bindingCount: 3 });
    expect(impact.references).toHaveLength(3); expect(impact.references[0]).toMatchObject({ pageId: first.id, pageName: 'First', elementId: 'element' });
    // Merely opening/cancelling a confirmation (GET only) does not delete or mutate configuration.
    expect(catalog.get(identity)).toEqual(source);
    expect(resolveOverviewBinding(element, { definitions: catalog.list(), available: true }).status).toBe('BOUND');
    expect((await fetch(url, { method: 'DELETE' })).status).toBe(200);
    expect(resolveOverviewBinding(element, { definitions: catalog.list(), available: true }).status).toBe('MISSING');
    [first, second].forEach((p, index) => expect(fs.readFileSync(path.join(dir, 'overview-pages', `${p.id}.json`), 'utf8')).toBe(bytes[index]));
    expect((await fetch(`${url}/references`)).status).toBe(404);
    expect((await fetch(url, { method: 'DELETE' })).status).toBe(404);
  });
  it('matches complete source identities only, never legacy text, names, navigation targets or another workflow', () => {
    const identity = { sourceType: 'WORKFLOW_VARIABLE' as const, workflowId: workflowA, variableId: workflowB };
    const page = pages.create({ name: 'Isolation' });
    pages.update(page.id, { expectedRevision: 1, elements: [
      { id: 'yes', type: 'TEXT_LABEL', binding: { source: identity, direction: 'NONE' } },
      { id: 'legacy', type: 'TEXT_LABEL', binding: { tagId: workflowB, tagName: workflowA } },
      { id: 'other-workflow', type: 'TEXT_LABEL', binding: { source: { ...identity, workflowId: workflowB } } },
      { id: 'shared', type: 'TEXT_LABEL', binding: { source: { sourceType: 'SHARED_TAG', sourceId: workflowB } } },
      { id: 'navigation', type: 'NAVIGATION_LINK', targetWorkflowId: workflowA },
    ] });
    expect(definitionReferences(pages, identity)).toMatchObject({ pageCount: 1, bindingCount: 1, references: [{ elementId: 'yes' }] });
  });
  it('zero references is explicit and does not invent unsaved Draft references', () => {
    expect(definitionReferences(pages, { sourceType: 'SHARED_TAG', sourceId: workflowA })).toEqual({ scope: 'SAVED_OVERVIEW_PAGES', pageCount: 0, bindingCount: 0, references: [] });
  });
});
