import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  context?: string;
  /** Status zone: connection pill, save indicator, notices. */
  status?: ReactNode;
  /** Action zone: the page or workflow controls rendered by the caller. */
  actions?: ReactNode;
}

/**
 * Page header with separated title/context, status, and action zones.
 * It renders whatever the caller passes, so control behavior stays with the
 * existing state owner.
 */
export function PageHeader({ title, context, status, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__leading">
        <div className="page-header__title-row">
          <h1 className="page-header__title">{title}</h1>
        </div>
        {context ? <p className="page-header__context">{context}</p> : null}
      </div>
      <div className="page-header__trailing">
        {status ? <div className="page-header__status">{status}</div> : null}
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
