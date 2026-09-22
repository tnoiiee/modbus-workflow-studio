import type { ReactNode } from 'react';

export interface TooltipProps {
  label: string;
  children: ReactNode;
}

/**
 * CSS-only tooltip wrapper. The wrapped control keeps its own accessible name;
 * the bubble is exposed as `role="tooltip"` and appears on hover and on
 * keyboard focus of the wrapped control.
 */
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="tooltip-host">
      {children}
      <span className="tooltip-bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
}
