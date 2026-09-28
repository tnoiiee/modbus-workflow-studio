import type { ClientTagItem } from './tagDeliveryProtocol.js';
import { OVERVIEW_RUNTIME_LIMITS as L } from './overviewRuntimeSelection.js';
export type OverviewTransport = 'Connecting' | 'Connected' | 'Reconnecting' | 'Resynchronizing' | 'Offline' | 'Error' | 'Disposed';
export interface RuntimeStatus { transport: OverviewTransport; message: string; received: 'Snapshot' | 'Latest received'; pageId: string }
type Listener = () => void;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
/** Stable external store. No Page, Draft, React Flow, command or persistence references. */
export class OverviewRuntimeStore {
  private items = new Map<string, ClientTagItem>();
  private keyed = new Map<string, Set<Listener>>();
  private statusListeners = new Set<Listener>(); private clockListeners = new Set<Listener>();
  private clockTimer?: ReturnType<typeof setInterval>;
  private current: RuntimeStatus = Object.freeze({ transport: 'Disposed', message: 'No active Runtime session.', received: 'Snapshot', pageId: '' });
  private clock = Date.now(); private listenerCount = 0;
  payloadBytes = 0;
  get size() { return this.items.size; }
  get observers() { return this.listenerCount + this.statusListeners.size + this.clockListeners.size; }
  getItem = (id: string) => this.items.get(id);
  getStatus = () => this.current;
  getClock = () => this.clock;
  private emit(listeners?: Set<Listener>) { for (const listener of [...listeners ?? []]) { try { listener(); } catch { /* one view cannot break another */ } } }
  subscribeItem(id: string, listener: Listener) {
    if (this.listenerCount >= 256) return () => {};
    const set = this.keyed.get(id) ?? new Set<Listener>(); set.add(listener); this.keyed.set(id, set); this.listenerCount++;
    let off = false; return () => { if (off) return; off = true; set.delete(listener); this.listenerCount--; if (!set.size) this.keyed.delete(id); };
  }
  subscribeStatus = (listener: Listener) => { if (this.statusListeners.size >= 256) return () => {}; this.statusListeners.add(listener); return () => { this.statusListeners.delete(listener); }; };
  subscribeClock = (listener: Listener) => { if (this.clockListeners.size >= 256) return () => {}; this.clockListeners.add(listener); return () => { this.clockListeners.delete(listener); }; };
  setStatus(transport: OverviewTransport, message: string, pageId = this.current.pageId, received = this.current.received) {
    const next = { transport, message: message.slice(0, 256), pageId, received };
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.current = Object.freeze(next); this.emit(this.statusListeners);
  }
  publish(input: readonly ClientTagItem[], allowed: ReadonlySet<string>) {
    const total = bytes(input);
    if (input.length > L.identities || total > L.cacheBytes) throw Error('Overview presentation cache exceeds 512 KiB / 200 identities.');
    const next = new Map<string, ClientTagItem>(), changed = new Set<string>();
    for (const item of input) {
      const id = item.source.sourceId;
      if (!allowed.has(id) || next.has(id)) throw Error('Unexpected presentation identity.');
      const signature = JSON.stringify(item);
      if (JSON.stringify(this.items.get(id)) === signature) next.set(id, this.items.get(id)!);
      else { const copy = structuredClone(item); Object.freeze(copy.source); if (copy.sample) { Object.freeze(copy.sample.source); Object.freeze(copy.sample); } next.set(id, Object.freeze(copy)); changed.add(id); }
    }
    for (const id of this.items.keys()) if (!next.has(id)) changed.add(id);
    this.items = next; this.payloadBytes = total;
    for (const id of changed) this.emit(this.keyed.get(id));
    return changed.size;
  }
  clear() { const ids = [...this.items.keys()]; this.items.clear(); this.payloadBytes = 0; for (const id of ids) this.emit(this.keyed.get(id)); }
  startClock() { this.stopClock(); this.clock = Date.now(); this.emit(this.clockListeners); this.clockTimer = setInterval(() => { this.clock = Date.now(); this.emit(this.clockListeners); }, L.ageMs); }
  stopClock() { clearInterval(this.clockTimer); this.clockTimer = undefined; }
}
