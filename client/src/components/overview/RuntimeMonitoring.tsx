import type { OverviewElement } from '../../lib/overviewElements.js';
import type { BindingResolution } from '../../lib/overviewBinding.js';
import { captionText, presentationAge, runtimePresentation } from '../../lib/overviewRuntimePresentation.js';
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
/** Pure read-only view: spans, never output/status live regions or switch semantics. */
export function RuntimeMonitoringView({ element, presentation: p, age, onDetails }: {
  element: OverviewElement; presentation: ReturnType<typeof runtimePresentation>; age: string; onDetails?: () => void;
}) {
  return <span className={`overview-runtime-value is-${p.tone}`} role="group" aria-label={`${element.name}: read-only monitoring`} data-runtime-tone={p.tone}>
    <span className="overview-runtime-caption" title={element.style.text}>{captionText(element.style.text || element.name)}</span>
    <span className="overview-runtime-reading">
      <span className="overview-runtime-inline-state">{p.displayState}</span>
      {element.type === 'STATUS_LIGHT' && <i className={`overview-runtime-lamp lamp-${p.lamp}`} aria-hidden="true" />}
      <span className="overview-runtime-number">{p.text}</span>{p.unit && <span className="overview-runtime-unit" title={p.unit}>{captionText(p.unit, 16)}</span>}
    </span>
    <span className="overview-runtime-quality">{p.label} · {p.quality ?? p.availability}</span>
    <span className="overview-runtime-age" title={p.timestamp ?? ''}>{age}</span>
    <span className="overview-runtime-binding">Binding: {p.binding}</span>
    <span className="overview-runtime-reason" title={p.reason}>{p.availability}{p.text === '—' || p.quality !== 'GOOD' ? ` · ${p.reason}` : ''}</span>
    {onDetails && <button type="button" className="overview-runtime-detail-button nodrag nopan" aria-label={`Runtime details: ${element.name}`} onClick={e => { e.stopPropagation(); onDetails(); }}>ⓘ</button>}
  </span>;
}
