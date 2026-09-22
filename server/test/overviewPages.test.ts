import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  OverviewPageManager,
  overviewCreateSchema,
  overviewRenameSchema,
  overviewUpdateSchema
} from '../src/overviewPages.js';

let dataDir: string;
let manager: OverviewPageManager;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-overview-'));
  manager = new OverviewPageManager(dataDir);
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function codeOf(run: () => unknown): string {
  try {
    run();
    return 'NO_ERROR';
  } catch (error) {
    return (error as { code?: string }).code ?? 'NO_CODE';
  }
}

describe('Overview page store', () => {
  it('seeds exactly one default page at 1920 x 1080', () => {
    const list = manager.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('Main Overview');
    expect(list[0]!.designWidth).toBe(1920);
    expect(list[0]!.designHeight).toBe(1080);
    expect(list[0]!.revision).toBe(1);
    expect(list[0]!.elementCount).toBe(0);
  });

  it('lists pages after create', () => {
    manager.create({ name: 'Line B' });
    const list = manager.list();
    expect(list).toHaveLength(2);
    expect(list.some(page => page.name === 'Line B')).toBe(true);
  });

  it('creates a page with defaults and revision 1', () => {
    const page = manager.create({ name: ' New Page ' });
    expect(page.name).toBe('New Page');
    expect(page.revision).toBe(1);
    expect(page.designWidth).toBe(1920);
    expect(page.designHeight).toBe(1080);
    expect(page.backgroundColor).toBe('#050b12');
    expect(page.elements).toEqual([]);
    expect(page.layerOrder).toEqual([]);
    expect(page.backgroundImage).toBeNull();
  });

  it('rejects duplicate names case-insensitively', () => {
    manager.create({ name: 'Boiler Room' });
    expect(codeOf(() => manager.create({ name: '  boiler room ' }))).toBe('DUPLICATE_NAME');
  });

  it('rejects an empty name', () => {
    expect(codeOf(() => manager.create({ name: '   ' }))).toBe('INVALID_NAME');
  });

  it('gets a page by id', () => {
    const created = manager.create({ name: 'Readback' });
    const fetched = manager.get(created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe('Readback');
    expect(manager.get('not-a-uuid')).toBeUndefined();
  });

  it('renames a page while preserving the id and incrementing revision', () => {
    const created = manager.create({ name: 'Old Name' });
    const renamed = manager.rename(created.id, { name: 'New Name', description: 'Updated' });
    expect(renamed.id).toBe(created.id);
    expect(renamed.name).toBe('New Name');
    expect(renamed.description).toBe('Updated');
    expect(renamed.revision).toBe(created.revision + 1);
  });

  it('rejects renaming onto another page name', () => {
    manager.create({ name: 'Taken' });
    const target = manager.create({ name: 'Mine' });
    expect(codeOf(() => manager.rename(target.id, { name: 'taken' }))).toBe('DUPLICATE_NAME');
  });

  it('duplicates with a new id, fresh revision, and a unique name', () => {
    const source = manager.create({ name: 'Base' });
    const copy = manager.duplicate(source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy.revision).toBe(1);
    expect(copy.name).toBe('Base Copy');
    const second = manager.duplicate(source.id);
    expect(second.name).toBe('Base Copy 2');
  });

  it('duplicates elements with new element ids and remapped layer order', () => {
    const source = manager.create({ name: 'With Elements' });
    manager.update(source.id, {
      expectedRevision: source.revision,
      elements: [
        { id: 'el-1', type: 'RECTANGLE' },
        { id: 'el-2', type: 'SWITCH' }
      ],
      layerOrder: ['el-1', 'el-2']
    });
    const copy = manager.duplicate(source.id);
    expect(copy.elements.map(element => element.id)).toHaveLength(2);
    expect(copy.elements.map(element => element.id)).not.toContain('el-1');
    expect(copy.layerOrder).toHaveLength(2);
    expect(copy.layerOrder).not.toContain('el-1');
    expect(new Set(copy.layerOrder)).toEqual(new Set(copy.elements.map(element => element.id)));
  });

  it('deletes a page and keeps the remainder', () => {
    const extra = manager.create({ name: 'Disposable' });
    const first = manager.first();
    manager.delete(extra.id);
    expect(manager.get(extra.id)).toBeUndefined();
    expect(manager.list().some(page => page.id === first.id)).toBe(true);
  });

  it('rejects deleting the last page', () => {
    const only = manager.first();
    expect(codeOf(() => manager.delete(only.id))).toBe('LAST_PAGE');
    expect(manager.list()).toHaveLength(1);
  });

  it('increments revision on update when the expected revision matches', () => {
    const page = manager.create({ name: 'Save Me' });
    const updated = manager.update(page.id, {
      expectedRevision: page.revision,
      description: 'Draft flush'
    });
    expect(updated.revision).toBe(page.revision + 1);
    expect(updated.description).toBe('Draft flush');
  });

  it('rejects an update when the expected revision is stale', () => {
    const page = manager.create({ name: 'Conflict' });
    manager.update(page.id, { expectedRevision: page.revision, description: 'Winner' });
    expect(
      codeOf(() => manager.update(page.id, { expectedRevision: page.revision, description: 'Loser' }))
    ).toBe('REVISION_CONFLICT');
    expect(manager.get(page.id)?.description).toBe('Winner');
  });

  it('persists pages atomically and reloads from disk', () => {
    const page = manager.create({ name: 'Persisted' });
    const file = path.join(dataDir, 'overview-pages', `${page.id}.json`);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).name).toBe('Persisted');
    const indexFile = path.join(dataDir, 'overview-pages.json');
    expect(fs.existsSync(indexFile)).toBe(true);
    expect(fs.existsSync(`${indexFile}.tmp`)).toBe(false);

    const reloaded = new OverviewPageManager(dataDir);
    expect(reloaded.list().some(item => item.id === page.id)).toBe(true);
    expect(reloaded.list()).toHaveLength(2);
  });

  it('rejects malformed create payloads before touching storage', () => {
    expect(overviewCreateSchema.safeParse({ name: '' }).success).toBe(false);
    expect(overviewCreateSchema.safeParse({}).success).toBe(false);
    expect(overviewCreateSchema.safeParse({ name: 'Ok', designWidth: 0 }).success).toBe(false);
    expect(overviewCreateSchema.safeParse({ name: 'Ok', backgroundColor: 'red' }).success).toBe(false);
    expect(overviewCreateSchema.safeParse({ name: 'Ok', designWidth: 1920, designHeight: 1080 }).success).toBe(true);
  });

  it('rejects malformed rename and update payloads', () => {
    expect(overviewRenameSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(overviewUpdateSchema.safeParse({ name: 'NoRevision' }).success).toBe(false);
    expect(overviewUpdateSchema.safeParse({ expectedRevision: 0 }).success).toBe(false);
    expect(overviewUpdateSchema.safeParse({ expectedRevision: 1, description: 'ok' }).success).toBe(true);
  });

  it('rejects an invalid page id on update and delete', () => {
    expect(codeOf(() => manager.update('nope', { expectedRevision: 1 }))).toBe('INVALID_ID');
    expect(codeOf(() => manager.delete('nope'))).toBe('INVALID_ID');
  });
});

describe('Overview vs Workflow isolation', () => {
  it('never writes overview data into the workflow files', () => {
    manager.create({ name: 'Isolation Check' });
    expect(fs.existsSync(path.join(dataDir, 'workflow.json'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'workflows.json'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'overview-pages.json'))).toBe(true);
  });
});
