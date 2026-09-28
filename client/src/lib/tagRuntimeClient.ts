import { canonicalTagSelection, snapshotReply, deliveryRange, type ClientTagItem, type TagIdentity } from './tagDeliveryProtocol.js';
import { reconnectDelay, DEFAULT_RECONNECT_POLICY } from '../reconnect.js';
export const TAG_CLIENT_LIMITS = Object.freeze({ identities: 200, subscriptions: 1, cacheBytes: 512 * 1024, frames: 64, pendingBytes: 512 * 1024, frameBytes: 64 * 1024, snapshotBytes: 512 * 1024, errorChars: 128 });
export interface TagClientSocket {
  readyState: number; send(data: string): void; close(): void;
  onopen: (() => void) | null; onmessage: ((event: { data: unknown }) => void) | null; onclose: (() => void) | null; onerror: (() => void) | null;
}
export interface TagClientIO {
  snapshot(sources: readonly TagIdentity[], signal: AbortSignal): Promise<unknown>;
  socket(): TagClientSocket;
  scheduleApply(callback: () => void): void;
}
/** Opt-in browser adapter; importing this module and constructing a client do not open sockets. */
export function browserTagIO(): TagClientIO {
  return {
    async snapshot(sources, signal) {
      const response = await fetch('/api/tag-runtime/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolVersion: 1, sources }), signal, cache: 'no-store' });
      if (!response.ok) throw Error(`SNAPSHOT_HTTP_${response.status}`);
      if (Number(response.headers.get('content-length')) > TAG_CLIENT_LIMITS.snapshotBytes) { await response.body?.cancel(); throw Error('SNAPSHOT_TOO_LARGE'); }
      const reader = response.body?.getReader(); if (!reader) throw Error('SNAPSHOT_BODY_MISSING');
      const decoder = new TextDecoder(); let text = '', bytes = 0;
      try { for (;;) { const result = await reader.read(); if (result.done) break; bytes += result.value.byteLength; if (bytes > TAG_CLIENT_LIMITS.snapshotBytes) { await reader.cancel(); throw Error('SNAPSHOT_TOO_LARGE'); } text += decoder.decode(result.value, { stream: true }); } text += decoder.decode(); }
      finally { reader.releaseLock(); }
      return JSON.parse(text);
    },
    socket: () => new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/tag-runtime`) as unknown as TagClientSocket,
    scheduleApply: callback => queueMicrotask(callback),
  };
}
export class TagRuntimeClient {
  readonly selection;
  private cache = new Map<string, ClientTagItem>();
  private cursor?: string; private epoch?: string; private subscription?: string;
  private pendingSubscribe?: string; private pendingUnsubscribe?: string; private lastSequence = 0;
  private socket?: TagClientSocket; private operation = 0; private generation = 0; private attempt = 0; private request = 0;
  private abort?: AbortController; private timer?: ReturnType<typeof setTimeout>; private ackTimer?: ReturnType<typeof setTimeout>; private deadline?: ReturnType<typeof setTimeout>;
  private queue: Array<{ data: string; bytes: number }> = []; private bytes = 0; private scheduled = false;
  private running = false; private stopping = false; private valid = false;
  transport: 'IDLE' | 'CONNECTING' | 'LIVE' | 'RECOVERING' | 'STOPPED' = 'IDLE';
  error = '';
  constructor(sources: unknown, private io: TagClientIO = browserTagIO(), private changed: () => void = () => {}) { const selected = canonicalTagSelection(sources); this.selection = Object.freeze({ ...selected, sources: Object.freeze(selected.sources.map(s => Object.freeze(s))) }); }
  get items() { return structuredClone([...this.cache.values()]); }
  get appliedCursor() { return this.cursor; }
  get pendingFrames() { return this.queue.length; }
  get pendingBytes() { return this.bytes; }
  start() { if (this.running) return; this.running = true; this.stopping = false; void this.connect(); }
  private notify() { try { this.changed(); } catch { /* Consumer callbacks cannot corrupt cursor bookkeeping. */ } }
  private async connect() {
    if (!this.running || this.stopping) return;
    const operation = ++this.operation; this.transport = 'CONNECTING'; this.notify();
    if (!this.running || operation !== this.operation) return;
    try {
      if (!this.valid) {
        const controller = new AbortController(); this.abort = controller;
        this.deadline = setTimeout(() => controller.abort(), 10000);
        const raw = await this.io.snapshot(this.selection.sources, controller.signal);
        if (operation !== this.operation || !this.running) return;
        if (new TextEncoder().encode(JSON.stringify(raw)).length > TAG_CLIENT_LIMITS.snapshotBytes) throw Error('SNAPSHOT_TOO_LARGE');
        const reply = snapshotReply.parse(raw);
        if (reply.selectionKey !== this.selection.key || reply.items.length !== this.selection.sources.length || new Set(reply.items.map(i => i.source.sourceId)).size !== reply.items.length || reply.items.some(i => !this.selection.sources.some(s => s.sourceId === i.source.sourceId) || i.sample && i.sample.serverEpoch !== reply.serverEpoch)) throw Error('SNAPSHOT_CONTEXT_MISMATCH');
        this.lastSequence = 0; this.cache = new Map(reply.items.map(item => [item.source.sourceId, item])); this.cursor = reply.cursor; this.epoch = reply.serverEpoch; this.valid = true;
        clearTimeout(this.deadline); this.deadline = undefined; this.abort = undefined;
      }
      const socket = this.io.socket(); this.socket = socket; const generation = ++this.generation;
      const current = () => this.running && this.operation === operation && this.socket === socket;
      this.deadline = setTimeout(() => { if (current()) this.recover(false, 'SUBSCRIBE_TIMEOUT'); }, 10000);
      socket.onopen = () => { if (current()) { try { this.pendingSubscribe = this.send({ type: 'subscribe', generation, sources: this.selection.sources, selectionKey: this.selection.key, cursor: this.cursor }); } catch { this.recover(false, 'SUBSCRIBE_SEND_FAILED'); } } };
      socket.onmessage = event => {
        if (!current()) return;
        if (typeof event.data !== 'string') { this.recover(true, 'INVALID_FRAME'); return; }
        const bytes = new TextEncoder().encode(event.data).length;
        if (bytes > TAG_CLIENT_LIMITS.frameBytes || this.queue.length >= TAG_CLIENT_LIMITS.frames || this.bytes + bytes > TAG_CLIENT_LIMITS.pendingBytes) { this.recover(true, 'CLIENT_OVERFLOW'); return; }
        this.queue.push({ data: event.data, bytes }); this.bytes += bytes;
        if (!this.scheduled) { this.scheduled = true; this.io.scheduleApply(() => { if (!current()) return; this.scheduled = false; this.drain(); }); }
      };
      socket.onclose = () => { if (current()) { if (this.stopping) this.dispose(); else this.recover(false, 'TRANSPORT_CLOSED'); } };
      socket.onerror = () => { if (current()) this.recover(false, 'TRANSPORT_ERROR'); };
    } catch { if (operation === this.operation && this.running) this.recover(true, 'SNAPSHOT_OR_CONNECT_FAILED'); }
  }
  private send(body: object) { const requestId = String(++this.request); const text = JSON.stringify({ protocolVersion: 1, requestId, ...body }); if (new TextEncoder().encode(text).length > TAG_CLIENT_LIMITS.frameBytes) throw Error('CONTROL_TOO_LARGE'); this.socket?.send(text); return requestId; }
  private drain() {
    try {
      while (this.queue.length && this.running) {
        const frame = this.queue.shift()!; this.bytes -= frame.bytes;
        const message = JSON.parse(frame.data) as Record<string, unknown>;
        if (message.protocolVersion !== 1) throw Error('PROTOCOL_MISMATCH');
        if (message.type === 'resync-required' || message.type === 'error') { this.recover(true, 'SERVER_RESYNC'); return; }
        if (!Number.isSafeInteger(message.generation)) throw Error('INVALID_GENERATION');
        if (message.generation !== this.generation) continue;
        if (message.serverEpoch !== this.epoch || message.selectionKey !== this.selection.key) throw Error('CONTEXT_MISMATCH');
        if (message.type === 'subscribed') {
          if (message.requestId !== this.pendingSubscribe || this.subscription || message.cursor !== this.cursor || typeof message.subscriptionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(message.subscriptionId)) throw Error('INVALID_SUBSCRIPTION');
          this.pendingSubscribe = undefined; this.subscription = message.subscriptionId; clearTimeout(this.deadline); this.deadline = undefined;
          this.transport = 'LIVE'; this.attempt = 0; this.error = ''; this.notify(); continue;
        }
        if (message.subscriptionId !== this.subscription) throw Error('SUBSCRIPTION_MISMATCH');
        if (message.type === 'unsubscribed') { if (!this.stopping || message.requestId !== this.pendingUnsubscribe) throw Error('UNEXPECTED_UNSUBSCRIBE'); this.dispose(); return; }
        const range = deliveryRange.parse(message);
        if (range.fromExclusive !== this.cursor || range.toInclusive === this.cursor || (range.type === 'checkpoint' && range.updates.length !== 0) || (range.type === 'delta' && range.updates.length === 0)) throw Error('DELIVERY_GAP');
        const next = new Map(this.cache); let sequence = this.lastSequence;
        for (const update of range.updates) {
          if (!next.has(update.item.source.sourceId) || update.deliverySequence <= sequence || update.item.sample && update.item.sample.serverEpoch !== this.epoch) throw Error('INVALID_UPDATE');
          sequence = update.deliverySequence; next.set(update.item.source.sourceId, update.item);
        }
        if (new TextEncoder().encode(JSON.stringify([...next.values()])).length > TAG_CLIENT_LIMITS.cacheBytes) throw Error('CLIENT_CACHE_OVERFLOW');
        this.lastSequence = sequence; this.cache = next; this.cursor = range.toInclusive; this.notify();
        if (this.running && this.subscription && !this.ackTimer && !this.stopping) this.ackTimer = setTimeout(() => { this.ackTimer = undefined; try { if (this.running && this.subscription) this.send({ type: 'ack', subscriptionId: this.subscription, generation: this.generation, cursor: this.cursor }); } catch { this.recover(false, 'ACK_SEND_FAILED'); } }, 100);
      }
    } catch { this.recover(true, 'INVALID_FRAME_OR_GAP'); }
  }
  private detach() {
    ++this.operation; this.abort?.abort(); this.abort = undefined;
    clearTimeout(this.timer); clearTimeout(this.ackTimer); clearTimeout(this.deadline); this.timer = this.ackTimer = this.deadline = undefined;
    const socket = this.socket; this.socket = undefined; if (socket) { socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null; socket.close(); }
    this.subscription = this.pendingSubscribe = this.pendingUnsubscribe = undefined; this.queue = []; this.bytes = 0; this.scheduled = false;
  }
  private recover(resnapshot: boolean, reason: string) {
    this.detach(); if (!this.running || this.stopping) { this.dispose(); return; }
    if (resnapshot) { this.valid = false; this.cache.clear(); this.cursor = this.epoch = undefined; }
    this.transport = 'RECOVERING'; this.error = reason.slice(0, TAG_CLIENT_LIMITS.errorChars); this.notify();
    const policy = reconnectDelay(this.attempt, DEFAULT_RECONNECT_POLICY); this.attempt = policy.nextAttempt;
    this.timer = setTimeout(() => { this.timer = undefined; void this.connect(); }, policy.delay);
  }
  unsubscribe() {
    if (!this.running || this.stopping) return;
    this.stopping = true; clearTimeout(this.ackTimer); this.ackTimer = undefined;
    if (!this.subscription || this.socket?.readyState !== 1) { this.dispose(); return; }
    try { this.pendingUnsubscribe = this.send({ type: 'unsubscribe', subscriptionId: this.subscription, generation: this.generation }); this.deadline = setTimeout(() => this.dispose(), 2000); } catch { this.dispose(); }
  }
  dispose() { if (!this.running && this.transport === 'STOPPED') return; this.running = false; this.stopping = false; this.detach(); this.valid = false; this.cache.clear(); this.cursor = this.epoch = undefined; this.transport = 'STOPPED'; this.notify(); }
}
