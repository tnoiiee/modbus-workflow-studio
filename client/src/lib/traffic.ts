/** Presentation only. No producer identity, transport protocol, transaction grouping or persistence. */
export const TRAFFIC_RETENTION = 5000;
export const TRAFFIC_PREVIEW_CHARS = 96;
export const TRAFFIC_DETAIL_CHARS = 16384;
export const TRAFFIC_PAGE_SIZE = 50;
export const TRAFFIC_COLUMNS = ['Timestamp', 'Phase', 'Device', 'Origin / context', 'Transaction', 'Function', 'Address', 'Duration', 'Result', 'Payload / error'] as const;
export type TrafficPhase = 'TX' | 'RX' | 'ERROR' | 'Unspecified';
export type TrafficOrigin = 'Workflow' | 'Modbus Monitor' | 'Shared Tag Acquisition' | 'Generic / Unspecified';
export interface TrafficRow {
  key: string; timestamp: string | null; direction: string | null; phase: TrafficPhase; deviceId: string | null;
  origin: TrafficOrigin; workflowId: string | null; nodeId: string | null; monitorListId: string | null;
  tx: number | null; fc: number | null; address: number | null; quantity: number | null;
  requestClass: string | null; duration: number | null; result: string | null;
  payload: string | null; error: string | null; encodedPayload: string | null; malformed: boolean;
}
// Only primitive own data properties. Never invoke getters, toString or JSON serialization on arbitrary rows.
function own(value: unknown, key: string): unknown {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const property = Object.getOwnPropertyDescriptor(value, key);
    return property && 'value' in property ? property.value : undefined;
  } catch { return undefined; }
}
function string(value: unknown): string | null { return typeof value === 'string' && value.length > 0 ? value : null; }
function number(value: unknown, integer = false): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && (!integer || Number.isInteger(value)) ? value : null; }
/** Bound before escaping so pathological input never causes an unbounded intermediate allocation. */
export function trafficText(value: string | null, limit = TRAFFIC_PREVIEW_CHARS): string {
  if (value === null || value === '') return '—';
  const escaped = value.slice(0, limit).replace(/[\u0000-\u001f\u007f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return escaped.slice(0, limit) + (value.length > limit || escaped.length > limit ? '…' : '');
}
export function normalizeTrafficRow(raw: unknown): Omit<TrafficRow, 'key'> {
  const text = (key: string) => string(own(raw, key));
  const valueText = (key: string) => { const value = own(raw, key); return typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) ? String(value) : string(value); };
  const metadata = (key: string) => { const s = text(key); return s === null ? null : trafficText(s, 256); };
  const numeric = (key: string) => number(own(raw, key), true);
  const direction = metadata('direction'), requestClass = metadata('requestClass');
  const workflowId = metadata('workflowId'), nodeId = metadata('nodeId'), monitorListId = metadata('monitorListId');
  const phase: TrafficPhase = direction === 'TX' || direction === 'RX' || direction === 'ERROR' ? direction : 'Unspecified';
  const origin: TrafficOrigin = requestClass === 'acquisition' ? 'Shared Tag Acquisition'
    : requestClass === 'monitor' || monitorListId !== null || (workflowId?.startsWith('monitor:') && workflowId.length > 8) ? 'Modbus Monitor'
    : workflowId !== null ? 'Workflow' : 'Generic / Unspecified';
  return { timestamp: metadata('timestamp'), direction, phase, deviceId: metadata('deviceId'), origin,
    workflowId, nodeId, monitorListId, tx: numeric('tx'), fc: numeric('fc'), address: numeric('address'), quantity: numeric('quantity'),
    requestClass, duration: number(own(raw, 'duration')), result: valueText('result'), payload: valueText('payload'), error: valueText('error'), encodedPayload: valueText('encodedPayload'),
    malformed: phase === 'Unspecified' || metadata('timestamp') === null || metadata('deviceId') === null,
  };
}
function fingerprint(row: Omit<TrafficRow, 'key'>): string {
  const composite = [row.timestamp, row.direction, row.deviceId, row.workflowId, row.nodeId, row.monitorListId, row.tx, row.fc, row.address, row.requestClass].join('|');
  let hash = 2166136261;
  for (let i = 0; i < composite.length; i++) hash = Math.imul(hash ^ composite.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
/** Reconcile immutable REST/WS record objects in received order. No record equality deduplication.
 * Keys combine a bounded content fingerprint with a view-local arrival ordinal. Not globally unique.
 * Cache only current retention; a new REST snapshot may give old records new local keys.
 */
export class TrafficPresentation {
  private ordinal = 0;
  private retained = new Map<unknown, TrafficRow[]>();
  normalize(input: unknown): TrafficRow[] {
    const records: unknown[] = Array.isArray(input) ? input.slice(0, TRAFFIC_RETENTION) : [input];
    const next = new Map<unknown, TrafficRow[]>(), used = new Map<unknown, number>();
    const result = records.map(raw => {
      const occurrence = used.get(raw) ?? 0; used.set(raw, occurrence + 1);
      let row = this.retained.get(raw)?.[occurrence];
      if (!row) { const model = normalizeTrafficRow(raw); row = { ...model, key: `traffic-${fingerprint(model)}-${++this.ordinal}` }; }
      const bucket = next.get(raw) ?? []; bucket.push(row); next.set(raw, bucket);
      return row;
    });
    this.retained = next; return result;
  }
  get retainedCount() { let count = 0; for (const rows of this.retained.values()) count += rows.length; return count; }
}
