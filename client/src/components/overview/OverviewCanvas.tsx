import { memo, useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Lock, Pencil } from 'lucide-react';

import type { OverviewElement } from '../../lib/overviewElements.js';
import type { OverviewMode } from '../../lib/overviewState.js';
import { ElementNode, type OverviewElementNodeData } from './ElementNode.js';

/** Canvas snap grid — matches the Workflow canvas and the design tokens. */
export const OVERVIEW_SNAP_GRID = 16;

const overviewNodeTypes = { overviewElement: ElementNode };

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export interface OverviewCanvasProps {
  mode: OverviewMode;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
  elements: readonly OverviewElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onMoveElement: (id: string, x: number, y: number) => void;
  onResizeElement: (id: string, width: number, height: number) => void;
  onInstanceReady: (instance: ReactFlowInstance) => void;
}

/**
 * Overview Canvas: React Flow reused as infrastructure only.
 *
 * EDIT mode enables pan, zoom, fit, selection, drag, resize, grid and snap.
 * VIEW mode locks the surface: no controls, no minimap, no pan/zoom, no
 * selection handles. Element geometry lives in the Overview Draft only.
 */
function OverviewCanvasBase({
  mode,
  designWidth,
  designHeight,
  backgroundColor,
  elements,
  selectedElementId,
  onSelectElement,
  onMoveElement,
  onResizeElement,
  onInstanceReady,
}: OverviewCanvasProps) {
  const edit = mode === 'EDIT';

  const nodes = useMemo<Node<OverviewElementNodeData>[]>(
    () =>
      elements.map(element => ({
        id: element.id,
        type: 'overviewElement',
        position: { x: element.x, y: element.y },
        style: { width: element.width, height: element.height, zIndex: element.zIndex },
        selected: edit && element.id === selectedElementId,
        draggable: edit && !element.locked,
        resizable: edit && !element.locked,
        connectable: false,
        data: {
          element,
          mode,
          selected: edit && element.id === selectedElementId,
        },
      })),
    [elements, edit, mode, selectedElementId],
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance<Node<OverviewElementNodeData>>) => {
      onInstanceReady(instance as unknown as ReactFlowInstance);
    },
    [onInstanceReady],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<OverviewElementNodeData>>[]) => {
      if (!edit) return;
      for (const change of changes) {
        if (change.type === 'select') {
          onSelectElement(change.selected ? change.id : null);
        }
        if (change.type === 'position' && change.position && change.dragging === false) {
          onMoveElement(change.id, change.position.x, change.position.y);
        }
        if (change.type === 'dimensions' && change.dimensions) {
          const width = change.dimensions.width;
          const height = change.dimensions.height;
          if (width > 0 && height > 0) {
            onResizeElement(change.id, width, height);
          }
        }
      }
    },
    [edit, onMoveElement, onResizeElement, onSelectElement],
  );

  const handlePaneClick = useCallback(() => {
    if (edit) onSelectElement(null);
  }, [edit, onSelectElement]);

  return (
    <div
      className={`canvas overview-canvas${edit ? '' : ' overview-canvas--locked'}`}
      data-mode={mode}
      style={{ backgroundColor }}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={overviewNodeTypes}
        onNodesChange={handleNodesChange}
        onInit={handleInit}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        snapToGrid={edit}
        snapGrid={[OVERVIEW_SNAP_GRID, OVERVIEW_SNAP_GRID] as [number, number]}
        minZoom={edit ? 0.1 : 1}
        maxZoom={edit ? 2.5 : 1}
        panOnDrag={edit}
        zoomOnScroll={edit}
        zoomOnPinch={edit}
        zoomOnDoubleClick={edit}
        elementsSelectable={edit}
        nodesDraggable={edit}
        nodesConnectable={false}
        nodesFocusable={edit}
        edgesFocusable={false}
        disableKeyboardA11y={!edit}
        deleteKeyCode={null}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: false }}
      >
        {edit ? <Background gap={OVERVIEW_SNAP_GRID} /> : null}
        {edit ? <Controls showInteractive={false} /> : null}
        {edit ? <MiniMap pannable zoomable ariaLabel="Overview canvas minimap" /> : null}
      </ReactFlow>

      <div className="overview-canvas__badges">
        <span className="pill pill--neutral" title="Fixed design resolution">
          {designWidth} × {designHeight}
        </span>
        {edit ? (
          <span className="pill pill--accent">
            <Pencil size={11} aria-hidden="true" /> EDIT · LOCAL DRAFT
          </span>
        ) : (
          <span className="pill pill--neutral">
            <Lock size={11} aria-hidden="true" /> VIEW · READ-ONLY
          </span>
        )}
      </div>
    </div>
  );
}

export const OverviewCanvas = memo(OverviewCanvasBase);

/** Programmatic fit honoring prefers-reduced-motion (duration 0 when reduced). */
export function fitOverviewView(instance: ReactFlowInstance | null): void {
  if (!instance) return;
  instance.fitView({ padding: 0.18, duration: prefersReducedMotion() ? 0 : 280 });
}
