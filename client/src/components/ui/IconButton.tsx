import type { ButtonHTMLAttributes, ReactNode } from 'react';

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
    <span className="tooltip-host">
      <button type={type} className={classes} aria-label={label} title={text} {...rest}>
        <span aria-hidden="true">{icon}</span>
      </button>
      <span className="tooltip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
