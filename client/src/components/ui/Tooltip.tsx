import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/** Shared Tooltip overlay z-index — above panels, canvas, modals, and chrome. */
export const TOOLTIP_OVERLAY_Z = 10000;

/** Safe viewport margin when clamping a tooltip bubble. */
export const TOOLTIP_VIEWPORT_MARGIN = 8;

/** Gap between the target rect and the tooltip bubble. */
export const TOOLTIP_GAP = 8;

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface TooltipViewport {
  width: number;
  height: number;
}

export interface TooltipBubbleSize {
  width: number;
  height: number;
}

export interface TooltipPosition {
  left: number;
  top: number;
  side: TooltipSide;
}

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/**
 * Prefer the requested side; flip when the bubble would cross a viewport edge;
 * clamp horizontally and vertically with a safe margin.
 */
export function resolveTooltipPosition(
  anchor: TooltipAnchorRect,
  preferred: TooltipSide,
  viewport: TooltipViewport,
  size: TooltipBubbleSize,
  margin = TOOLTIP_VIEWPORT_MARGIN,
  gap = TOOLTIP_GAP,
): TooltipPosition {
  const fits = (side: TooltipSide): boolean => {
    switch (side) {
      case 'top':
        return anchor.top - gap - size.height >= margin;
      case 'bottom':
        return anchor.bottom + gap + size.height <= viewport.height - margin;
      case 'left':
        return anchor.left - gap - size.width >= margin;
      case 'right':
        return anchor.right + gap + size.width <= viewport.width - margin;
    }
  };

  const side: TooltipSide = fits(preferred)
    ? preferred
    : fits(OPPOSITE[preferred])
      ? OPPOSITE[preferred]
      : preferred;

  let left: number;
  let top: number;
  switch (side) {
    case 'top':
      left = anchor.left + (anchor.right - anchor.left) / 2 - size.width / 2;
      top = anchor.top - gap - size.height;
      break;
    case 'bottom':
      left = anchor.left + (anchor.right - anchor.left) / 2 - size.width / 2;
      top = anchor.bottom + gap;
      break;
    case 'left':
      left = anchor.left - gap - size.width;
      top = anchor.top + (anchor.bottom - anchor.top) / 2 - size.height / 2;
      break;
    case 'right':
      left = anchor.right + gap;
      top = anchor.top + (anchor.bottom - anchor.top) / 2 - size.height / 2;
      break;
  }

  left = Math.min(Math.max(margin, left), Math.max(margin, viewport.width - margin - size.width));
  top = Math.min(Math.max(margin, top), Math.max(margin, viewport.height - margin - size.height));
  return { left, top, side };
}

/** Only one shared Tooltip may be visible at a time. */
let hideActiveTooltip: (() => void) | null = null;

export interface TooltipProps {
  label: string;
  children: ReactNode;
  /** Preferred placement; flips when the viewport would clip the bubble. */
  side?: TooltipSide;
}

/**
 * Portal-based tooltip: renders through `document.body` with `position: fixed`,
 * measured from the target's `getBoundingClientRect()`. The bubble never affects
 * parent layout and never intercepts pointer input (`pointer-events: none`).
 *
 * Pointer hover opens, pointer leave closes; keyboard focus opens and blur
 * closes. `aria-describedby` points at the bubble while it is visible.
 */
export function Tooltip({ label, children, side = 'top' }: TooltipProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    if (hideActiveTooltip === close) hideActiveTooltip = null;
  }, []);

  const openTooltip = useCallback(() => {
    if (hideActiveTooltip && hideActiveTooltip !== close) hideActiveTooltip();
    hideActiveTooltip = close;
    setOpen(true);
  }, [close]);

  const reposition = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const anchor = host.getBoundingClientRect();
    const bubble = bubbleRef.current;
    const size: TooltipBubbleSize = bubble
      ? { width: bubble.offsetWidth, height: bubble.offsetHeight }
      : { width: 0, height: 0 };
    setPosition(
      resolveTooltipPosition(
        anchor,
        side,
        { width: window.innerWidth, height: window.innerHeight },
        size,
      ),
    );
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition, label]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => reposition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, reposition]);

  // Close when the host unmounts (parent navigation, conditional render).
  useEffect(() => {
    return () => {
      if (hideActiveTooltip === close) hideActiveTooltip = null;
    };
  }, [close]);

  // Re-measure the bubble after first paint so flip/clamp use real size.
  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  const bubble = open
    ? createPortal(
        <div
          ref={bubbleRef}
          id={tooltipId}
          role="tooltip"
          className="tooltip-portal"
          data-side={position?.side ?? side}
          style={{
            position: 'fixed',
            left: `${position?.left ?? -9999}px`,
            top: `${position?.top ?? -9999}px`,
            zIndex: TOOLTIP_OVERLAY_Z,
            pointerEvents: 'none',
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          {label}
        </div>,
        document.body,
      )
    : null;

  return (
    <span
      ref={hostRef}
      className="tooltip-host"
      onMouseEnter={openTooltip}
      onMouseLeave={close}
      onFocusCapture={openTooltip}
      onBlurCapture={close}
      data-tooltip-open={open ? 'true' : 'false'}
    >
      <span className="tooltip-anchor" aria-describedby={open ? tooltipId : undefined}>
        {children}
      </span>
      {bubble}
    </span>
  );
}
