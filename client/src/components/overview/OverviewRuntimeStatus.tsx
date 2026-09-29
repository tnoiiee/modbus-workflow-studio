import { RuntimeSafetyAction } from './RuntimeSafetyPanel.js';
import { useEffect, useState } from 'react';
import type { OverviewElement } from '../../lib/overviewElements.js';
import type { RuntimeSelection } from '../../lib/overviewRuntimeSelection.js';
import { runtimeHealthCounts } from '../../lib/overviewRuntimePresentation.js';
import { useOverviewRuntime, useRuntimeStatus, useRuntimeClock } from './OverviewRuntimeProvider.js';
export function OverviewRuntimeStatus({ selection, elements, pageId = '' }: { pageId?: string; selection: RuntimeSelection; elements: readonly OverviewElement[] }) {
  const context = useOverviewRuntime()!;
  const status = useRuntimeStatus(context.adapter);
  useRuntimeClock(context.adapter); // Bounded 1 Hz summary; no extra per-Tag subscriptions.
  const counts = runtimeHealthCounts(selection.sources.map(source => context.adapter.store.getItem(source.sourceId)));
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => { const timer = setTimeout(() => setAnnouncement(`Tag transport: ${status.transport}. ${status.message}`), 500); return () => clearTimeout(timer); }, [status.transport, status.message]);
  return <section className="overview-runtime-status" aria-label="Overview read-only Runtime">
    <div className="overview-runtime-status-line"><strong>READ-ONLY MONITORING</strong><span className={`overview-runtime-transport is-${status.transport.toLowerCase()}`}>Transport: {status.transport}</span><span>{selection.sources.length} Tags</span>
      {!!counts.stale && <span className="overview-runtime-summary-warning">{counts.stale} stale</span>}
      {!!counts.unavailable && <span className="overview-runtime-summary-warning">{counts.unavailable} unavailable</span>}
      {!!counts.uncertain && <span className="overview-runtime-summary-warning">{counts.uncertain} uncertain</span>}
      {!!counts.bad && <span className="overview-runtime-summary-warning">{counts.bad} bad</span>}
    </div>
    {(selection.error || status.transport !== 'Connected' || !context.enabled) && <p className="overview-runtime-callout">{selection.error || (!context.enabled ? `Runtime disabled. ${status.message}` : status.message)}</p>}
    <span className="overview-runtime-sr" aria-live="polite" aria-atomic="true">{announcement}</span>
    {status.transport === 'Error' && <button type="button" onClick={() => context.adapter.retry()}>Retry Runtime</button>}
    <RuntimeSafetyAction key={pageId} selection={selection} elements={elements} message={status.message} onDetails={context.openDetails} />
  </section>;
}
