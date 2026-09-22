import type { ReactNode } from 'react';

export interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Renders the panel flush (no body padding), for tables and lists. */
  flush?: boolean;
}

/**
 * Surface container used by pages and inspectors. Replaces the ad-hoc
 * `.panel` markup with a consistent header/body structure without changing
 * what callers render inside it.
 */
export function Panel({ title, actions, children, className, flush = false }: PanelProps) {
  const classes = ['card', className].filter((value): value is string => Boolean(value)).join(' ');
  return (
    <section className={classes}>
      {title || actions ? (
        <div className="card__header">
          {title ? <h3 className="card__title">{title}</h3> : null}
          {actions}
        </div>
      ) : null}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
    </section>
  );
}
