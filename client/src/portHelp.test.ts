import { describe, expect, it } from 'vitest';

import {
  BLOCK_NOMINAL_WIDTH,
  PORT_TOOLTIP_DELAY_MS,
  PORT_TOOLTIP_WIDTH,
  SNAP_GRID,
  centerFlowPosition,
  nudgeToFreeSlot,
  resolveTooltipPlacement,
  snapToGrid,
} from './App.js';

describe('port tooltip behaviour', () => {
  it('uses the approved two second hover delay', () => {
    expect(PORT_TOOLTIP_DELAY_MS).toBe(2000);
  });

  it('prefers the left side for an input port and the right side for an output port', () => {
    const anchor = { top: 200, left: 400, right: 430, bottom: 220 };
    const viewport = { width: 1920, height: 1080 };
    const size = { width: PORT_TOOLTIP_WIDTH, height: 120 };

    const input = resolveTooltipPlacement(anchor, 'in', viewport, size);
    expect(input.left).toBe(anchor.left - 8 - PORT_TOOLTIP_WIDTH);

    const output = resolveTooltipPlacement(anchor, 'out', viewport, size);
    expect(output.left).toBe(anchor.right + 8);

    // vertical position stays at the anchor while there is room below
    expect(input.top).toBe(anchor.top);
  });

  it('flips to the other side when the preferred side leaves the viewport', () => {
    const viewport = { width: 1024, height: 768 };
    const size = { width: PORT_TOOLTIP_WIDTH, height: 120 };

    // an input port near the left edge flips to the right of the label
    const nearLeft = resolveTooltipPlacement({ top: 100, left: 40, right: 70, bottom: 120 }, 'in', viewport, size);
    expect(nearLeft.left).toBe(70 + 8);

    // an output port near the right edge flips to the left of the label
    const nearRight = resolveTooltipPlacement({ top: 100, left: 950, right: 1010, bottom: 120 }, 'out', viewport, size);
    expect(nearRight.left).toBe(950 - 8 - PORT_TOOLTIP_WIDTH);
  });

  it('clamps the tooltip inside the viewport on both axes', () => {
    const viewport = { width: 640, height: 480 };
    const size = { width: PORT_TOOLTIP_WIDTH, height: 400 };

    const placement = resolveTooltipPlacement({ top: 450, left: 10, right: 30, bottom: 470 }, 'in', viewport, size);
    expect(placement.left).toBeGreaterThanOrEqual(8);
    expect(placement.left + size.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(placement.top + size.height).toBeLessThanOrEqual(viewport.height - 8);
  });
});

describe('add block canvas centre', () => {
  it('rounds a flow coordinate onto the snap grid', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(8)).toBe(16);
    expect(snapToGrid(-9)).toBe(-16);
    expect(snapToGrid(24)).toBe(32);
    expect(snapToGrid(25)).toBe(32);
    expect(SNAP_GRID).toBe(16);
  });

  it('converts the visible canvas centre and offsets by half the block size', () => {
    // a viewport at 0,0 with zoom 1: screen centre 683,384 -> flow 683,384
    const project = (point: { x: number; y: number }) => point;
    const position = centerFlowPosition({ x: 683, y: 384 }, BLOCK_NOMINAL_WIDTH, 145, project);

    expect(position.x).toBe(snapToGrid(683 - BLOCK_NOMINAL_WIDTH / 2));
    expect(position.y).toBe(snapToGrid(384 - 145 / 2));
    // the block stays centred within one half snap grid
    expect(Math.abs(position.x + BLOCK_NOMINAL_WIDTH / 2 - 683)).toBeLessThanOrEqual(SNAP_GRID / 2);
    expect(Math.abs(position.y + 145 / 2 - 384)).toBeLessThanOrEqual(SNAP_GRID / 2);
  });

  it('follows pan and zoom through the screen to flow conversion', () => {
    const zoom = 0.5;
    const pan = { x: 120, y: 60 };
    const project = (point: { x: number; y: number }) => ({
      x: (point.x - pan.x) / zoom,
      y: (point.y - pan.y) / zoom,
    });

    const a = centerFlowPosition({ x: 500, y: 400 }, BLOCK_NOMINAL_WIDTH, 145, project);
    const b = centerFlowPosition({ x: 700, y: 400 }, BLOCK_NOMINAL_WIDTH, 145, project);

    expect(b.x - a.x).toBe(400); // 200 screen px at zoom 0.5 is 400 flow px
    expect(a).not.toEqual(b);
  });

  it('nudges deterministically along the snap grid without moving existing nodes', () => {
    const existing = [{ x: 0, y: 0 }];
    expect(nudgeToFreeSlot({ x: 0, y: 0 }, existing)).toEqual({ x: 16, y: 16 });
    expect(nudgeToFreeSlot({ x: 0, y: 0 }, existing)).toEqual(nudgeToFreeSlot({ x: 0, y: 0 }, existing));
    expect(nudgeToFreeSlot({ x: 16, y: 16 }, existing)).toEqual({ x: 16, y: 16 });
    expect(nudgeToFreeSlot({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 16, y: 16 }])).toEqual({ x: 32, y: 32 });
    // existing positions are never rewritten
    expect(existing).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps an empty slot untouched', () => {
    expect(nudgeToFreeSlot({ x: 96, y: 48 }, [])).toEqual({ x: 96, y: 48 });
    expect(nudgeToFreeSlot({ x: 96, y: 48 }, [{ x: 960, y: 480 }])).toEqual({ x: 96, y: 48 });
  });
});
