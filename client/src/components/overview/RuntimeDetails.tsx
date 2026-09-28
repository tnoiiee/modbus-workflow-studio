import { createPortal } from 'react-dom';
import type { OverviewElement } from '../../lib/overviewElements.js';
import type { BindingResolution } from '../../lib/overviewBinding.js';
import { runtimePresentation, presentationAge, runtimeDiagnosticValue } from '../../lib/overviewRuntimePresentation.js';
import { Modal } from '../ui/Modal.js';
import { useOverviewRuntime, useRuntimeClock, useRuntimeItem, useRuntimeStatus } from './OverviewRuntimeProvider.js';
export function RuntimeDetails({ element, resolution, onClose }: { element: OverviewElement; resolution?: BindingResolution; onClose: () => void }) {
  const context = useOverviewRuntime()!;
  const sourceId = element.binding.source?.sourceType === 'SHARED_TAG' ? element.binding.source.sourceId ?? '' : '';
  const item = useRuntimeItem(context.adapter, sourceId), status = useRuntimeStatus(context.adapter), now = useRuntimeClock(context.adapter);
  const p = runtimePresentation(element, resolution, item, status.transport);
  const content = <Modal open title={`Runtime details — ${element.name}`} description="Read-only latest received data. Transport connected does not confirm replay catch-up or live freshness." onClose={onClose} footer={<button type="button" onClick={onClose}>Close details</button>}>
    <section className="overview-runtime-detail-section" aria-label="Runtime summary">
      <h3>Runtime summary</h3>
      <div className={`overview-runtime-detail-reading is-${p.tone}`}>
        <span>{p.label} — full precision</span><strong>{p.fullValue} {p.unit}</strong>
      </div>
      <dl className="overview-runtime-details">
        <dt>Producer availability</dt><dd>{p.availability}</dd>
        <dt>Age of displayed value</dt><dd>{presentationAge(p.timestamp, now, status.transport)}</dd>
      </dl>
    </section>
    <section className="overview-runtime-detail-section" aria-label="Source and Binding">
      <h3>Source and Binding</h3>
      <dl className="overview-runtime-details">
        <dt>Configuration caption</dt><dd>{element.style.text || '—'}</dd>
        <dt>Source identity</dt><dd>SHARED_TAG / {sourceId}</dd>
        <dt>Binding</dt><dd>{resolution?.status ?? 'NOT_BOUND'}</dd>
      </dl>
    </section>
    <section className="overview-runtime-detail-section" aria-label="Sample Quality and timestamps">
      <h3>Sample Quality and timestamps</h3>
      <dl className="overview-runtime-details">
        <dt>Sample quality</dt><dd>{p.quality ?? 'No sample quality'}</dd>
        <dt>Reason</dt><dd>{p.reason}</dd>
        {/* GOOD current value is already primary above; failed/raw values are diagnostic only. */}
        {(p.historical || p.value === null || p.fullValue !== runtimeDiagnosticValue(item?.sample?.value, item?.sample?.dataType)) && <>
          <dt>Latest received sample — full precision (quality applies)</dt><dd>{item?.sample?.hasValue ? runtimeDiagnosticValue(item.sample.value, item.sample.dataType) : 'Unavailable'}</dd>
        </>}
        <dt>Receive timestamp (Server)</dt><dd>{item?.sample?.receiveTimestamp ?? 'Unavailable'}</dd>
        <dt>Source timestamp (Device)</dt><dd>{item?.sample?.sourceTimestamp ?? 'Not supplied by Device'}</dd>
      </dl>
    </section>
    <details className="overview-runtime-history">
      <summary>Historical Last-good — not current</summary>
      <dl className="overview-runtime-details">
        <dt>Last-good value — historical, not current</dt><dd>{runtimeDiagnosticValue(item?.sample?.lastGoodValue, item?.sample?.dataType)}</dd>
        <dt>Last GOOD receive timestamp</dt><dd>{item?.sample?.lastGoodReceiveTimestamp ?? 'Unavailable'}</dd>
      </dl>
    </details>
    <section className="overview-runtime-detail-section" aria-label="Browser transport and safety">
      <h3>Browser transport and safety</h3>
      <dl className="overview-runtime-details"><dt>Browser transport</dt><dd>{status.transport} · {status.message}</dd></dl>
    </section>
    <p className="overview-runtime-caveat">Last-good and cached values are historical/latest received, not confirmed LIVE. Browser transport does not change Device quality. No replay-complete or exactly-once guarantee. Age uses the Browser clock and may be limited by clock skew or suspension.</p>
  </Modal>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
