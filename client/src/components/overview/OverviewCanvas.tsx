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

interface LiveGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  /** Becomes non-zero each time the canvas is (re)shown — restore exact viewport. */
  restoreViewportEpoch: number;
  onSelectElement: (id: string | null) => void;
  onMoveElement: (id: string, x: number, y: number) => void;
  /** Full resize result: position + dimensions (top/left handles must move x/y). */
  onResizeElement: (id: string, geometry: { x: number; y: number; width: number; height: number }) => void;
  onInstanceReady: (instance: ReactFlowInstance) => void;
  /** VIEW-mode control preview persistence (dedicated PATCH). */
  onControlStateChange?: (
    id: string,
    value: boolean,
  ) => Promise<{ ok: true } | { ok: false; conflict: boolean; message: string }>;
}

/**
 * Overview Canvas: React Flow reused as infrastructure only.
 *
 * EDIT mode enables pan, zoom, fit, selection, drag, resize, grid and snap.
 * VIEW mode locks the surface: no controls, no minimap, no pan/zoom, no
 * selection handles. Element geometry lives in the Overview Draft only.
 *
 * Overview Elements are HMI components — no source/target Handles, no edges.
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
  onControlStateChange,
}: OverviewCanvasProps) {
  const edit = mode === 'EDIT';
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [liveResizes, setLiveResizes] = useState<Record<string, LiveGeometry>>({});
  // True while a NodeResizer gesture is active so position deltas are applied
  // as resize anchors (not drags).
  const resizingRef = useRef(false);

  const nodes = useMemo<Node<OverviewElementNodeData>[]>(() => {
    return elements.map(element => {
      const liveResize = edit ? liveResizes[element.id] : undefined;
      const liveDrag = edit && !liveResize ? dragPositions[element.id] : undefined;
      const position = liveResize
        ? { x: liveResize.x, y: liveResize.y }
        : liveDrag ?? { x: element.x, y: element.y };
      const size = liveResize
        ? { width: liveResize.width, height: liveResize.height }
        : { width: element.width, height: element.height };
      return {
        id: element.id,
        type: 'overviewElement',
        position,
        style: { width: size.width, height: size.height, zIndex: element.zIndex },
        selected: edit && element.id === selectedElementId,
        draggable: edit && !element.locked,
        resizable: edit && !element.locked,
        connectable: false,
        data: {
          element: liveResize || liveDrag
            ? { ...element, x: position.x, y: position.y, width: size.width, height: size.height }
            : element,
          mode,
          selected: edit && element.id === selectedElementId,
          ...(edit
            ? {}
            : {
                onControlStateChange: onControlStateChange as
                  | ((id: string, value: boolean) => Promise<unknown>)
                  | undefined,
              }),
        },
      };
    });
  }, [dragPositions, liveResizes, elements, edit, mode, selectedElementId, onControlStateChange]);

  const handleInit = useCallback(
    (instance: ReactFlowInstance<Node<OverviewElementNodeData>>) => {
      instanceRef.current = instance as unknown as ReactFlowInstance;
      onInstanceReady(instance as unknown as ReactFlowInstance);
      // Restore the exact session viewport — never Fit View on init/return.
      instance.setViewport(viewport as Viewport, { duration: 0 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onInstanceReady],
  );

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

  const commitResize = useCallback(
    (id: string, geometry: LiveGeometry) => {
      setLiveResizes(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (geometry.width > 0 && geometry.height > 0) {
        onResizeElement(id, geometry);
      }
    },
    [onResizeElement],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<OverviewElementNodeData>>[]) => {
      if (!edit) return;

      // Batch pass: detect resize gestures (dimensions with resizing flag).
      let sawResize = false;
      for (const change of changes) {
        if (change.type === 'dimensions' && 'resizing' in change && change.resizing) {
          sawResize = true;
        }
      }
      if (sawResize) resizingRef.current = true;

      for (const change of changes) {
        if (change.type === 'select') {
          // Select true only — clearing is reserved for Pane click alone.
          if (change.selected) onSelectElement(change.id);
        }

        if (change.type === 'dimensions' && change.dimensions) {
          const width = change.dimensions.width;
          const height = change.dimensions.height;
          if (width <= 0 || height <= 0) continue;
          const resizing = 'resizing' in change ? Boolean(change.resizing) : resizingRef.current;
          const element = elements.find(el => el.id === change.id);
          if (!element) continue;

          if (resizing) {
            resizingRef.current = true;
            setLiveResizes(prev => {
              const base = prev[change.id] ?? { x: element.x, y: element.y, width: element.width, height: element.height };
              return { ...prev, [change.id]: { ...base, width, height } };
            });
          } else if (!resizingRef.current) {
            // Non-resize dimension sync (e.g. external) — ignore without history.
            continue;
          }
        }

        if (change.type === 'position' && change.position) {
          const { x, y } = change.position;

          if (resizingRef.current) {
            // Top/left resize moves the opposite-anchored origin: apply x/y too.
            setLiveResizes(prev => {
              const element = elements.find(el => el.id === change.id);
              const base = element
                ? prev[change.id] ?? {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height,
                  }
                : prev[change.id];
              if (!base) return prev;
              return { ...prev, [change.id]: { ...base, x, y } };
            });
            if (change.dragging === false) {
              // End of gesture handled when dimensions report resizing:false.
            }
            continue;
          }

          if (change.dragging === true) {
            setDragPositions(prev => ({ ...prev, [change.id]: { x, y } }));
          } else if (change.dragging === false) {
            setDragPositions(prev => {
              if (!(change.id in prev)) return prev;
              const next = { ...prev };
              delete next[change.id];
              return next;
            });
            onMoveElement(change.id, x, y);
          }
        }
      }

      // Commit resize when the batch ends the gesture.
      for (const change of changes) {
        if (change.type === 'dimensions' && 'resizing' in change && change.resizing === false) {
          const element = elements.find(el => el.id === change.id);
          if (!element) continue;
          const width = change.dimensions?.width ?? element.width;
          const height = change.dimensions?.height ?? element.height;
          // Pull latest live geometry (may include position from same batch).
          setLiveResizes(prev => {
            const live = prev[change.id];
            const geometry = live
              ? { ...live, width: width > 0 ? width : live.width, height: height > 0 ? height : live.height }
              : { x: element.x, y: element.y, width, height };
            // Defer state clear to commitResize after this updater.
            queueMicrotask(() => commitResize(change.id, geometry));
            return prev;
          });
          resizingRef.current = false;
        }
      }
    },
    [edit, elements, onMoveElement, onSelectElement, commitResize],
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
