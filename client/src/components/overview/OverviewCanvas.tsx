import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import { Lock, Pencil } from 'lucide-react';

import type { OverviewElement } from '../../lib/overviewElements.js';
import type { OverviewMode } from '../../lib/overviewState.js';
import { ElementNode, type OverviewElementNodeData } from './ElementNode.js';

/** Canvas snap grid — matches the Workflow canvas and the design tokens. */
export const OVERVIEW_SNAP_GRID = 16;

const overviewNodeTypes = { overviewElement: ElementNode };

/** Last Overview viewport kept in session memory (not Local Storage). */
export interface OverviewViewportSnapshot {
  x: number;
  y: number;
  zoom: number;
}

export const OVERVIEW_DEFAULT_VIEWPORT: OverviewViewportSnapshot = { x: 0, y: 0, zoom: 1 };

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
  /** Session viewport restored on show; never auto-fit on return. */
  viewport: OverviewViewportSnapshot;
  onViewportChange: (viewport: OverviewViewportSnapshot) => void;
  /** Becomes true each time the canvas is (re)shown — restore exact viewport. */
  restoreViewportEpoch: number;
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
  viewport,
  onViewportChange,
  restoreViewportEpoch,
  onSelectElement,
  onMoveElement,
  onResizeElement,
  onInstanceReady,
}: OverviewCanvasProps) {
  const edit = mode === 'EDIT';
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  const nodes = useMemo<Node<OverviewElementNodeData>[]>(() => {
    const live = edit ? dragPositions : null;
    return elements.map(element => {
      const livePos = live ? live[element.id] : undefined;
      return {
        id: element.id,
        type: 'overviewElement',
        position: livePos ?? { x: element.x, y: element.y },
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
      };
    });
  }, [dragPositions, elements, edit, mode, selectedElementId]);

  const handleInit = useCallback(
    (instance: ReactFlowInstance<Node<OverviewElementNodeData>>) => {
      instanceRef.current = instance as unknown as ReactFlowInstance;
      onInstanceReady(instance as unknown as ReactFlowInstance);
      // Restore the exact session viewport — never Fit View on init/return.
      instance.setViewport(viewport as Viewport, { duration: 0 });
    },
    // Intentionally only on init: later restores are driven by restoreViewportEpoch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onInstanceReady],
  );

  // Restore the stored viewport whenever the canvas is shown again (panel/page return).
  useEffect(() => {
    if (restoreViewportEpoch === 0) return;
    const instance = instanceRef.current;
    if (!instance) return;
    instance.setViewport(viewport as Viewport, { duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreViewportEpoch]);

  const handleViewportChange = useCallback(
    (next: Viewport) => {
      onViewportChange({ x: next.x, y: next.y, zoom: next.zoom });
    },
    [onViewportChange],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<OverviewElementNodeData>>[]) => {
      if (!edit) return;
      for (const change of changes) {
        if (change.type === 'select') {
          // Select true only — clearing is reserved for Pane click alone so
          // A→B never briefly clears or requires a second click.
          if (change.selected) onSelectElement(change.id);
        }
        if (change.type === 'position' && change.position) {
          if (change.dragging === true) {
            // Live visual feedback while the pointer moves.
            const { x, y } = change.position;
            setDragPositions(prev => ({ ...prev, [change.id]: { x, y } }));
          } else if (change.dragging === false) {
            // Drag stop: one draft commit → one history entry + dirty once.
            const { x, y } = change.position;
            setDragPositions(prev => {
              if (!(change.id in prev)) return prev;
              const next = { ...prev };
              delete next[change.id];
              return next;
            });
            onMoveElement(change.id, x, y);
          }
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

  // Single-click selection: node click is authoritative; pane click alone clears.
  const handleNodeClick = useCallback(
    (_event: unknown, node: Node) => {
      if (edit) onSelectElement(node.id);
    },
    [edit, onSelectElement],
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
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onViewportChange={handleViewportChange}
        defaultViewport={viewport as Viewport}
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
