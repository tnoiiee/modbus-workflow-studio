import { Info } from 'lucide-react';
import { canvasMonitoringLayout, canvasRuntimeStatus } from '../../lib/overviewCanvasPresentation.js';
import type { CSSProperties } from 'react';
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
/** Operator surface only; full diagnostics stay in the existing Details dialog. */
export function RuntimeMonitoringView({ element, presentation: p, age, onDetails, editorPreview = false }: {
  element: OverviewElement; presentation: ReturnType<typeof runtimePresentation>; age: string; onDetails?: () => void; editorPreview?: boolean;
}) {
  const caption = element.style.text.trim();
  const layout = canvasMonitoringLayout(element);
  const status = canvasRuntimeStatus(p, age, layout.roomy, editorPreview);
  const fullStatus = canvasRuntimeStatus(p, age, true, editorPreview);
  const light = element.type === 'STATUS_LIGHT';
  const hideText = light && (element.style.showText === false || !layout.lightText);
  const alignment = { left: 'flex-start', center: 'center', right: 'flex-end' }[element.style.alignment];
  const { inlineAction, compact, micro } = layout;
  const accessible = [caption, `${p.fullValue}${p.unit ? ` ${p.unit}` : ''}`, fullStatus, onDetails && !inlineAction ? 'Runtime details available from Page Runtime details and safety' : '', editorPreview ? 'EDITOR PREVIEW · representative value, not Runtime' : 'Read-only monitoring'].filter(Boolean).join(' · ');
  return <span className={`overview-runtime-value is-${p.tone}${caption && layout.caption ? ' has-caption' : ''}${compact ? ' is-compact' : ''}${micro ? ' is-micro' : ''}${status ? ' has-abnormal' : ''}${light ? ' is-light' : ''}${inlineAction ? ' has-action-slot' : ' has-page-action'}${layout.statusRow ? ' has-status-row' : ' has-status-marker'}${layout.tiny ? ' is-tiny' : ''}`} style={{ '--reading-align': alignment } as CSSProperties} data-editor-preview={editorPreview || undefined} role="group" aria-label={accessible} title={accessible} data-runtime-tone={p.tone}>
    {caption && <span className={layout.caption ? "overview-runtime-caption" : "overview-runtime-caption overview-runtime-sr"} aria-hidden="true" style={element.style.captionFontSize === undefined ? undefined : { fontSize: element.style.captionFontSize }} title={caption}>{captionText(caption)}</span>}
    <span className="overview-runtime-reading" aria-hidden="true">
      {light && <i className={`overview-runtime-lamp lamp-${p.lamp}`} aria-hidden="true">{p.lamp === 'true' ? '●' : p.lamp === 'false' ? '−' : '?'}</i>}
      <span className={hideText ? "overview-runtime-sr" : "overview-runtime-number"} style={element.style.valueFontSize === undefined ? undefined : { fontSize: element.style.valueFontSize }}>{p.text}</span>{p.unit && <span className={layout.unit ? "overview-runtime-unit" : "overview-runtime-unit overview-runtime-sr"} title={p.unit}>{captionText(p.unit, 16)}</span>}
    </span>
    <span className="overview-runtime-abnormal" data-empty={!status || undefined} aria-hidden="true" title={fullStatus || undefined}>
      {status && <><span className="overview-runtime-attention">!</span><span className={layout.statusRow ? "overview-runtime-status-text" : "overview-runtime-status-text overview-runtime-sr"}>{status}</span></>}
    </span>
    {onDetails && inlineAction && <button type="button" className="overview-runtime-detail-button nodrag nopan" aria-label={`Runtime details: ${caption || element.name}`} title="Runtime details" onClick={e => { e.stopPropagation(); onDetails(); }}><Info size={16} aria-hidden="true" focusable="false" /></button>}
  </span>;
}

/** Pure configuration preview: no Runtime hooks, Snapshot, socket or sample reads. */
export function EditorMonitoring({ element, resolution }: { element: OverviewElement; resolution?: BindingResolution }) {
  const type = resolution?.definition?.dataType ?? element.binding.dataType;
  const unsupported = type === 'String' || element.type === 'TEXT_LABEL';
  const boolean = type === 'Boolean' || element.type === 'STATUS_LIGHT';
  const text = unsupported ? '—' : boolean ? 'FALSE' : '8888.88';
  const presentation = { ...runtimePresentation(element, resolution, undefined, 'Disposed'),
    text, fullValue: text, value: unsupported ? null : boolean ? false : 8888.88,
    tone: 'preview', lamp: boolean && !unsupported ? 'false' : 'unavailable',
    unit: !unsupported && !boolean ? resolution?.definition?.unit ?? '' : '',
  };
  return <RuntimeMonitoringView element={element} presentation={presentation} age="" editorPreview />;
}
