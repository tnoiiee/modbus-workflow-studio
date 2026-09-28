/** Deterministic test fixtures; never imported by application composition. */
import { vi } from 'vitest';
import { createOverviewElement, patchOverviewBinding, type OverviewElementType } from './overviewElements.js';
import { resolveOverviewBinding } from './overviewBinding.js';
import { overviewRuntimeSelection } from './overviewRuntimeSelection.js';
import type { SourceDefinition } from './sourceDefinitions.js';
import { canonicalTagSelection, type ClientTagItem, type TagIdentity } from './tagDeliveryProtocol.js';
import type { TagClientIO, TagClientSocket } from './tagRuntimeClient.js';
import { OverviewTagClientAdapter } from './overviewTagClientAdapter.js';
import { OverviewRuntimeStore } from './overviewRuntimeStore.js';
export const id = (n = 1) => `${n.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
export const epoch = id(900), subscriptionId = id(901), time = '2026-09-28T00:00:00.000Z';
export function configuration(n = 1, type: OverviewElementType = 'NUMERIC_LABEL') {
  const dataType = type === 'STATUS_LIGHT' || type === 'SWITCH' || type === 'PUSH_BUTTON' ? 'Boolean' : type === 'TEXT_LABEL' ? 'String' : 'Number';
  const definition: SourceDefinition = { sourceType: 'SHARED_TAG', sourceId: id(n), name: `Tag ${n}`, dataType, capability: 'MONITOR_AND_COMMAND', enabled: true, unit: 'bar', description: '' };
  const element = createOverviewElement(type, { id: `element-${n}`, x: 0, y: 0 });
  element.binding = patchOverviewBinding(element.category, element.binding, { source: { sourceType: 'SHARED_TAG', sourceId: id(n) }, dataType });
  const resolution = resolveOverviewBinding(element, { definitions: [definition], available: true });
  const selection = overviewRuntimeSelection([element], { [element.id]: resolution });
  return { element, definition, resolution, selection };
}
export function sampleItem(n = 1, value: number | boolean = 0, quality: NonNullable<ClientTagItem['sample']>['quality'] = 'GOOD'): ClientTagItem {
  const source = { sourceType: 'SHARED_TAG' as const, sourceId: id(n) };
  return { source, availability: quality === 'DISCONNECTED' ? 'DISCONNECTED' : 'AVAILABLE', reason: 'READ_OK', sample: { source, dataType: typeof value === 'boolean' ? 'Boolean' : 'Number', value, hasValue: true, quality, reason: 'READ_OK', sourceTimestamp: null, receiveTimestamp: time, stateUpdatedAt: time, serverEpoch: epoch, sampleSequence: 1, lastGoodValue: value, lastGoodReceiveTimestamp: time } };
}
export class RuntimeSocket implements TagClientSocket {
  readyState = 0; sent: any[] = []; onopen: (() => void) | null = null; onmessage: ((event: { data: unknown }) => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  send(data: string) { this.sent.push(JSON.parse(data)); } close() { this.readyState = 3; }
  receive(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
  open() { this.readyState = 1; this.onopen?.(); }
}
export async function settle() { for (let n = 0; n < 8; n++) await Promise.resolve(); }
export function harness() {
  const sockets: RuntimeSocket[] = [], store = new OverviewRuntimeStore(); let serverEpoch = epoch;
  const io: TagClientIO = {
    snapshot: vi.fn(async (sources: readonly TagIdentity[]) => ({ protocolVersion: 1, scope: 'TAG_RUNTIME', serverEpoch, cursor: 'cursor-0', capturedAt: time, selectionKey: canonicalTagSelection(sources).key, items: sources.map(s => ({ source: s, availability: 'NO_SAMPLE', reason: 'NO_SAMPLE', sample: null })) })),
    socket: vi.fn(() => { const s = new RuntimeSocket(); sockets.push(s); return s; }), scheduleApply: fn => fn(),
  };
  const adapter = new OverviewTagClientAdapter(store, io, () => Date.now());
  const socket = () => sockets.at(-1)!;
  const context = () => { const sub = socket().sent.find(m => m.type === 'subscribe'); return { protocolVersion: 1, serverEpoch, selectionKey: sub.selectionKey, generation: sub.generation, subscriptionId }; };
  const accept = () => { socket().open(); const sub = socket().sent.at(-1); socket().receive({ ...context(), type: 'subscribed', requestId: sub.requestId, cursor: sub.cursor }); };
  const delta = (from: string, to: string, item = sampleItem(), sequence = 1) => socket().receive({ ...context(), type: 'delta', fromExclusive: from, toInclusive: to, updates: [{ kind: 'updated', deliverySequence: sequence, item }] });
  return { store, io, adapter, socket, sockets, context, accept, delta, restart: () => { serverEpoch = id(902); } };
}
