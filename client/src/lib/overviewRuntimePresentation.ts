import type { OverviewElement } from './overviewElements.js';
import type { BindingResolution } from './overviewBinding.js';
import type { ClientTagItem } from './tagDeliveryProtocol.js';
import type { OverviewTransport } from './overviewRuntimeStore.js';
export function captionText(text: string, max = 120) { const points = Array.from(text); return points.length <= max ? text : points.slice(0, max).join('') + '…'; }
export function formatRuntimeNumber(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Object.is(value, -0) ? 0 : value, size = Math.abs(n);
  if (size !== 0 && (size >= 1e9 || size < 1e-6)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  const fixed = n.toFixed(6).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return fixed.length > 16 ? n.toExponential(6) : fixed;
}
export function receivedAge(timestamp: string | null | undefined, now: number) {
  if (!timestamp) return 'No receive timestamp';
  const at = Date.parse(timestamp); if (!Number.isFinite(at)) return 'Invalid receive timestamp';
  if (at > now) return 'Age unavailable: clock skew';
  const seconds = Math.floor((now - at) / 1000);
  return seconds < 60 ? `${seconds}s since receive` : seconds < 3600 ? `${Math.floor(seconds / 60)}m since receive` : `${Math.floor(seconds / 3600)}h since receive`;
}
export function presentationAge(timestamp: string | null | undefined, now: number, transport: OverviewTransport) {
  if (['Offline', 'Error', 'Disposed'].includes(transport) && timestamp && Number.isFinite(Date.parse(timestamp))) return `Received at ${timestamp} (age paused)`;
  return receivedAge(timestamp, now);
}
const availabilityLabels: Record<ClientTagItem['availability'], string> = {
  AVAILABLE: 'Available', DEFINITION_MISSING: 'Definition missing', DEFINITION_DISABLED: 'Definition disabled', UNCONFIGURED: 'Mapping unconfigured',
  MAPPING_DISABLED: 'Mapping disabled', DEVICE_MISSING: 'Device missing', DEVICE_DISABLED: 'Device disabled', UNSUPPORTED: 'Unsupported producer',
  INCOMPATIBLE: 'Incompatible producer', NO_SAMPLE: 'No sample yet', DISCONNECTED: 'Device disconnected',
};
export function runtimePresentation(element: OverviewElement, resolution: BindingResolution | undefined, item: ClientTagItem | undefined, transport: OverviewTransport) {
  const sample = item?.sample, definition = resolution?.definition;
  let availability = item ? availabilityLabels[item.availability] : 'Awaiting Snapshot';
  let reason = item?.reason ?? 'No Runtime sample received.';
  let value: number | boolean | null = null, historical = false;
  const expected = definition?.dataType;
  const compatible = (v: unknown): v is number | boolean => expected === 'Number' ? typeof v === 'number' && Number.isFinite(v) : expected === 'Boolean' && typeof v === 'boolean';
  const eligible = resolution?.status === 'BOUND' && element.binding.source?.sourceType === 'SHARED_TAG';
  if (!eligible) { availability = resolution?.status === 'MISSING' ? 'Definition missing' : definition?.enabled === false ? 'Definition disabled' : resolution?.status ?? 'NOT_BOUND'; reason = resolution?.reason ?? 'No Source binding.'; }
  if (element.binding.source?.sourceType === 'WORKFLOW_VARIABLE' && resolution?.status === 'BOUND') { availability = 'Unsupported producer'; reason = 'WORKFLOW_VARIABLE Runtime is not enabled.'; }
  const unsupportedString = expected === 'String' || element.type === 'TEXT_LABEL' || element.binding.dataType === 'String';
  if (eligible && unsupportedString) { availability = item && item.availability !== 'AVAILABLE' ? availabilityLabels[item.availability] : 'Unsupported producer'; reason = 'General String acquisition is not supported. Caption is configuration, not process data.'; }
  else if (eligible && sample && sample.dataType === expected) {
    if (item?.availability === 'AVAILABLE' && sample.hasValue && compatible(sample.value) && ['GOOD', 'UNCERTAIN', 'STALE'].includes(sample.quality)) value = sample.value;
    else if (compatible(sample.lastGoodValue) && sample.lastGoodReceiveTimestamp) { value = sample.lastGoodValue; historical = true; }
  }
  const invalid = !!(eligible && !unsupportedString && sample && (sample.dataType !== expected || sample.hasValue && !compatible(sample.value)));
  if (invalid) { value = null; historical = false; reason = 'Invalid Runtime value/type; no process value displayed.'; }
  const cached = !['Connected'].includes(transport);
  const quality = sample?.quality ?? null;
  const label = historical ? 'Last good' : cached && value !== null ? 'Cached · latest received' : 'Latest received';
  const text = value === null ? '—' : typeof value === 'boolean' ? value ? 'TRUE' : 'FALSE' : formatRuntimeNumber(value) ?? '—';
  const timestamp = historical ? sample?.lastGoodReceiveTimestamp : sample?.receiveTimestamp;
  const tone = invalid || quality === 'BAD' ? 'bad' : historical || item?.availability === 'DISCONNECTED' || quality === 'DISCONNECTED' ? 'disconnected'
    : quality === 'STALE' ? 'stale' : cached ? 'cached' : quality === 'UNCERTAIN' ? 'uncertain' : value !== null && quality === 'GOOD' ? 'good' : 'unavailable';
  const displayState = invalid ? 'Invalid sample' : historical ? `Last good · ${quality ?? availability}` : cached && value !== null ? `Cached · ${quality ?? availability}` : value === null ? `${availability}${quality ? ` · ${quality}` : ''}` : quality ?? availability;
  return { displayState, binding: resolution?.status ?? 'NOT_BOUND', text, value, label, historical, cached, quality, availability, reason, timestamp, tone,
    unit: expected === 'Number' ? definition?.unit ?? '' : '',
    lamp: !historical && !cached && quality === 'GOOD' && item?.availability === 'AVAILABLE' && typeof value === 'boolean' ? value ? 'true' : 'false' : 'unavailable',
    fullValue: value === null ? 'No process value' : typeof value === 'boolean' ? value ? 'TRUE' : 'FALSE' : String(Object.is(value, -0) ? 0 : value),
  };
}

/** Operator wording only. Canonical value/quality/availability projection above is unchanged. */
export function operatorRuntimeStatus(p: ReturnType<typeof runtimePresentation>, age: string) {
  const history = p.historical ? 'Last good · ' : '';
  if (p.displayState === 'Invalid sample') return 'Invalid sample';
  if (p.availability === 'Unsupported producer' || p.reason.startsWith('General String acquisition')) return 'Unsupported producer';
  if (p.binding !== 'BOUND') return ({ NOT_BOUND: 'Not configured', DRAFT: 'Configuration pending', MISSING: 'Source unavailable', INCOMPATIBLE: 'Configuration mismatch' } as Record<string, string>)[p.binding] ?? 'Not configured';
  if (p.availability === 'Device disconnected' || p.quality === 'DISCONNECTED') return `${history}Device disconnected`;
  if (p.quality === 'BAD') return `${history}BAD sample`;
  if (!['Available', 'Awaiting Snapshot', 'No sample yet'].includes(p.availability)) return `${history}${p.availability}`;
  if (p.value === null) return 'Awaiting data';
  const cached = p.cached && !p.historical ? 'Cached · ' : history;
  if (p.quality === 'STALE') return `${cached}STALE · ${age.startsWith('Received at ') ? 'Age paused; see details' : age}`;
  if (p.quality === 'UNCERTAIN') return `${cached}UNCERTAIN`;
  if (p.historical) return 'Last good · Awaiting data';
  return p.cached ? 'Cached · latest received' : '';
}
/** Diagnostic readout, not a new value producer or coercion path. */
export function runtimeDiagnosticValue(value: unknown, dataType: string | undefined) {
  return dataType === 'Number' && typeof value === 'number' && Number.isFinite(value) ? String(Object.is(value, -0) ? 0 : value)
    : dataType === 'Boolean' && typeof value === 'boolean' ? value ? 'TRUE' : 'FALSE' : 'Unavailable';
}
/** Page summary reads existing cache on the existing age tick, not per-sample observers. */
export function runtimeHealthCounts(items: readonly (ClientTagItem | undefined)[]) {
  const counts = { stale: 0, unavailable: 0, uncertain: 0 };
  for (const item of items) {
    const sample = item?.sample;
    if (!item || item.availability !== 'AVAILABLE' || !sample?.hasValue || sample.quality === 'BAD' || sample.quality === 'DISCONNECTED') counts.unavailable++;
    else if (sample.quality === 'STALE') counts.stale++;
    else if (sample.quality === 'UNCERTAIN') counts.uncertain++;
  }
  return counts;
}
