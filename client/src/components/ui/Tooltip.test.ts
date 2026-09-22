import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  TOOLTIP_GAP,
  TOOLTIP_OVERLAY_Z,
  TOOLTIP_VIEWPORT_MARGIN,
  resolveTooltipPosition,
  type TooltipSide,
} from './Tooltip.js';

const viewport = { width: 1024, height: 768 };
const size = { width: 120, height: 36 };

function anchor(partial: Partial<{ top: number; left: number; right: number; bottom: number }> = {}) {
  return {
    top: partial.top ?? 400,
    left: partial.left ?? 400,
    right: partial.right ?? 460,
    bottom: partial.bottom ?? 430,
  };
}

describe('resolveTooltipPosition', () => {
  it('prefers the requested side when there is room', () => {
    const result = resolveTooltipPosition(anchor(), 'bottom', viewport, size);
    expect(result.side).toBe('bottom');
    expect(result.top).toBe(430 + TOOLTIP_GAP);
  });

  it('flips to the opposite side when the preferred side crosses the viewport', () => {
    const topEdge = resolveTooltipPosition(anchor({ top: 10, bottom: 40 }), 'top', viewport, size);
    expect(topEdge.side).toBe('bottom');
    expect(topEdge.top).toBeGreaterThanOrEqual(TOOLTIP_VIEWPORT_MARGIN);

    const bottomEdge = resolveTooltipPosition(anchor({ top: 740, bottom: 760 }), 'bottom', viewport, size);
    expect(bottomEdge.side).toBe('top');
    expect(bottomEdge.top + size.height).toBeLessThanOrEqual(viewport.height - TOOLTIP_VIEWPORT_MARGIN);
  });

  it('clamps horizontally and vertically with a safe margin', () => {
    const rightEdge = resolveTooltipPosition(anchor({ left: 980, right: 1010 }), 'bottom', viewport, size);
    expect(rightEdge.left + size.width).toBeLessThanOrEqual(viewport.width - TOOLTIP_VIEWPORT_MARGIN);
    expect(rightEdge.left).toBeGreaterThanOrEqual(TOOLTIP_VIEWPORT_MARGIN);

    const leftEdge = resolveTooltipPosition(anchor({ left: 4, right: 30 }), 'bottom', viewport, size);
    expect(leftEdge.left).toBeGreaterThanOrEqual(TOOLTIP_VIEWPORT_MARGIN);

    const result = resolveTooltipPosition(anchor(), 'left', viewport, size);
    expect(result.left).toBeGreaterThanOrEqual(TOOLTIP_VIEWPORT_MARGIN);
    expect(result.top).toBeGreaterThanOrEqual(TOOLTIP_VIEWPORT_MARGIN);
  });

  it('uses a shared z-index constant suitable for the top overlay layer', () => {
    expect(TOOLTIP_OVERLAY_Z).toBeGreaterThanOrEqual(1000);
    expect(TOOLTIP_OVERLAY_Z).toBeGreaterThan(60); // above modal overlay
  });

  it('handles all four sides without leaving the viewport', () => {
    const sides: TooltipSide[] = ['top', 'bottom', 'left', 'right'];
    for (const side of sides) {
      const result = resolveTooltipPosition(anchor({ top: 2, left: 2, right: 10, bottom: 10 }), side, viewport, size);
      expect(result.left).toBeGreaterThanOrEqual(TOOLTIP_VIEWPORT_MARGIN);
      expect(result.top).toBeGreaterThanOrEqual(TOOLTIP_VIEWPORT_MARGIN);
      expect(result.left + size.width).toBeLessThanOrEqual(viewport.width - TOOLTIP_VIEWPORT_MARGIN + 0.001);
      expect(result.top + size.height).toBeLessThanOrEqual(viewport.height - TOOLTIP_VIEWPORT_MARGIN + 0.001);
    }
  });
});

describe('Tooltip portal source contract', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ui', 'Tooltip.tsx'), 'utf8');

  it('renders through a React Portal to document.body', () => {
    expect(source).toContain('createPortal');
    expect(source).toContain('document.body');
  });

  it('uses position fixed and pointer-events none', () => {
    expect(source).toContain("position: 'fixed'");
    expect(source).toContain('pointerEvents');
    expect(source).toContain('TOOLTIP_OVERLAY_Z');
  });

  it('closes on unmount and keeps only one tooltip open', () => {
    expect(source).toContain('hideActiveTooltip');
    expect(source).toContain('onMouseLeave');
    expect(source).toContain('onBlurCapture');
    expect(source).toContain('aria-describedby');
  });
});
