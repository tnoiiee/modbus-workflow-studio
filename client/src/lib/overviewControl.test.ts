import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { overviewApi, patchOverviewElementControlState } from './overviewApi.js';

/**
 * Switch control-state regression (Owner 409 / flash-OFF bug).
 *
 * Root cause chain covered here:
 * 1) success must sync revision into draft + activePage + baseline
 * 2) node reuse must not keep a stale onControlStateChange (old revision → 409)
 * 3) rapid clicks must not fire a second in-flight PATCH
 * 4) real 409 must reconcile authoritative page (including draft), no blind retry
 */

const pageSrc = readFileSync(
  join(process.cwd(), 'src', 'components', 'overview', 'OverviewPage.tsx'),
  'utf8',
);
const canvasSrc = readFileSync(
  join(process.cwd(), 'src', 'components', 'overview', 'OverviewCanvas.tsx'),
  'utf8',
);
const nodeSrc = readFileSync(
  join(process.cwd(), 'src', 'components', 'overview', 'ElementNode.tsx'),
  'utf8',
);

function handleControlBlock(source: string): string {
  const start = source.indexOf('const handleControlStateChange = useCallback');
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('const handleToggleLibrary', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

const controlBlock = handleControlBlock(pageSrc);

describe('Switch control-state request payload', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('PATCH sends expectedRevision + controlState only (no elements array)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          elementId: 'el-1',
          controlState: { value: true, updatedAt: '2026-09-23T00:00:00.000Z' },
          revision: 3,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await patchOverviewElementControlState(
      'page-1',
      'el-1',
      2,
      { value: true, updatedAt: '2026-09-23T00:00:00.000Z' },
    );

    expect(result.revision).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/overview-pages/page-1/elements/el-1/control-state');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.expectedRevision).toBe(2);
    expect(body.controlState).toEqual({
      value: true,
      updatedAt: '2026-09-23T00:00:00.000Z',
    });
    expect(body).not.toHaveProperty('elements');
    expect(body).not.toHaveProperty('value'); // value lives under controlState only
  });

  it('409 response exposes status + currentRevision for conflict handling', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Overview page revision conflict',
          currentRevision: 5,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    await expect(
      patchOverviewElementControlState('page-1', 'el-1', 4, {
        value: true,
        updatedAt: '2026-09-23T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      status: 409,
      currentRevision: 5,
      message: 'Overview page revision conflict',
    });
  });

  it('overviewApi propagates JSON error without swallowing status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'boom', currentRevision: 9 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(overviewApi('/x')).rejects.toMatchObject({ status: 409, currentRevision: 9 });
  });
});

describe('OverviewPage control-state revision synchronization (source contract)', () => {
  it('on success writes result.revision + controlState into activePage, baseline, AND draft', () => {
    expect(controlBlock).toContain('setActivePage(current =>');
    expect(controlBlock).toContain('setBaseline(current =>');
    expect(controlBlock).toContain('setDraft(current =>');
    // All three must assign the Server revision.
    const revisionAssignments = controlBlock.match(/revision: result\.revision/g) ?? [];
    expect(revisionAssignments.length).toBeGreaterThanOrEqual(3);
    expect(controlBlock).toContain('controlState: result.controlState');
    expect(controlBlock).toContain('page.revision');
  });

  it('second click uses synchronized page.revision (no stale expectedRevision path)', () => {
    // Request reads activePage.revision from the callback closure — after success
    // activePage is updated and node data is rebuilt with the new callback.
    expect(controlBlock).toContain('page.revision');
    expect(controlBlock).toMatch(/setActivePage\([\s\S]*revision: result\.revision/);
  });

  it('409 reconciles authoritative page including draft — no blind retry', () => {
    expect(controlBlock).toContain('status === 409');
    expect(controlBlock).toContain('Conflict:');
    expect(controlBlock).toContain('fetchOverviewPage(page.id)');
    expect(controlBlock).toContain('setDraft(fresh)');
    // Must not auto-retry the PATCH after 409.
    expect(controlBlock).not.toMatch(/status === 409[\s\S]{0,400}patchOverviewElementControlState/);
  });

  it('blocks rapid duplicate in-flight PATCH per Element id', () => {
    expect(pageSrc).toContain('controlInFlightRef');
    expect(controlBlock).toContain('controlInFlightRef.current.has(elementId)');
    expect(controlBlock).toContain('controlInFlightRef.current.add(elementId)');
    expect(controlBlock).toContain('controlInFlightRef.current.delete(elementId)');
  });

  it('request is still gated on VIEW mode (EDIT returns without PATCH)', () => {
    expect(controlBlock).toContain("mode === 'EDIT'");
    expect(controlBlock).toContain('Exit Edit Mode to use control preview');
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
    expect(nodeSrc).toContain('persistedSwitch');
    expect(nodeSrc).toContain('switchOptimistic ?? persistedSwitch');
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
