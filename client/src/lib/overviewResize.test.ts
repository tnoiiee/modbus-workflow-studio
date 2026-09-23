import { describe, expect, it } from 'vitest';

import {
  OVERVIEW_RESIZE_MIN,
  clampResizeGeometry,
  emptyResizeSession,
  geometryEquals,
  projectResizeHandle,
  resizeCancel,
  resizeEnd,
  resizeHandlesVisible,
  resizeMove,
  resizeStart,
  type ResizeGeometry,
} from './overviewResize.js';

const original: ResizeGeometry = { x: 10, y: 20, width: 100, height: 50 };

function elementLike() {
  return { id: 'el-1', ...original } as const;
}

describe('resize transaction — start / move / end / cancel', () => {
  it('resize start captures original geometry once', () => {
    const first = resizeStart(emptyResizeSession(), 'el-1', original);
    expect(first.activeId).toBe('el-1');
    expect(first.original).toEqual(original);
    expect(first.live).toEqual(original);
    expect(first.frames).toBe(0);
    // Second start for the same gesture must not recapture.
    const again = resizeStart(first, 'el-1', { x: 99, y: 99, width: 1, height: 1 });
    expect(again.original).toEqual(original);
    expect(again).toBe(first);
  });

  it('resize move updates live geometry only (session, not Draft)', () => {
    const start = resizeStart(emptyResizeSession(), 'el-1', original);
    const moved = resizeMove(start, 'el-1', { width: 140, height: 80 });
    expect(moved.live).toEqual({ x: 10, y: 20, width: 140, height: 80 });
    expect(moved.original).toEqual(original);
    expect(moved.frames).toBe(1);
    // Original never mutates on move.
    expect(original).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('resize move does not mutate Draft or add History (pure session only)', () => {
    // Simulate parent: Draft + History untouched until commit.
    const draft = { elements: [{ id: 'el-1', ...original }] };
    const history: unknown[] = [];
    let session = resizeStart(emptyResizeSession(), 'el-1', original);
    for (let i = 1; i <= 40; i += 1) {
      session = resizeMove(session, 'el-1', { width: 100 + i, height: 50 + i, x: 10, y: 20 });
    }
    expect(session.frames).toBe(40);
    expect(draft.elements[0]).toEqual({ id: 'el-1', ...original });
    expect(history).toHaveLength(0);
  });

  it('repeated resize move with identical geometry does not grow frames (no re-render loop)', () => {
    const start = resizeStart(emptyResizeSession(), 'el-1', original);
    const a = resizeMove(start, 'el-1', { width: 120 });
    const b = resizeMove(a, 'el-1', { width: 120 });
    expect(a.frames).toBe(1);
    expect(b).toBe(a); // same reference → React bail-out
    expect(b.frames).toBe(1);
  });

  it('position and dimensions commit together as one geometry', () => {
    let session = resizeStart(emptyResizeSession(), 'el-1', original);
    session = resizeMove(session, 'el-1', { x: 4, y: 8, width: 130, height: 70 });
    const { commit } = resizeEnd(session, 'el-1');
    expect(commit).toEqual({ x: 4, y: 8, width: 130, height: 70 });
  });

  it('resize end commits once and clears transient session', () => {
    let session = resizeStart(emptyResizeSession(), 'el-1', original);
    session = resizeMove(session, 'el-1', { width: 200 });
    const { session: cleared, commit } = resizeEnd(session, 'el-1');
    expect(commit).not.toBeNull();
    expect(cleared.activeId).toBeNull();
    expect(cleared.original).toBeNull();
    expect(cleared.live).toBeNull();
    // End again must not produce a second commit.
    const second = resizeEnd(cleared, 'el-1');
    expect(second.commit).toBeNull();
    expect(second.session.activeId).toBeNull();
  });

  it('no-op resize creates no commit (Draft / History / dirty stay clean)', () => {
    const draftElements = [{ id: 'el-1', ...original }];
    const history: unknown[] = [];
    let dirty = false;
    let commits = 0;

    let session = resizeStart(emptyResizeSession(), 'el-1', original);
    // User grabs handle and releases without moving far enough to change geometry.
    const { session: cleared, commit } = resizeEnd(session, 'el-1', {
      x: original.x,
      y: original.y,
      width: original.width,
      height: original.height,
    });
    if (commit) {
      commits += 1;
      history.push(draftElements);
      dirty = true;
    }
    expect(commit).toBeNull();
    expect(commits).toBe(0);
    expect(history).toHaveLength(0);
    expect(dirty).toBe(false);
    expect(cleared.activeId).toBeNull();

    // Move + exact restore also no-ops.
    session = resizeStart(emptyResizeSession(), 'el-1', original);
    session = resizeMove(session, 'el-1', { width: 150 });
    session = resizeMove(session, 'el-1', { width: original.width });
    const restored = resizeEnd(session, 'el-1');
    expect(restored.commit).toBeNull();
  });

  it('resize cancel clears transient state without commit', () => {
    let session = resizeStart(emptyResizeSession(), 'el-1', original);
    session = resizeMove(session, 'el-1', { width: 300, height: 300 });
    const cancelled = resizeCancel(session);
    expect(cancelled.activeId).toBeNull();
    expect(cancelled.live).toBeNull();
    expect(cancelled.original).toBeNull();
    expect(resizeEnd(cancelled, 'el-1').commit).toBeNull();
  });

  it('resize unmount clears transient state (empty session is clean)', () => {
    const session = resizeStart(emptyResizeSession(), 'el-1', original);
    const unmounted = resizeCancel(session);
    expect(unmounted).toEqual(emptyResizeSession());
  });

  it('position change during resize is folded into live geometry, not a separate Drag path', () => {
    let session = resizeStart(emptyResizeSession(), 'el-1', original);
    // RF emits position + dimensions in one batch while resizing.
    session = resizeMove(session, 'el-1', { x: 6, y: 14 });
    session = resizeMove(session, 'el-1', { width: 180, height: 90 });
    expect(session.live).toEqual({ x: 6, y: 14, width: 180, height: 90 });
    const { commit } = resizeEnd(session, 'el-1');
    expect(commit).toEqual({ x: 6, y: 14, width: 180, height: 90 });
  });

  it('move/end for a different Element id does not touch the active session', () => {
    const session = resizeStart(emptyResizeSession(), 'el-1', original);
    const other = resizeMove(session, 'el-2', { width: 999 });
    expect(other).toBe(session);
    expect(resizeEnd(session, 'el-2').commit).toBeNull();
  });

  it('development counters: many move frames → one commit', () => {
    let session = resizeStart(emptyResizeSession(), elementLike().id, original);
    let commits = 0;
    let historyEntries = 0;
    let dirtyTransitions = 0;

    for (let frame = 1; frame <= 120; frame += 1) {
      session = resizeMove(session, 'el-1', {
        width: original.width + frame,
        height: original.height + frame,
      });
    }
    const end = resizeEnd(session, 'el-1');
    if (end.commit) {
      commits += 1;
      historyEntries += 1;
      dirtyTransitions += 1;
    }
    expect(session.frames).toBe(120);
    expect(commits).toBe(1);
    expect(historyEntries).toBe(1);
    expect(dirtyTransitions).toBe(1);
  });
});

describe('resize direction contract (eight handles)', () => {
  it('bottom-right: x/y unchanged, width/height change', () => {
    const g = projectResizeHandle(original, 'bottom-right', 30, 20);
    expect(g.x).toBe(original.x);
    expect(g.y).toBe(original.y);
    expect(g.width).toBe(original.width + 30);
    expect(g.height).toBe(original.height + 20);
  });

  it('top-right: x unchanged, y changes, bottom edge anchored', () => {
    const g = projectResizeHandle(original, 'top-right', 30, -15);
    expect(g.x).toBe(original.x);
    expect(g.width).toBe(original.width + 30);
    expect(g.y + g.height).toBe(original.y + original.height);
  });

  it('top-left: x/y change, bottom-right remains anchored', () => {
    const g = projectResizeHandle(original, 'top-left', -20, -10);
    expect(g.x + g.width).toBe(original.x + original.width);
    expect(g.y + g.height).toBe(original.y + original.height);
    expect(g.width).toBe(original.width + 20);
    expect(g.height).toBe(original.height + 10);
  });

  it('bottom-left: x changes, y unchanged, top-right remains anchored', () => {
    const g = projectResizeHandle(original, 'bottom-left', -25, 40);
    expect(g.y).toBe(original.y);
    expect(g.x + g.width).toBe(original.x + original.width);
    expect(g.width).toBe(original.width + 25);
    expect(g.height).toBe(original.height + 40);
  });

  it('left: x and width change, right edge anchored', () => {
    const g = projectResizeHandle(original, 'left', -40, 0);
    expect(g.x + g.width).toBe(original.x + original.width);
    expect(g.width).toBe(original.width + 40);
    expect(g.y).toBe(original.y);
    expect(g.height).toBe(original.height);
  });

  it('right: width changes only', () => {
    const g = projectResizeHandle(original, 'right', 50, 0);
    expect(g.x).toBe(original.x);
    expect(g.y).toBe(original.y);
    expect(g.width).toBe(original.width + 50);
    expect(g.height).toBe(original.height);
  });

  it('top: y and height change, bottom edge anchored', () => {
    const g = projectResizeHandle(original, 'top', 0, -30);
    expect(g.y + g.height).toBe(original.y + original.height);
    expect(g.height).toBe(original.height + 30);
    expect(g.x).toBe(original.x);
    expect(g.width).toBe(original.width);
  });

  it('bottom: height changes only', () => {
    const g = projectResizeHandle(original, 'bottom', 0, 35);
    expect(g.x).toBe(original.x);
    expect(g.y).toBe(original.y);
    expect(g.width).toBe(original.width);
    expect(g.height).toBe(original.height + 35);
  });

  it('projected geometry never drops below minimum dimensions', () => {
    const g = projectResizeHandle(original, 'bottom-right', -1000, -1000);
    expect(g.width).toBe(OVERVIEW_RESIZE_MIN);
    expect(g.height).toBe(OVERVIEW_RESIZE_MIN);
    expect(clampResizeGeometry({ x: 0, y: 0, width: 1, height: 1 })).toEqual({
      x: 0,
      y: 0,
      width: OVERVIEW_RESIZE_MIN,
      height: OVERVIEW_RESIZE_MIN,
    });
  });
});

describe('resize handle visibility contract', () => {
  it('locked Element has no handles', () => {
    expect(resizeHandlesVisible(true, true, true)).toBe(false);
    expect(resizeHandlesVisible(true, false, true)).toBe(false);
  });

  it('View Mode has no handles', () => {
    expect(resizeHandlesVisible(false, true, false)).toBe(false);
    expect(resizeHandlesVisible(false, false, false)).toBe(false);
  });

  it('EDIT + selected + unlocked shows handles; unselected hides them', () => {
    expect(resizeHandlesVisible(true, true, false)).toBe(true);
    expect(resizeHandlesVisible(true, false, false)).toBe(false);
  });
});

describe('geometry helpers', () => {
  it('geometryEquals compares all fields', () => {
    expect(geometryEquals(original, { ...original })).toBe(true);
    expect(geometryEquals(original, { ...original, x: 0 })).toBe(false);
    expect(geometryEquals(null, null)).toBe(true);
    expect(geometryEquals(original, null)).toBe(false);
  });

  it('session after start/move/end never leaks active id across gestures', () => {
    let session = resizeStart(emptyResizeSession(), 'el-1', original);
    session = resizeMove(session, 'el-1', { width: 160 });
    session = resizeEnd(session, 'el-1').session;
    expect(session.activeId).toBeNull();
    session = resizeStart(session, 'el-2', { x: 0, y: 0, width: 40, height: 40 });
    expect(session.activeId).toBe('el-2');
    expect(session.original).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });
});
