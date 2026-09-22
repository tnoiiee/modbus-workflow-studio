import type { ReactNode } from 'react';
import type { ConnectionState } from '../../lib/connectionStatus.js';
import { isConnectionNotice } from '../../lib/connectionStatus.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { PageHeader } from './PageHeader.js';
import { Sidebar } from './Sidebar.js';
import type { PageId } from './Sidebar.js';

export interface AppShellProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  title: string;
  context?: string;
  connectionState: ConnectionState;
  connectionDetail?: string;
  /** Existing save/revision indicator text. */
  saved?: string;
  /** Existing notice text; connection notices are shown by the pill instead. */
  notice?: string;
  actions?: ReactNode;
  children: ReactNode;
}

function saveTone(saved: string): string {
  const value = saved.toLowerCase();
  if (value.includes('fail') || value.includes('not saved')) return 'save-indicator--error';
  if (value.includes('saved')) return 'save-indicator--saved';
  if (value.includes('pending')) return 'save-indicator--pending';
  return 'save-indicator--saving';
}

/**
 * Application shell: sidebar navigation, page header with a visible connection
 * status pill, save indicator, notice banner, and the caller-provided action
 * zone and page body.
 *
 * It owns no application state and issues no requests; everything is passed in
 * by the existing state owner (`App.tsx`).
 */
export function AppShell({
  page,
  onNavigate,
  title,
  context,
  connectionState,
  connectionDetail,
  saved,
  notice,
  actions,
  children,
}: AppShellProps) {
  const showNotice = Boolean(notice) && !isConnectionNotice(notice);

  return (
    <div className="app app-shell">
      <Sidebar page={page} onNavigate={onNavigate} />
      <main className="app-main">
        <PageHeader
          title={title}
          context={context}
          status={
            <>
              <ConnectionStatus state={connectionState} detail={connectionDetail} />
              {saved ? <span className={`save-indicator ${saveTone(saved)}`}>{saved}</span> : null}
              {showNotice ? (
                <span className="notice-banner" role="alert" title={notice}>
                  {notice}
                </span>
              ) : null}
            </>
          }
          actions={actions}
        />
        {children}
      </main>
    </div>
  );
}
