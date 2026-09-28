import { randomUUID } from 'node:crypto';
import type { WebSocket, RawData } from 'ws';
import { controlSchema, DeliveryError, TAG_DELIVERY_LIMITS as L, selection, type DeliveryEvent } from './tagDeliveryContract.js';
import type { TagDeliveryBroker } from './tagDeliveryBroker.js';
import { DeliveryRate } from './tagDeliveryAdmission.js';
type Frame = { payload: string; bytes: number; subscriptionId?: string };
export class TagOutboundQueue {
  private frames: Frame[] = []; bytes = 0;
  constructor(private maxCount = L.queueCount as number, private maxBytes = L.queueBytes as number) {}
  push(value: object, subscriptionId?: string) { const payload = JSON.stringify(value), bytes = Buffer.byteLength(payload); if (bytes > L.frameBytes || this.frames.length >= this.maxCount || this.bytes + bytes > this.maxBytes) return false; this.frames.push({ payload, bytes, subscriptionId }); this.bytes += bytes; return true; }
  shift() { const frame = this.frames.shift(); if (frame) this.bytes -= frame.bytes; return frame; }
  remove(id: string) { this.frames = this.frames.filter(frame => frame.subscriptionId !== id); this.bytes = this.frames.reduce((sum, frame) => sum + frame.bytes, 0); }
  clear() { this.frames = []; this.bytes = 0; }
  get count() { return this.frames.length; }
}
type Subscription = { id: string; generation: number; key: string; ids: Set<string>; after: number; acked: number; boundaries: Set<number>; pendingSince?: number; checkpointAt: number; release: () => void };
/** One bounded session per admitted connection. No Store subscription or Modbus interaction here. */
export class TagSocketSession {
  readonly queue = new TagOutboundQueue();
  private subscriptions = new Map<string, Subscription>();
  private lastGeneration = 0; private invalid = 0; private closing = false; private sending = false;
  private killTimer?: ReturnType<typeof setTimeout>;
  private rates: Record<'subscribe' | 'unsubscribe' | 'ack', DeliveryRate>;
  constructor(private socket: WebSocket, private broker: TagDeliveryBroker, private now = () => performance.now()) {
    this.rates = { subscribe: new DeliveryRate(2, 4, now), unsubscribe: new DeliveryRate(4, 8, now), ack: new DeliveryRate(64, 128, now) };
    socket.on('message', this.message); socket.on('close', this.dispose); socket.on('error', this.socketError);
  }
  private socketError = () => { this.dispose(); this.socket.terminate(); };
  get count() { return this.subscriptions.size; }
  private envelope(sub: Subscription) { return { protocolVersion: 1, serverEpoch: this.broker.serverEpoch, subscriptionId: sub.id, generation: sub.generation, selectionKey: sub.key }; }
  private enqueue(frame: object, id?: string) { if (!this.queue.push(frame, id)) { this.abort('QUEUE_OVERFLOW'); return false; } return true; }
  private message = (raw: RawData, binary: boolean) => {
    if (this.closing) return;
    const bytes = Array.isArray(raw) ? raw.reduce((n, b) => n + b.length, 0) : raw.byteLength;
    if (binary || bytes > L.controlBytes) { this.abort('CONTROL_TOO_LARGE'); return; }
    let input: unknown; try { input = JSON.parse(raw.toString()); } catch { this.bad('INVALID_JSON'); return; }
    const result = controlSchema.safeParse(input);
    if (!result.success) { this.bad((input as { protocolVersion?: unknown })?.protocolVersion !== 1 ? 'UNSUPPORTED_PROTOCOL' : 'INVALID_CONTROL'); return; }
    const message = result.data;
    if (!this.rates[message.type].take()) { this.abort('CONTROL_RATE_LIMIT'); return; }
    try {
      if (message.type === 'subscribe') {
        if (message.generation <= this.lastGeneration) throw new DeliveryError('STALE_GENERATION');
        if (this.subscriptions.size >= L.subscriptions) throw new DeliveryError('SUBSCRIPTION_LIMIT', 429);
        const selected = selection(message.sources), ids = new Set([...this.subscriptions.values()].flatMap(s => [...s.ids]));
        selected.sources.forEach(s => ids.add(s.sourceId)); if (ids.size > L.connectionIdentities) throw new DeliveryError('CONNECTION_IDENTITY_LIMIT', 429);
        const acquired = this.broker.acquire(selected.sources, message.selectionKey, message.cursor);
        const sub: Subscription = { id: randomUUID(), generation: message.generation, key: selected.key, ids: new Set(selected.sources.map(s => s.sourceId)), after: acquired.after, acked: acquired.after, boundaries: new Set(), checkpointAt: -Infinity, release: acquired.release };
        this.subscriptions.set(sub.id, sub); this.lastGeneration = message.generation;
        this.enqueue({ ...this.envelope(sub), type: 'subscribed', requestId: message.requestId, cursor: message.cursor }, sub.id);
      } else {
        const sub = this.subscriptions.get(message.subscriptionId); if (!sub) throw new DeliveryError('UNKNOWN_SUBSCRIPTION');
        if (message.generation !== sub.generation) return; // stale control cannot affect a replacement
        if (message.type === 'unsubscribe') {
          this.subscriptions.delete(sub.id); sub.release(); this.queue.remove(sub.id);
          this.enqueue({ ...this.envelope(sub), type: 'unsubscribed', requestId: message.requestId });
        } else {
          const sequence = this.broker.decode(message.cursor, sub.key);
          if (sequence === sub.acked) return;
          if (sequence < sub.acked || !sub.boundaries.has(sequence)) throw new DeliveryError('INVALID_ACK');
          sub.acked = sequence; for (const n of sub.boundaries) if (n <= sequence) sub.boundaries.delete(n);
          sub.pendingSince = sub.acked < sub.after ? this.now() : undefined;
        }
      }
      this.tick();
    } catch (error) {
      const fault = error instanceof DeliveryError ? error : new DeliveryError('DELIVERY_UNAVAILABLE', 503);
      if (fault.status === 409 || fault.status === 503) this.abort(fault.code, message.requestId);
      else this.bad(fault.code, message.requestId);
    }
  };
  private bad(code: string, requestId?: string) { if (++this.invalid >= 3) { this.abort(code, requestId); return; } this.enqueue({ protocolVersion: 1, type: 'error', requestId, code }); this.flush(); }
  tick() {
    if (this.closing) return;
    if (this.socket.bufferedAmount > L.bufferedBytes) { this.abort('SOCKET_BACKPRESSURE'); return; }
    try {
      for (const sub of this.subscriptions.values()) {
        if (sub.pendingSince !== undefined && this.now() - sub.pendingSince >= L.ackMs) { this.abort('ACK_TIMEOUT'); return; }
        const events = this.broker.range(sub.after); if (!events.length) continue;
        const updates: DeliveryEvent[] = []; let to = sub.after;
        const base = { ...this.envelope(sub), fromExclusive: this.broker.cursor(sub.key, sub.after) };
        for (const event of events) {
          const relevant = sub.ids.has(event.item.source.sourceId);
          if (relevant) updates.push(event);
          const candidate = { ...base, type: updates.length ? 'delta' : 'checkpoint', toInclusive: this.broker.cursor(sub.key, event.deliverySequence), updates };
          if (Buffer.byteLength(JSON.stringify(candidate)) > L.frameBytes) { if (relevant) updates.pop(); if (to === sub.after) { this.abort('FRAME_TOO_LARGE'); return; } break; }
          to = event.deliverySequence;
        }
        if (!updates.length && this.now() - sub.checkpointAt < L.checkpointMs) continue;
        if (sub.boundaries.size >= L.queueCount) { this.abort('UNACKNOWLEDGED_LIMIT'); return; }
        if (!this.enqueue({ ...base, type: updates.length ? 'delta' : 'checkpoint', toInclusive: this.broker.cursor(sub.key, to), updates }, sub.id)) return;
        sub.after = to; sub.boundaries.add(to); sub.pendingSince ??= this.now(); sub.checkpointAt = this.now();
      }
      this.flush();
    } catch (error) { this.abort(error instanceof DeliveryError ? error.code : 'DELIVERY_UNAVAILABLE'); }
  }
  private flush() {
    if (this.sending || this.closing || this.socket.readyState !== 1) return;
    if (this.socket.bufferedAmount > L.bufferedBytes) { this.abort('SOCKET_BACKPRESSURE'); return; }
    const frame = this.queue.shift(); if (!frame) return;
    if (this.socket.bufferedAmount + frame.bytes > L.bufferedBytes) { this.abort('SOCKET_BACKPRESSURE'); return; }
    this.sending = true;
    this.socket.send(frame.payload, error => { this.sending = false; if (error) this.abort('SEND_FAILED'); else this.flush(); });
  }
  private abort(reason: string, requestId?: string) {
    if (this.closing) return;
    this.dispose();
    const frame = JSON.stringify({ protocolVersion: 1, type: 'resync-required', reason, requestId, serverEpoch: this.broker.serverEpoch });
    if (this.socket.readyState === 1 && this.socket.bufferedAmount + Buffer.byteLength(frame) <= L.bufferedBytes) this.socket.send(frame, () => this.socket.close(1013, 'Tag resynchronization required'));
    else this.socket.terminate();
    if (this.socket.readyState !== 3) { this.killTimer = setTimeout(() => this.socket.terminate(), 1000); this.killTimer.unref?.(); }
  }
  dispose = () => {
    this.closing = true; this.queue.clear(); for (const sub of this.subscriptions.values()) sub.release(); this.subscriptions.clear();
    if (this.killTimer) clearTimeout(this.killTimer);
    this.socket.off('message', this.message);
  };
}
