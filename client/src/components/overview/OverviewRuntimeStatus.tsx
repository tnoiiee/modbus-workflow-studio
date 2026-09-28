import { useEffect, useState } from 'react';
import type { OverviewElement } from '../../lib/overviewElements.js';
import type { RuntimeSelection } from '../../lib/overviewRuntimeSelection.js';
import { captionText, runtimeHealthCounts } from '../../lib/overviewRuntimePresentation.js';
import { useOverviewRuntime, useRuntimeStatus, useRuntimeClock } from './OverviewRuntimeProvider.js';
export function OverviewRuntimeStatus({ selection, elements }: { selection: RuntimeSelection; elements: readonly OverviewElement[] }) {
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
      <span className="overview-runtime-trust">Trusted network only</span></div>
    {(selection.error || status.transport !== 'Connected' || !context.enabled) && <p className="overview-runtime-callout">{selection.error || (!context.enabled ? `Runtime disabled. ${status.message}` : status.message)}</p>}
    <span className="overview-runtime-sr" aria-live="polite" aria-atomic="true">{announcement}</span>
    {status.transport === 'Error' && <button type="button" onClick={() => context.adapter.retry()}>Retry Runtime</button>}
    <details><summary>Runtime details &amp; safety</summary>
      <p>{selection.elementIds.length} Elements · {status.message}</p>
      <p>Latest received data only. Transport connected does not mean every Tag is GOOD, fresh, Device-connected or replay caught up. No exactly-once guarantee.</p>
      <p>Trusted network or authenticated reverse proxy only. No integrated authentication/authorization. Origin policy is not authentication. Not public-Internet ready.</p>
      <p>Display may coalesce intermediate samples; this is not an alarm/event history. Automatic recovery: at most 5 attempts / rolling 60 seconds. Manual Retry: at most once per second.</p>
      <ul>{selection.elementIds.map(id => { const element = elements.find(e => e.id === id); return element ? <li key={id}><button type="button" onClick={() => context.openDetails(id)}>{captionText(element.name)} — Runtime details</button></li> : null; })}</ul>
    </details>
  </section>;
}
