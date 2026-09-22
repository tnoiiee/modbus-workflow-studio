import { memo, useCallback, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Lock, Pencil } from 'lucide-react';

import type { OverviewMode } from '../../lib/overviewState.js';

/** Canvas snap grid — matches the Workflow canvas and the design tokens. */
export const OVERVIEW_SNAP_GRID = 16;

const overviewNodeTypes = {};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export interface OverviewCanvasProps {
  mode: OverviewMode;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
  onInstanceReady: (instance: ReactFlowInstance) => void;
}

/**
 * Overview Canvas: React Flow reused as infrastructure only.
 *
 * Element model is Overview-specific and arrives with O1-C. The surface uses
 * the page's fixed design resolution and background color. EDIT mode enables
 * pan, zoom, fit, selection, drag, grid and snap. VIEW mode locks the canvas
 * into a clean operator-style surface: no controls, no minimap, no pan/zoom.
 */
function OverviewCanvasBase({
  mode,
  designWidth,
  designHeight,
  backgroundColor,
  onInstanceReady,
}: OverviewCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState<Node>([]);
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      instanceRef.current = instance;
      onInstanceReady(instance);
    },
    [onInstanceReady],
  );

  const edit = mode === 'EDIT';

  return (
    <div
      className={`canvas overview-canvas${edit ? '' : ' overview-canvas--locked'}`}
      data-mode={mode}
      style={{ backgroundColor }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={overviewNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={handleInit}
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
