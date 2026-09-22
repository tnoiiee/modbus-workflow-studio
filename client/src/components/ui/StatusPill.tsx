import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface StatusPillProps {
  tone?: PillTone;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
  title?: string;
  className?: string;
}

/**
 * Compact status badge. State is always carried by text (and optionally an
 * icon or dot), never by color alone.
 */
export function StatusPill({ tone = 'neutral', children, icon, dot = false, title, className }: StatusPillProps) {
  const classes = ['pill', `pill--${tone}`, className].filter((value): value is string => Boolean(value)).join(' ');
  return (
    <span className={classes} title={title}>
      {dot ? <span className="pill__dot" aria-hidden="true" /> : null}
      {icon ? (
        <span className="pill__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
