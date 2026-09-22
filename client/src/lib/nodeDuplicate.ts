/**
 * Pure helpers for duplicating a workflow block (v1.2.12 Pass 1).
 *
 * The functions here never call the API, never touch React Flow state, and
 * never persist. The caller pushes one undo snapshot and runs the existing
 * `persist()` path exactly once per duplicate action.
 */

/** Structural shape of a persisted workflow node. */
export interface DuplicateableNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  inputCount: number;
  outputCount: number;
  params: Record<string, unknown>;
}

/** Canvas snap grid used by the workflow editor. */
export const GRID_SIZE = 16;
/** Horizontal offset applied to a duplicate so it never covers the source. */
export const DUPLICATE_OFFSET_X = 48;
/** Vertical offset applied to a duplicate so it never covers the source. */
export const DUPLICATE_OFFSET_Y = 32;
/** Upper bound for deterministic collision nudging. */
export const MAX_COLLISION_STEPS = 64;

/** Rounds a coordinate onto the editor snap grid. */
export function snapToGrid(value: number, grid: number = GRID_SIZE): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / grid) * grid;
}

/**
 * Deterministic unique copy name: `X (copy)`, `X (copy 2)`, `X (copy 3)`, …
 * Compared against every node name in the current workflow.
 */
export function uniqueNodeName(baseName: string, takenNames: Iterable<string>): string {
  const taken = new Set(Array.from(takenNames, (name) => name.trim()));
  const base = baseName.trim() || 'BLOCK';
  let candidate = `${base} (copy)`;
  let suffix = 2;
  while (taken.has(candidate) && suffix <= MAX_COLLISION_STEPS + 1) {
    candidate = `${base} (copy ${suffix})`;
    suffix += 1;
  }
  return candidate;
}

/** True when another node already sits at the exact candidate position. */
export function isPositionOccupied(
  position: { x: number; y: number },
  nodes: ReadonlyArray<DuplicateableNode>,
  ignoreId?: string,
): boolean {
  return nodes.some(
    (node) => node.id !== ignoreId && node.position.x === position.x && node.position.y === position.y,
  );
}

/**
 * Builds the duplicate node: new id, unique name, deep-copied parameters,
 * snapped position offset from the source, and no edges.
 *
 * The source node object is never mutated, and runtime-only values are not
 * part of the input because callers pass the persisted node shape produced by
 * the existing `WNodes()` projection.
 */
export function buildDuplicateNode(
  source: DuplicateableNode,
  nodes: ReadonlyArray<DuplicateableNode>,
  newId: string,
): DuplicateableNode {
  let position = {
    x: snapToGrid(source.position.x + DUPLICATE_OFFSET_X),
    y: snapToGrid(source.position.y + DUPLICATE_OFFSET_Y),
  };
  for (let step = 0; step < MAX_COLLISION_STEPS && isPositionOccupied(position, nodes, source.id); step += 1) {
    position = {
      x: snapToGrid(position.x + DUPLICATE_OFFSET_X),
      y: snapToGrid(position.y + DUPLICATE_OFFSET_Y),
    };
  }

  return {
    id: newId,
    type: source.type,
    name: uniqueNodeName(source.name, nodes.map((node) => node.name)),
    position,
    inputCount: source.inputCount,
    outputCount: source.outputCount,
    params: structuredClone(source.params),
  };
}

export interface DuplicateNodeResult {
  /** The new node, ready to be selected and persisted. */
  node: DuplicateableNode;
  /** Workflow nodes including the duplicate; the source entry is untouched. */
  nextNodes: DuplicateableNode[];
}

/**
 * Appends the duplicate to the node list. Edges are intentionally not copied:
 * port ownership stays with the original connections.
 */
export function duplicateNode(
  source: DuplicateableNode,
  nodes: ReadonlyArray<DuplicateableNode>,
  newId: string,
): DuplicateNodeResult {
  const node = buildDuplicateNode(source, nodes, newId);
  return { node, nextNodes: [...nodes, node] };
}
