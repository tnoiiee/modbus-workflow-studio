import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefinitionCatalog, sourceIdentitySchema, type SourceIdentity } from '../src/definitionCatalog.js';
import { OverviewPageManager, overviewUpdateSchema } from '../src/overviewPages.js';

let dir: string;
let catalog: DefinitionCatalog;
const workflowA = randomUUID(), workflowB = randomUUID();
let workflows: Set<string>;
const metadata = { name: 'Pump', dataType: 'Boolean', capability: 'MONITOR_ONLY', description: '', unit: '', enabled: true };
const shared = () => catalog.create({ ...metadata, sourceType: 'SHARED_TAG' });
const variable = (workflowId = workflowA) => catalog.create({ ...metadata, sourceType: 'WORKFLOW_VARIABLE', workflowId });
const identity = (value: unknown): SourceIdentity => {
  const record = value as any;
  return sourceIdentitySchema.parse(record.sourceType === 'SHARED_TAG' ? { sourceType: record.sourceType, sourceId: record.sourceId }
    : { sourceType: record.sourceType, workflowId: record.workflowId, variableId: record.variableId });
};
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-definitions-')); workflows = new Set([workflowA, workflowB]); catalog = new DefinitionCatalog(dir, id => workflows.has(id)); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(dir, { force: true, recursive: true }); });

describe('O2-A persisted definition catalog', () => {
  it('generates UUID identities for both source types; duplicate names do not collide', () => {
    const a = shared(), b = shared(), c = variable();
    expect(identity(a)).not.toEqual(identity(b));
    expect(sourceIdentitySchema.safeParse(identity(c)).success).toBe(true);
    expect(catalog.list()).toHaveLength(3);
  });
  it.each(['SHARED_TAG', 'WORKFLOW_VARIABLE'])('renames %s without changing identity', type => {
    const source = type === 'SHARED_TAG' ? shared() : variable();
    const saved = catalog.update(identity(source), { name: 'Renamed', description: 'Metadata', unit: 'bar' });
    expect(identity(saved)).toEqual(identity(source));
    expect(saved).toMatchObject({ name: 'Renamed', description: 'Metadata', unit: 'bar' });
  });
  it('isolates workflow variables even when a caller supplies another workflow ID', () => {
    const a = identity(variable());
    const b = identity(variable(workflowB));
    expect(catalog.get({ ...a, workflowId: workflowB } as SourceIdentity)).toBeUndefined();
    expect(catalog.get(b)).toBeDefined();
  });
  it('isolates shared tags and source types', () => {
    const a = identity(shared());
    const b = identity(shared());
    catalog.update(a, { enabled: false });
    expect(catalog.get(b)?.enabled).toBe(true);
    expect(catalog.get({ sourceType: 'WORKFLOW_VARIABLE', workflowId: workflowA, variableId: (a as { sourceId: string }).sourceId })).toBeUndefined();
  });
  it('supports disable/enable without deletion; UI defaults to disabling', () => {
    const id = identity(shared());
    expect(catalog.update(id, { enabled: false }).enabled).toBe(false);
    expect(catalog.get(id)).toBeDefined();
    expect(catalog.update(id, { enabled: true }).enabled).toBe(true);
  });
  it('persists both catalogs and reloads metadata without any Runtime values', () => {
    const a = identity(shared()); variable(); catalog.update(a, { name: 'Changed', enabled: false });
    const reload = new DefinitionCatalog(dir, id => workflows.has(id));
    expect(reload.list()).toEqual(catalog.list());
    expect(fs.readFileSync(path.join(dir, 'source-definitions.json'), 'utf8')).not.toMatch(/"value"|"quality"|"sequence"/);
  });
  it('hard delete leaves Page binding bytes and revision untouched; old ID stays missing after same-name recreate', () => {
    const source = shared(), id = identity(source);
    const pages = new OverviewPageManager(dir);
    const page = pages.create({ name: 'Test' });
    pages.update(page.id, { expectedRevision: page.revision, elements: [{ id: 'element', type: 'STATUS_LIGHT', binding: { source: id, tagId: '', tagName: '', dataType: 'Boolean', direction: 'MONITOR' } }] });
    const file = path.join(dir, 'overview-pages', `${page.id}.json`), before = fs.readFileSync(file, 'utf8');
    catalog.delete(id); shared();
    expect(catalog.get(id)).toBeUndefined();
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
  it('deleting an owning workflow makes its variables unavailable, never redirects to another workflow', () => {
    const id = identity(variable()); variable(workflowB); shared(); workflows.delete(workflowA);
    expect(catalog.get(id)).toBeUndefined(); expect(catalog.list()).toHaveLength(2);
    expect(() => variable()).toThrow('not found');
  });
  it.each(['sourceId', 'variableId', 'workflowId', 'sourceType'])('rejects immutable identity update: %s', field => {
    expect(() => catalog.update(identity(shared()), { [field]: randomUUID() })).toThrow();
  });
  it.each([{ value: true }, { quality: 'GOOD' }, { dataType: 'Unknown' }, { capability: 'AI' }, { name: ' ' }, { enabled: 'true' }, { sourceId: randomUUID() }])('rejects invalid/Runtime creation fields %j', patch => {
    expect(() => catalog.create({ ...metadata, sourceType: 'SHARED_TAG', ...patch })).toThrow();
    expect(catalog.list()).toHaveLength(0);
  });
  it('validates identities before lookup and refuses malformed persistent data instead of overwriting', () => {
    expect(() => catalog.get({ sourceType: 'SHARED_TAG', sourceId: '../secret' })).toThrow();
    fs.writeFileSync(path.join(dir, 'source-definitions.json'), '{broken');
    expect(() => new DefinitionCatalog(dir, () => true)).toThrow();
  });
  it('failed persistence does not publish an in-memory metadata change', () => {
    const source = shared();
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw Error('disk error'); });
    expect(() => catalog.update(identity(source), { name: 'Lost' })).toThrow('disk error');
    expect(catalog.get(identity(source))?.name).toBe('Pump');
  });
});

describe('O2-A Page persistence boundary', () => {
  const base = () => ({ expectedRevision: 1, elements: [{ id: 'e', type: 'STATUS_LIGHT', binding: { source: identity(shared()), tagId: '', tagName: '', dataType: 'Boolean', direction: 'MONITOR' } }] });
  it('saves stable config and accepts incomplete Draft identity', () => {
    expect(overviewUpdateSchema.safeParse(base()).success).toBe(true);
    const value = base(); value.elements[0]!.binding.source = { sourceType: 'SHARED_TAG', sourceId: '' };
    expect(overviewUpdateSchema.safeParse(value).success).toBe(true);
  });
  it.each([{ status: 'BOUND' }, { value: 12 }, { quality: 'GOOD' }, { sequence: 1 }])('rejects derived/Runtime truth in new binding %j', patch => {
    const value = base(); Object.assign(value.elements[0]!.binding, patch);
    expect(overviewUpdateSchema.safeParse(value).success).toBe(false);
  });
  it('preserves legacy free-text without migration', () => {
    const legacy = { expectedRevision: 1, elements: [{ id: 'e', type: 'STATUS_LIGHT', binding: { tagId: 'old', tagName: 'Pump', dataType: 'Unknown', direction: 'MONITOR', status: 'DRAFT' } }] };
    expect(overviewUpdateSchema.parse(legacy)).toEqual(legacy);
  });
  it('separates navigation identity from source identity', () => {
    expect(overviewUpdateSchema.safeParse({ expectedRevision: 1, elements: [{ id: 'e', type: 'NAVIGATION_LINK', targetWorkflowId: workflowA }] }).success).toBe(true);
    const value = base(); value.elements[0]!.type = 'NAVIGATION_LINK';
    expect(overviewUpdateSchema.safeParse(value).success).toBe(false);
  });
});
