import { createPortal } from 'react-dom';
import type { OverviewElement } from '../../lib/overviewElements.js';
import type { BindingResolution } from '../../lib/overviewBinding.js';
import { runtimePresentation, presentationAge } from '../../lib/overviewRuntimePresentation.js';
import { Modal } from '../ui/Modal.js';
import { useOverviewRuntime, useRuntimeClock, useRuntimeItem, useRuntimeStatus } from './OverviewRuntimeProvider.js';
export function RuntimeDetails({ element, resolution, onClose }: { element: OverviewElement; resolution?: BindingResolution; onClose: () => void }) {
  const context = useOverviewRuntime()!;
  const sourceId = element.binding.source?.sourceType === 'SHARED_TAG' ? element.binding.source.sourceId ?? '' : '';
  const item = useRuntimeItem(context.adapter, sourceId), status = useRuntimeStatus(context.adapter), now = useRuntimeClock(context.adapter);
  const p = runtimePresentation(element, resolution, item, status.transport);
  const content = <Modal open title={`Runtime details — ${element.name}`} description="Read-only latest received data. Transport connected does not confirm replay catch-up or live freshness." onClose={onClose} footer={<button type="button" onClick={onClose}>Close details</button>}>
    <dl className="overview-runtime-details">
      <dt>Configuration caption</dt><dd>{element.style.text || '—'}</dd>
      <dt>Source identity</dt><dd>SHARED_TAG / {sourceId}</dd>
      <dt>Binding</dt><dd>{resolution?.status ?? 'NOT_BOUND'}</dd>
      <dt>Producer availability</dt><dd>{p.availability}</dd>
      <dt>Browser transport</dt><dd>{status.transport} · {status.message}</dd>
      <dt>{p.label} — full precision</dt><dd>{p.fullValue} {p.unit}</dd>
      <dt>Sample quality</dt><dd>{p.quality ?? 'No sample quality'}</dd>
      <dt>Reason</dt><dd>{p.reason}</dd>
      <dt>Receive timestamp (Server)</dt><dd>{item?.sample?.receiveTimestamp ?? 'Unavailable'}</dd>
      <dt>Source timestamp (Device)</dt><dd>{item?.sample?.sourceTimestamp ?? 'Not supplied by Device'}</dd>
      <dt>Last GOOD receive timestamp</dt><dd>{item?.sample?.lastGoodReceiveTimestamp ?? 'Unavailable'}</dd>
      <dt>Age of displayed value</dt><dd>{presentationAge(p.timestamp, now, status.transport)}</dd>
    </dl>
  </Modal>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
