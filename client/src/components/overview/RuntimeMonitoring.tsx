import type { OverviewElement } from '../../lib/overviewElements.js';
import type { BindingResolution } from '../../lib/overviewBinding.js';
import { captionText, presentationAge, runtimePresentation, operatorRuntimeStatus } from '../../lib/overviewRuntimePresentation.js';
import { useOverviewRuntime, useRuntimeClock, useRuntimeItem, useRuntimeStatus } from './OverviewRuntimeProvider.js';
import type { OverviewTagClientAdapter } from '../../lib/overviewTagClientAdapter.js';
export function RuntimeMonitoring({ element, resolution }: { element: OverviewElement; resolution?: BindingResolution }) {
  const context = useOverviewRuntime();
  const source = element.binding.source;
  if (!context?.enabled || resolution?.status !== 'BOUND' || source?.sourceType !== 'SHARED_TAG' || !source.sourceId) {
    const p = runtimePresentation(element, resolution, undefined, 'Disposed');
    return <RuntimeMonitoringView element={element} presentation={{ ...p, reason: context?.error || p.reason }} age="No receive timestamp" />;
  }
  return <BoundMonitoring element={element} resolution={resolution} sourceId={source.sourceId} adapter={context.adapter} onDetails={() => context.openDetails(element.id)} />;
}
function BoundMonitoring({ element, resolution, sourceId, adapter, onDetails }: { element: OverviewElement; resolution: BindingResolution; sourceId: string; adapter: OverviewTagClientAdapter; onDetails: () => void }) {
  const item = useRuntimeItem(adapter, sourceId), status = useRuntimeStatus(adapter), now = useRuntimeClock(adapter);
  const p = runtimePresentation(element, resolution, item, status.transport);
  return <RuntimeMonitoringView element={element} presentation={p} age={presentationAge(p.timestamp, now, status.transport)} onDetails={onDetails} />;
}
/** Operator surface only; full diagnostics stay in the existing Details dialog. */
export function RuntimeMonitoringView({ element, presentation: p, age, onDetails }: {
  element: OverviewElement; presentation: ReturnType<typeof runtimePresentation>; age: string; onDetails?: () => void;
}) {
  const caption = element.style.text.trim();
  const status = operatorRuntimeStatus(p, age);
  const compact = element.type === 'VALUE_BADGE' || element.height < 64;
  const micro = element.width < 112 || element.height < 36;
  const accessible = [caption, `${p.fullValue}${p.unit ? ` ${p.unit}` : ''}`, status, 'Read-only monitoring'].filter(Boolean).join(' · ');
  return <span className={`overview-runtime-value is-${p.tone}${caption ? ' has-caption' : ''}${compact ? ' is-compact' : ''}${micro ? ' is-micro' : ''}${status ? ' has-abnormal' : ''}`} role="group" aria-label={accessible} title={accessible} data-runtime-tone={p.tone}>
    {caption && <span className="overview-runtime-caption" title={caption}>{captionText(caption)}</span>}
    <span className="overview-runtime-reading">
      {element.type === 'STATUS_LIGHT' && <i className={`overview-runtime-lamp lamp-${p.lamp}`} aria-hidden="true" />}
      <span className="overview-runtime-number">{p.text}</span>{p.unit && <span className="overview-runtime-unit" title={p.unit}>{captionText(p.unit, 16)}</span>}
    </span>
    {status && <span className="overview-runtime-abnormal" title={status}><span className="overview-runtime-attention" aria-hidden="true">!</span><span className="overview-runtime-status-text">{status}</span></span>}
    {onDetails && <button type="button" className="overview-runtime-detail-button nodrag nopan" aria-label={`Runtime details: ${caption || element.name}`} title="Runtime details" onClick={e => { e.stopPropagation(); onDetails(); }}>ⓘ</button>}
  </span>;
}
