import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OverviewCanvasProps } from './OverviewCanvas.js';
import { OverviewCanvas } from './OverviewCanvas.js';
import { ElementNode } from './ElementNode.js';
import { createOverviewElement } from '../../lib/overviewElements.js';
import { FontSizeDraftSession, previewOverviewFontSize } from '../../lib/overviewFontDraft.js';

const capture = vi.hoisted(() => ({ flow: {} as any, resize: [] as any[] }));
vi.mock('@xyflow/react', () => ({
  ReactFlow: (props: any) => { capture.flow = props; return null; },
  Background: () => null, Controls: () => null, MiniMap: () => null,
  NodeResizer: (props: any) => { capture.resize.push(props); return null; },
}));
function setup(mode: 'EDIT' | 'VIEW' = 'EDIT') {
  const elements = [createOverviewElement('PUSH_BUTTON', { id: 'A', x: 0, y: 0 }), createOverviewElement('SWITCH', { id: 'B', x: 200, y: 0 })];
  const props: OverviewCanvasProps = { mode, designWidth: 800, designHeight: 600, backgroundColor: '#000', elements,
    selectedElementId: 'A', viewport: { x: 0, y: 0, zoom: 1 }, restoreViewportEpoch: 0,
    onSelectElement: vi.fn(), onMoveElement: vi.fn(), onResizeElement: vi.fn(), onViewportChange: vi.fn(), onInstanceReady: vi.fn() };
  renderToStaticMarkup(<OverviewCanvas {...props} />); return props;
}
describe('dev.4 selected-only drag — real component callbacks, not browser hit-testing', () => {
  it('one A to B node click selects B without an intermediate null or mutation', () => {
    const props = setup(), before = JSON.stringify(props.elements);
    capture.flow.onNodeClick({}, { id: 'B' });
    expect(props.onSelectElement).toHaveBeenCalledTimes(1); expect(props.onSelectElement).toHaveBeenCalledWith('B');
    expect(JSON.stringify(props.elements)).toBe(before); expect(props.onMoveElement).not.toHaveBeenCalled(); expect(props.onResizeElement).not.toHaveBeenCalled();
  });
  it('React Flow select-false for A does not clear B; only pane click deselects', () => {
    const props = setup();
    capture.flow.onNodesChange([{ type: 'select', id: 'A', selected: false }, { type: 'select', id: 'B', selected: true }]);
    expect(props.onSelectElement).not.toHaveBeenCalled();
    capture.flow.onNodeClick({}, { id: 'B' });
    expect(props.onSelectElement).toHaveBeenCalledTimes(1); expect(props.onSelectElement).toHaveBeenLastCalledWith('B');
    capture.flow.onPaneClick(); expect(props.onSelectElement).toHaveBeenLastCalledWith(null);
  });
  it('font input commit followed by B click preserves B selection and does not leak the overlay', () => {
    const props = setup(), session = new FontSizeDraftSession(props.elements[0].style.fontSize);
    session.change('48');
    const preview = previewOverviewFontSize(props.elements, { elementId: 'A', fontSize: 48 }, 'EDIT');
    expect(preview[1]).toBe(props.elements[1]);
    const commit = session.finish(); expect(commit.commit).toBe(48);
    renderToStaticMarkup(<OverviewCanvas {...props} elements={preview} />);
    capture.flow.onNodeClick({}, { id: 'B' }); expect(props.onSelectElement).toHaveBeenCalledWith('B');
    expect(session.finish().commit).toBeUndefined();
  });
  it('rerender uses current selection callback, not stale node data', () => {
    const props = setup(), next = vi.fn(); renderToStaticMarkup(<OverviewCanvas {...props} selectedElementId="B" onSelectElement={next} />);
    capture.flow.onNodeClick({}, { id: 'A' }); expect(next).toHaveBeenCalledWith('A'); expect(props.onSelectElement).not.toHaveBeenCalled();
  });
  it('resize updates never request deselect', () => {
    const props = setup(); capture.flow.onNodesChange([{ type: 'dimensions', id: 'A', dimensions: { width: 180, height: 80 }, resizing: true }]);
    expect(props.onSelectElement).not.toHaveBeenCalled(); expect(props.onMoveElement).not.toHaveBeenCalled();
  });
  it('View ignores node and pane selection', () => {
    const props = setup('VIEW'); capture.flow.onNodeClick({}, { id: 'B' }); capture.flow.onPaneClick();
    expect(props.onSelectElement).not.toHaveBeenCalled(); expect(capture.flow.elementsSelectable).toBe(false);
  });
  it.each(['PUSH_BUTTON', 'SWITCH', 'NAVIGATION_LINK'] as const)('%s child is a non-interactive span in Edit, with resize handles only when selected', type => {
    const element = createOverviewElement(type, { id: 'B', x: 0, y: 0 }); capture.resize = [];
    const html = renderToStaticMarkup(<ElementNode {...({ data: { element, mode: 'EDIT' }, selected: true } as any)} />);
    expect(html).toContain('data-editor-preview="true"'); expect(html).not.toContain('<button'); expect(capture.resize).toHaveLength(1);
  });
  it('selection wiring has no Page mutation/API; overlay badges do not intercept pointers', () => {
    const page = readFileSync(new URL('./OverviewPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('onSelectElement={setSelectedElementId}');
    const canvas = readFileSync(new URL('./OverviewCanvas.tsx', import.meta.url), 'utf8');
    const callbacks = canvas.slice(canvas.indexOf('const handleNodeClick'), canvas.indexOf('return (', canvas.indexOf('const handleNodeClick')));
    expect(callbacks).not.toMatch(/fetch|setDraft|setHistory|revision|stopPropagation|preventDefault/);
    const css = readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.overview-canvas__badges\s*\{[^}]*pointer-events:\s*none/s);
    expect(css).toMatch(/\.overview-element__resolution\s*\{[^}]*pointer-events:\s*none/s);
  });
});

describe('dev.4 selection/geometry boundary', () => {
  it('an initially unselected element is non-draggable and selection echoes cannot enable it', () => {
    const props = setup(); renderToStaticMarkup(<OverviewCanvas {...props} selectedElementId={null} />);
    expect(capture.flow.nodes.every((node: any) => !node.draggable && node.className === 'nopan')).toBe(true);
    capture.flow.onNodesChange([{ type: 'select', id: 'B', selected: true }]);
    expect(props.onSelectElement).not.toHaveBeenCalled();
    expect(capture.flow.nodes.find((node: any) => node.id === 'B').draggable).toBe(false);
  });
  it.each([0.2, 1, 16])('A to B first gesture ignores %s px initial movement and commits no geometry/viewport', delta => {
    const props = setup(); const before = JSON.stringify(props.elements);
    const node = capture.flow.nodes.find((node: any) => node.id === 'B'); expect(node.draggable).toBe(false);
    capture.flow.onNodesChange([{ type: 'position', id: 'B', position: { x: 200 + delta, y: delta }, dragging: true },
      { type: 'position', id: 'B', position: { x: 200 + delta, y: delta }, dragging: false }]);
    capture.flow.onNodeClick({}, node);
    expect(props.onSelectElement).toHaveBeenCalledTimes(1); expect(props.onSelectElement).toHaveBeenCalledWith('B');
    expect(props.onMoveElement).not.toHaveBeenCalled(); expect(props.onResizeElement).not.toHaveBeenCalled();
    expect(props.onViewportChange).not.toHaveBeenCalled(); expect(JSON.stringify(props.elements)).toBe(before);
  });
  it('only selected unlocked elements drag; one gesture emits one final move', () => {
    const props = setup();
    expect(capture.flow.nodes.find((node: any) => node.id === 'A').draggable).toBe(true);
    capture.flow.onNodesChange([{ type: 'position', id: 'A', position: { x: 16, y: 16 }, dragging: true }]);
    capture.flow.onNodesChange([{ type: 'position', id: 'A', position: { x: 32, y: 16 }, dragging: true }]);
    expect(props.onMoveElement).not.toHaveBeenCalled();
    capture.flow.onNodesChange([{ type: 'position', id: 'A', position: { x: 32, y: 16 }, dragging: false }]);
    expect(props.onMoveElement).toHaveBeenCalledTimes(1); expect(props.onMoveElement).toHaveBeenCalledWith('A', 32, 16);
    expect(props.onSelectElement).not.toHaveBeenCalled();
  });
  it('selected locked element cannot drag even through a stale geometry callback', () => {
    const props = setup(); props.elements[0].locked = true; renderToStaticMarkup(<OverviewCanvas {...props} />);
    expect(capture.flow.nodes[0].draggable).toBe(false);
    capture.flow.onNodesChange([{ type: 'position', id: 'A', position: { x: 32, y: 16 }, dragging: false }]);
    expect(props.onMoveElement).not.toHaveBeenCalled();
  });
  it('reselect switches draggability without moving or fitting the viewport', () => {
    const props = setup(); renderToStaticMarkup(<OverviewCanvas {...props} selectedElementId="B" />);
    expect(capture.flow.nodes.map((node: any) => [node.id, node.draggable])).toEqual([['A', false], ['B', true]]);
    expect(capture.flow.fitView).toBeUndefined(); expect(props.onMoveElement).not.toHaveBeenCalled(); expect(props.onViewportChange).not.toHaveBeenCalled();
  });
  it.each(['Enter', ' '])('keyboard %s selects the focused node but ignores child controls', key => {
    const props = setup(); const target = { dataset: { id: 'B' }, closest: () => target }; const preventDefault = vi.fn();
    capture.flow.onKeyDownCapture({ key, target, preventDefault });
    expect(props.onSelectElement).toHaveBeenCalledTimes(1); expect(props.onSelectElement).toHaveBeenCalledWith('B');
    capture.flow.onKeyDownCapture({ key, target: { closest: () => target }, preventDefault });
    expect(props.onSelectElement).toHaveBeenCalledTimes(1);
    capture.flow.onKeyDownCapture({ key: 'ArrowRight', target, preventDefault }); expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
