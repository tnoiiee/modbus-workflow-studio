import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Background, ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

// Real installed Background, not a mocked SVG. This tests SVG URL identity, NOT
// browser pixels, pointer hit-testing or browser refresh/layout timing.
const canvas = readFileSync(new URL('./OverviewCanvas.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const overviewId = canvas.match(/<Background id="([^"]+)"/)?.[1];
function fixture(visited: boolean, overviewActive: boolean, edit: boolean, id?: string) {
  return renderToStaticMarkup(<>
    {visited && <div data-canvas="overview" style={{ display: overviewActive ? 'block' : 'none' }}><ReactFlowProvider>{edit && <Background id={id} gap={16} />}</ReactFlowProvider></div>}
    {!overviewActive && <div data-canvas="workflow"><ReactFlowProvider><Background gap={16} /></ReactFlowProvider></div>}
  </>);
}
const patternIds = (html: string) => [...html.matchAll(/<pattern[^>]*id="([^"]+)"/g)].map(match => match[1]);
const fills = (html: string) => [...html.matchAll(/fill="url\(#([^)]+)\)"/g)].map(match => match[1]);
describe('dev.4 confirmed Background SVG identity collision', () => {
  it('reproduces the dev.3 hidden Overview EDIT → Workflow duplicate pattern target', () => {
    const html = fixture(true, false, true); const ids = patternIds(html);
    expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
    expect(fills(html)).toEqual([ids[0], ids[0]]);
    expect(html).toContain('data-canvas="overview" style="display:none"');
  });
  it('Overview-only ID fix resolves every visible Workflow fill to its own SVG after repeated navigation and fresh mount', () => {
    expect(overviewId).toBe('overview-editor-grid');
    for (let repeat = 0; repeat < 3; repeat++) {
      for (const [visited, active, edit] of [[false, false, false], [true, true, false], [true, true, true], [true, false, true], [true, true, true], [true, false, true], [false, false, false]]) {
        const html = fixture(visited, active, edit, overviewId), ids = patternIds(html);
        expect(new Set(ids).size).toBe(ids.length); expect(fills(html)).toEqual(ids);
        const workflow = html.split('data-canvas="workflow"')[1];
        if (workflow) expect(fills(workflow)).toEqual(patternIds(workflow));
      }
    }
  });
  it('keeps one grid per canvas, existing hide/mount lifecycle and no grid-triggered viewport mutations', () => {
    expect(canvas.match(/<Background\b/g)).toHaveLength(1);
    expect(app).toContain('<Background gap={16}/>');
    expect(app).toContain("page==='Overview'");
    const css = readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\.react-flow__background\s*\{/);
    expect(canvas).not.toMatch(/<ReactFlow[^>]*\sfitView[\s>]/);
  });
});
