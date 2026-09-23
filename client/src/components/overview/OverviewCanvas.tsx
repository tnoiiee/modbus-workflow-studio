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
import {
  emptyResizeSession,
  geometryEquals,
  resizeCancel,
  resizeEnd,
  resizeMove,
  resizeStart,
  type ResizeGeometry,
  type ResizeSession,
} from '../../lib/overviewResize.js';
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

interface LiveGeometry extends ResizeGeometry {}

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
 * Resize transaction (O1-C): live geometry only during the gesture; one
 * Draft commit + one Undo entry at end; cancel/unmount clears transient state.
 * Position events while resizing fold into the live geometry — never Drag.
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
  /** Live geometry for the active resize Element only (render feedback). */
  const [liveResizes, setLiveResizes] = useState<Record<string, LiveGeometry>>({});
  /** Single resize transaction — original captured once; cleared on end/cancel. */
  const resizeSessionRef = useRef<ResizeSession>(emptyResizeSession());
  // True while a NodeResizer gesture is active so position deltas are applied
  // as resize anchors (not drags).
  const resizingRef = useRef(false);
  /** Previous node objects for stable reuse — MUST initialize before useMemo reads it. */
  const previousNodesRef = useRef<Node<OverviewElementNodeData>[]>([]);

  /** Sync pure session → React state without identity churn when unchanged. */
  const syncLiveResizes = useCallback((session: ResizeSession) => {
    resizeSessionRef.current = session;
    if (!session.activeId || !session.live) {
      setLiveResizes(prev => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const activeId = session.activeId;
    const live = session.live;
    setLiveResizes(prev => {
      const existing = prev[activeId];
      const keys = Object.keys(prev);
      if (keys.length === 1 && existing && geometryEquals(existing, live)) return prev;
      const next: Record<string, LiveGeometry> = {};
      if (keys.length !== 1 || !existing) {
        for (const key of keys) {
          if (key !== activeId) next[key] = prev[key];
        }
      }
      next[activeId] = live;
      return next;
    });
  }, []);

  // Unmount / cancel: clear live geometry and active refs; no commit.
  useEffect(() => {
    return () => {
      resizeSessionRef.current = resizeCancel(resizeSessionRef.current);
      resizingRef.current = false;
    };
  }, []);

  // Escape cancels an in-flight resize without committing Draft.
  useEffect(() => {
    if (!edit) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!resizeSessionRef.current.activeId) return;
      resizeSessionRef.current = resizeCancel(resizeSessionRef.current);
      resizingRef.current = false;
      setLiveResizes(prev => (Object.keys(prev).length === 0 ? prev : {}));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edit]);

  const nodes = useMemo<Node<OverviewElementNodeData>[]>(() => {
    // Stable node reuse: during one Element resize only the active node is
    // rebuilt; unrelated Element object references stay the same.
    const previousById = new Map<string, Node<OverviewElementNodeData>>();
    for (const node of previousNodesRef.current) {
      previousById.set(node.id, node);
    }
    const nextNodes: Node<OverviewElementNodeData>[] = elements.map(element => {
      const liveResize = edit ? liveResizes[element.id] : undefined;
      const liveDrag = edit && !liveResize ? dragPositions[element.id] : undefined;
      const selected = edit && element.id === selectedElementId;
      const isActive = Boolean(liveResize || liveDrag);
      // VIEW-mode callback must stay fresh — reusing a node that captured a
      // stale onControlStateChange sends an old revision (409 on next click).
      const expectedControl = edit ? undefined : onControlStateChange;

      if (!isActive) {
        const previous = previousById.get(element.id);
        if (
          previous &&
          previous.data.element === element &&
          previous.selected === selected &&
          previous.data.mode === mode &&
          previous.draggable === (edit && !element.locked) &&
          previous.data.onControlStateChange === expectedControl
        ) {
          return previous;
        }
      }

      const position = liveResize
        ? { x: liveResize.x, y: liveResize.y }
        : liveDrag ?? { x: element.x, y: element.y };
      const width = liveResize ? liveResize.width : element.width;
      const height = liveResize ? liveResize.height : element.height;
      return {
        id: element.id,
        type: 'overviewElement',
        position,
        style: { width, height, zIndex: element.zIndex },
        selected,
        draggable: edit && !element.locked,
        resizable: edit && !element.locked,
        connectable: false,
          data: {
          element: liveResize || liveDrag
            ? { ...element, x: position.x, y: position.y, width, height }
            : element,
          mode,
          selected,
          ...(edit
            ? {}
            : {
                onControlStateChange: expectedControl as
                  | ((id: string, value: boolean) => Promise<unknown>)
                  | undefined,
              }),
        },
      };
    });
    previousNodesRef.current = nextNodes;
    return nextNodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<OverviewElementNodeData>>[]) => {
      if (!edit) return;

      // ---- Pass 1: starts + moves (live geometry only; no Draft / History) ----
      for (const change of changes) {
        if (change.type === 'select') {
          // Select true only — clearing is reserved for Pane click alone.
          if (change.selected) onSelectElement(change.id);
          continue;
        }

        if (change.type === 'dimensions') {
          const width = change.dimensions?.width;
          const height = change.dimensions?.height;
          if (width === undefined || height === undefined || width <= 0 || height <= 0) continue;
          const resizing = 'resizing' in change ? Boolean(change.resizing) : false;
          if (!resizing) continue;

          const element = elements.find(el => el.id === change.id);
          if (!element) continue;

          let session = resizeSessionRef.current;
          if (session.activeId !== change.id || !session.original) {
            // Resize start — capture original geometry once.
            session = resizeStart(session, change.id, {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
            });
          }
          resizingRef.current = true;
          session = resizeMove(session, change.id, { width, height });
          syncLiveResizes(session);
          continue;
        }

        if (change.type === 'position' && change.position) {
          const { x, y } = change.position;
          const session = resizeSessionRef.current;

          if (session.activeId === change.id || resizingRef.current) {
            // Position during Resize is an anchor update — never Drag.
            if (session.activeId === change.id && session.original) {
              syncLiveResizes(resizeMove(session, change.id, { x, y }));
            }
            continue;
          }

          if (change.dragging === true) {
            setDragPositions(prev => {
              const existing = prev[change.id];
              if (existing && existing.x === x && existing.y === y) return prev;
              return { ...prev, [change.id]: { x, y } };
            });
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

      // ---- Pass 2: gesture end — one complete geometry, one commit ----
      for (const change of changes) {
        if (change.type !== 'dimensions') continue;
        if (!('resizing' in change) || change.resizing !== false) continue;

        const session = resizeSessionRef.current;
        if (session.activeId !== change.id) continue;

        const width = change.dimensions?.width;
        const height = change.dimensions?.height;
        const { session: cleared, commit } = resizeEnd(session, change.id, {
          width: width !== undefined && width > 0 ? width : undefined,
          height: height !== undefined && height > 0 ? height : undefined,
        });
        resizeSessionRef.current = cleared;
        resizingRef.current = false;
        syncLiveResizes(cleared);
        // Draft mutation + snap + single Undo happen in the parent, once.
        if (commit) onResizeElement(change.id, commit);
      }
    },
    [edit, elements, onMoveElement, onSelectElement, onResizeElement, syncLiveResizes],
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
