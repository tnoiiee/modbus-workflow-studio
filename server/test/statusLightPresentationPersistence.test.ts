import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OverviewPageManager, overviewUpdateSchema } from '../src/overviewPages.js';
import { createOverviewElement } from '../../client/src/lib/overviewElements.js';
const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })); });
describe('dev.13 presentation metadata uses unchanged Server passthrough persistence', () => {
  it.each([false, true, undefined])('Show Text %s survives Save/load/duplicate without Server changes or legacy migration', showText => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-light-presentation-')); directories.push(dir);
    const manager = new OverviewPageManager(dir), page = manager.first();
    const element = createOverviewElement('STATUS_LIGHT', { id: 'light', x: 64, y: 80 });
    if (showText === undefined) delete element.style.showText; else element.style.showText = showText;
    const viewport = { x: 48, y: 64, zoom: 1.2 };
    const input = overviewUpdateSchema.parse({ expectedRevision: page.revision, elements: [element], layerOrder: ['light'], savedViewport: viewport });
    const updated = manager.update(page.id, input); expect(updated.revision).toBe(page.revision + 1);
    const file = path.join(dir, 'overview-pages', page.id + '.json'), bytes = fs.readFileSync(file, 'utf8');
    const loaded = new OverviewPageManager(dir).get(page.id)!; expect(loaded.elements).toEqual([element]); expect(loaded.savedViewport).toEqual(viewport);
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes); expect(loaded.elements[0]).not.toHaveProperty('controlState');
    const duplicate = manager.duplicate(page.id); expect(duplicate.elements[0]).toEqual({ ...element, id: expect.any(String) });
    expect(duplicate.savedViewport).toEqual(viewport); expect(duplicate.elements[0]!.id).not.toBe(element.id);
  });
});
