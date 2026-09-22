import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Tooltip } from './Tooltip.js';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also used as the tooltip text when `tooltip` is omitted. */
  label: string;
  icon: ReactNode;
  variant?: 'default' | 'danger';
  size?: 'sm' | 'md';
  tooltip?: string;
}

/**
 * Icon-only button with a mandatory accessible name and a visible tooltip.
 * The tooltip renders through the shared portal overlay (always on top).
 * Destructive icon buttons must pass `variant="danger"` plus an explicit label.
 */
export function IconButton({
  label,
  icon,
  variant = 'default',
  size = 'md',
  tooltip,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const text = tooltip ?? label;
  const classes = ['btn-icon', variant === 'danger' && 'btn-icon--danger', size === 'sm' && 'btn-icon--sm', className]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <Tooltip label={text}>
      <button type={type} className={classes} aria-label={label} {...rest}>
        <span aria-hidden="true">{icon}</span>
      </button>
    </Tooltip>
  );
}
