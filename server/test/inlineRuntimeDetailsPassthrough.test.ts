import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OverviewPageManager, overviewUpdateSchema } from '../src/overviewPages.js';
import { createOverviewElement } from '../../client/src/lib/overviewElements.js';
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
describe('dev.16 unchanged Server passthrough for showRuntimeDetails', () => {
  it.each([undefined, false, true])('Save/load/duplicate preserves showRuntimeDetails=%s, viewport and legacy absence', value => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-dev16-')); dirs.push(dir);
    const manager = new OverviewPageManager(dir), page = manager.first();
    const element = createOverviewElement('NUMERIC_LABEL', { id: 'e', x: 16, y: 32 }); delete element.style.showRuntimeDetails;
    if (value !== undefined) element.style.showRuntimeDetails = value;
    const input = overviewUpdateSchema.parse({ expectedRevision: page.revision, elements: [element], layerOrder: ['e'], savedViewport: { x: 64, y: 80, zoom: 1.25 } });
    const saved = manager.update(page.id, input); expect(saved.revision).toBe(page.revision + 1);
    const file = path.join(dir, 'overview-pages', page.id + '.json'), bytes = fs.readFileSync(file, 'utf8');
    const reloaded = new OverviewPageManager(dir).get(page.id)!;
    expect(reloaded.elements).toEqual([element]); expect(reloaded.savedViewport).toEqual({ x: 64, y: 80, zoom: 1.25 });
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes);
    if (value === undefined) expect(reloaded.elements[0]!.style).not.toHaveProperty('showRuntimeDetails'); else expect((reloaded.elements[0]!.style as any).showRuntimeDetails).toBe(value);
    const copy = manager.duplicate(page.id); expect(copy.elements[0]).toEqual({ ...element, id: expect.any(String) });
  });
  it('geometry and Binding validation are not affected by the presentation field', () => {
    const element = createOverviewElement('STATUS_LIGHT', { id: 'e', x: 0, y: 0 });
    const on = { ...element, style: { ...element.style, showRuntimeDetails: true } }, off = { ...element, style: { ...element.style, showRuntimeDetails: false } };
    const parse = (e: unknown) => overviewUpdateSchema.parse({ expectedRevision: 1, elements: [e] }).elements![0] as any;
    for (const key of ['x', 'y', 'width', 'height', 'rotation'] as const) expect(parse(on)[key]).toBe(parse(off)[key]);
    on.binding = { tagId: '', tagName: '', dataType: 'Boolean', direction: 'MONITOR', source: { sourceType: 'SHARED_TAG', sourceId: '11111111-1111-4111-8111-111111111111' } } as any;
    expect(overviewUpdateSchema.safeParse({ expectedRevision: 1, elements: [on] }).success).toBe(true);
    (on.binding as any).value = 1; expect(overviewUpdateSchema.safeParse({ expectedRevision: 1, elements: [on] }).success).toBe(false);
  });
});
