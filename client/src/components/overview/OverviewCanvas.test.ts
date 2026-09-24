import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Runtime TDZ guard — Overview blank-page regression.
 *
 * Owner hit: `ReferenceError: Cannot access 'previousNodesRef' before
 * initialization` when opening Overview because the ref was declared AFTER
 * the useMemo that reads it. These source-contract tests fail if declaration
 * order regresses (component smoke tests need React Flow DOM mocks the
 * current environment does not provide — no new dependencies allowed).
 */

const canvasSource = readFileSync(join(process.cwd(), 'src', 'components', 'overview', 'OverviewCanvas.tsx'), 'utf8');

function componentBody(source: string): string {
  const start = source.indexOf('function OverviewCanvasBase');
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('export const OverviewCanvas');
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

const body = componentBody(canvasSource);

function indexInBody(needle: string): number {
  const index = body.indexOf(needle);
  expect(index, `expected to find ${needle}`).toBeGreaterThan(-1);
  return index;
}

describe('OverviewCanvas declaration-order TDZ contract', () => {
  it('declares previousNodesRef before the useMemo that reads it', () => {
    const declaration = indexInBody('const previousNodesRef = useRef');
    const firstRead = indexInBody('previousNodesRef.current');
    const useMemoStart = indexInBody('const nodes = useMemo');
    expect(declaration).toBeLessThan(useMemoStart);
    expect(declaration).toBeLessThan(firstRead);
  });

  it('declares previousNodesRef exactly once (no duplicate ref)', () => {
    const matches = body.match(/const previousNodesRef = useRef/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('initializes resize transaction refs before first use', () => {
    const resizeSessionDecl = indexInBody('const resizeSessionRef = useRef');
    const resizingDecl = indexInBody('const resizingRef = useRef');
    const syncCallback = indexInBody('const syncLiveResizes = useCallback');
    const resizeSessionFirstUse = indexInBody('resizeSessionRef.current =');
    const nodesUseMemo = indexInBody('const nodes = useMemo');

    expect(resizeSessionDecl).toBeLessThan(syncCallback);
    expect(resizeSessionDecl).toBeLessThan(resizeSessionFirstUse);
    expect(resizingDecl).toBeLessThan(nodesUseMemo);
    // dragPositions state must exist before nodes useMemo reads it.
    const dragPositionsDecl = indexInBody('const [dragPositions, setDragPositions]');
    expect(dragPositionsDecl).toBeLessThan(nodesUseMemo);
    // liveResizes state must exist before nodes useMemo reads it.
    const liveResizesDecl = indexInBody('const [liveResizes, setLiveResizes]');
    expect(liveResizesDecl).toBeLessThan(nodesUseMemo);
  });

  it('every useRef inside OverviewCanvasBase is declared before nodes useMemo', () => {
    const nodesUseMemo = indexInBody('const nodes = useMemo');
    const refPattern = /const\s+(\w+)\s*=\s*useRef/g;
    let match: RegExpExecArray | null;
    const refs: Array<{ name: string; index: number }> = [];
    while ((match = refPattern.exec(body)) !== null) {
      refs.push({ name: match[1], index: match.index });
    }
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(
        ref.index,
        `ref ${ref.name} must be declared before nodes useMemo (TDZ)`,
      ).toBeLessThan(nodesUseMemo);
    }
  });

  it('nodes useMemo body does not read previousNodesRef before any declaration in component', () => {
    // Ensure no earlier use appears above the single declaration line.
    const declaration = indexInBody('const previousNodesRef = useRef');
    const beforeDeclaration = body.slice(0, declaration);
    expect(beforeDeclaration).not.toContain('previousNodesRef');
    // The useMemo (and later callbacks) may read it — those sit after.
    const afterDeclaration = body.slice(declaration + 1);
    expect(afterDeclaration).toContain('previousNodesRef.current');
  });

  it('does not disable node reuse or remove resize transaction behavior', () => {
    expect(body).toContain('previousById');
    expect(body).toContain('resizeSessionRef');
    expect(body).toContain('resizeStart');
    expect(body).toContain('resizeMove');
    expect(body).toContain('resizeEnd');
    expect(body).toContain('onResizeElement');
  });
});
