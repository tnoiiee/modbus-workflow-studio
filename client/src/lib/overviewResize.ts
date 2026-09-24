/**
 * Overview resize gesture — pure single-transaction helpers.
 *
 * Architecture contract (O1-C critical fix):
 * - start: capture original geometry once; no Draft / History / Save
 * - move:  update live geometry only; never Draft / History / API / snap
 * - end:   one complete geometry → one Draft commit → one Undo → dirty once
 * - cancel/unmount: clear transient; restore original visual if no commit
 */

/** Minimum committed size — matches NodeResizer minWidth/minHeight (8). */
export const OVERVIEW_RESIZE_MIN = 8;

export interface ResizeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeSession {
  /** Active Element id while a gesture is open; null when idle. */
  activeId: string | null;
  /** Original geometry captured once at resize start. */
  original: ResizeGeometry | null;
  /** Live geometry for the active Element only (render overlay). */
  live: ResizeGeometry | null;
  /** Move frames rendered during this gesture (development counter). */
  frames: number;
}

export function emptyResizeSession(): ResizeSession {
  return { activeId: null, original: null, live: null, frames: 0 };
}

export function geometryEquals(a: ResizeGeometry | null, b: ResizeGeometry | null): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function cloneGeometry(geometry: ResizeGeometry): ResizeGeometry {
  return { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height };
}

/**
 * Resize start — capture original geometry once for this Element.
 * Re-entrant starts for the same gesture keep the first original.
 */
export function resizeStart(session: ResizeSession, id: string, original: ResizeGeometry): ResizeSession {
  if (session.activeId === id && session.original) {
    return session;
  }
  return {
    activeId: id,
    original: cloneGeometry(original),
    live: cloneGeometry(original),
    frames: 0,
  };
}

/**
 * Resize move — coalesce position + dimensions into live geometry only.
 * Ignores events for a different Element. Unchanged frames return the same
 * session reference so React can bail out of re-render.
 */
export function resizeMove(
  session: ResizeSession,
  id: string,
  next: Partial<ResizeGeometry>,
): ResizeSession {
  if (session.activeId !== id || !session.live) return session;
  const live: ResizeGeometry = {
    x: next.x !== undefined ? next.x : session.live.x,
    y: next.y !== undefined ? next.y : session.live.y,
    width: next.width !== undefined ? next.width : session.live.width,
    height: next.height !== undefined ? next.height : session.live.height,
  };
  if (geometryEquals(live, session.live)) return session;
  return { ...session, live, frames: session.frames + 1 };
}

/** Apply minimum dimensions (no snap — snap is parent commit-time only). */
export function clampResizeGeometry(geometry: ResizeGeometry): ResizeGeometry {
  return {
    x: geometry.x,
    y: geometry.y,
    width: Math.max(OVERVIEW_RESIZE_MIN, geometry.width),
    height: Math.max(OVERVIEW_RESIZE_MIN, geometry.height),
  };
}

/**
 * Resize end — returns one complete geometry or null for a no-op.
 * Always clears the session (no stale active id / live geometry).
 */
export function resizeEnd(
  session: ResizeSession,
  id: string,
  end?: Partial<ResizeGeometry>,
): { session: ResizeSession; commit: ResizeGeometry | null } {
  if (session.activeId !== id || !session.original) {
    return { session: emptyResizeSession(), commit: null };
  }
  const base = session.live ?? session.original;
  const merged: ResizeGeometry = {
    x: end?.x !== undefined ? end.x : base.x,
    y: end?.y !== undefined ? end.y : base.y,
    width: end?.width !== undefined && end.width > 0 ? end.width : base.width,
    height: end?.height !== undefined && end.height > 0 ? end.height : base.height,
  };
  const commit = clampResizeGeometry(merged);
  const cleared = emptyResizeSession();
  // No-op gesture: original equals final — no Draft / History / dirty.
  if (geometryEquals(commit, session.original)) {
    return { session: cleared, commit: null };
  }
  return { session: cleared, commit };
}

/** Resize cancel / unmount — drop transient state without committing. */
export function resizeCancel(session: ResizeSession): ResizeSession {
  return emptyResizeSession();
}

/** Whether the eight NodeResizer handles should render. */
export function resizeHandlesVisible(
  edit: boolean,
  selected: boolean,
  locked: boolean,
): boolean {
  return edit && selected && !locked;
}

export type ResizeHandleId =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Direction contract for the eight handles — opposite edge/corner stays anchored.
 * Used by targeted tests; the live canvas consumes React Flow's final x/y/w/h.
 */
export function projectResizeHandle(
  original: ResizeGeometry,
  handle: ResizeHandleId,
  dx: number,
  dy: number,
): ResizeGeometry {
  const right = original.x + original.width;
  const bottom = original.y + original.height;
  let { x, y, width, height } = original;

  switch (handle) {
    case 'bottom-right':
      width = original.width + dx;
      height = original.height + dy;
      break;
    case 'top-right':
      width = original.width + dx;
      height = original.height - dy;
      y = bottom - height;
      break;
    case 'top-left':
      width = original.width - dx;
      height = original.height - dy;
      x = right - width;
      y = bottom - height;
      break;
    case 'bottom-left':
      width = original.width - dx;
      height = original.height + dy;
      x = right - width;
      break;
    case 'left':
      width = original.width - dx;
      x = right - width;
      break;
    case 'right':
      width = original.width + dx;
      break;
    case 'top':
      height = original.height - dy;
      y = bottom - height;
      break;
    case 'bottom':
      height = original.height + dy;
      break;
  }

  return clampResizeGeometry({ x, y, width, height });
}
