import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOverviewControlStates, patchOverviewControlState } from './overviewApi.js';
const pageSrc = readFileSync(join(process.cwd(), 'src/components/overview/OverviewPage.tsx'), 'utf8');
const canvasSrc = readFileSync(join(process.cwd(), 'src/components/overview/OverviewCanvas.tsx'), 'utf8');
const nodeSrc = readFileSync(join(process.cwd(), 'src/components/overview/ElementNode.tsx'), 'utf8');
const controlBlock = pageSrc.slice(pageSrc.indexOf('const handleControlStateChange = useCallback'), pageSrc.indexOf('const handleToggleLibrary'));
afterEach(() => vi.unstubAllGlobals());
describe('Independent control API', () => {
  it('sends one PATCH with boolean only', async () => {
    const record = { pageId: 'p', elementId: 'e', value: true, updatedAt: new Date().toISOString() };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await patchOverviewControlState('p', 'e', true)).toEqual(record);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/api/overview-control-states/p/e');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ value: true });
  });
  it('loads independent records without a page PUT', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await fetchOverviewControlStates('p')).toEqual([]);
    expect(fetch.mock.calls[0][0]).toBe('/api/overview-control-states/p');
  });
  it('propagates failures without retry', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"error":"Unavailable"}', { status: 500 }));
    vi.stubGlobal('fetch', fetch);
    await expect(patchOverviewControlState('p', 'e', false)).rejects.toThrow('Unavailable');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe('Control boundary', () => {
  it('does not mutate configuration or recover page conflicts', () => {
    for (const forbidden of ['setDraft(', 'setBaseline(', 'setActivePage(', 'setPages(', 'setSaveState(', 'setHistory(', 'setSelectedElementId(', 'fetchOverviewPage(', 'result.revision', 'page.revision']) expect(controlBlock).not.toContain(forbidden);
    expect(controlBlock).toContain('setControlStates');
    expect(controlBlock).toContain('setControlError');
  });
  it('isolates page responses and gates concurrent requests and Edit mode', () => {
    expect(controlBlock).toContain('controlPageIdRef.current === pageId');
    expect(controlBlock).toContain('controlInFlightRef.current.has');
    expect(controlBlock).toContain('controlInFlightRef.current.delete');
    expect(controlBlock).toContain("mode === 'EDIT'");
  });
});

describe('OverviewCanvas node reuse must not capture stale control callback', () => {
  it('node cache key includes onControlStateChange identity in VIEW mode', () => {
    expect(canvasSrc).toContain('expectedControl');
    expect(canvasSrc).toContain('previous.data.onControlStateChange === expectedControl');
  });

  it('still reuses nodes for unrelated Elements when callback is unchanged', () => {
    expect(canvasSrc).toContain('return previous');
    expect(canvasSrc).toContain('previous.data.element === element');
  });
});

describe('ElementNode Switch rapid-click guard + optimistic contract', () => {
  it('ignores click while optimistic/in-flight', () => {
    expect(nodeSrc).toContain('if (switchOptimistic !== null) return;');
  });

  it('optimistic clears after response; UI falls back to persisted controlState', () => {
    expect(nodeSrc).toContain('setSwitchOptimistic(null)');
    expect(nodeSrc).toContain('confirmedSwitch');
    expect(nodeSrc).toContain('switchOptimistic ?? confirmedSwitch');
  });

  it('one click path only — single onClick handler, stopPropagation', () => {
    expect(nodeSrc).toContain('event.stopPropagation()');
    const matches = nodeSrc.match(/onClick=\{handlers\.onSwitchClick\}/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe('Regression guards preserved', () => {
  it('previousNodesRef still declared before nodes useMemo (TDZ)', () => {
    const decl = canvasSrc.indexOf('const previousNodesRef = useRef');
    const use = canvasSrc.indexOf('const nodes = useMemo');
    expect(decl).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(use);
  });

  it('resize transaction symbols remain intact', () => {
    expect(canvasSrc).toContain('resizeSessionRef');
    expect(canvasSrc).toContain('resizeStart');
    expect(canvasSrc).toContain('onResizeElement');
    expect(canvasSrc).toContain('liveResizes');
  });
});
