import { TagRuntimeClient, browserTagIO, type TagClientIO } from './tagRuntimeClient.js';
import { OverviewRuntimeStore, type OverviewTransport } from './overviewRuntimeStore.js';
import { OVERVIEW_RUNTIME_LIMITS as L, type RuntimeSelection } from './overviewRuntimeSelection.js';
/** Fixed-size rolling budget. Manual Retry never erases the automatic-attempt window. */
export class OverviewRecoveryBudget {
  private attempts: number[] = [];
  take(now: number) { this.attempts = this.attempts.filter(at => now - at < L.recoveryWindowMs); if (this.attempts.length >= L.recoveryAttempts) return false; this.attempts.push(now); return true; }
  full(now: number) { this.attempts = this.attempts.filter(at => now - at < L.recoveryWindowMs); return this.attempts.length >= L.recoveryAttempts; }
  resetAfterStableSession(duration: number) { if (duration >= L.recoveryWindowMs) this.attempts = []; }
}
/** O2-B2 composition only: delegates all REST, WS, apply, cursor, ACK and reconnect work. */
export class OverviewTagClientAdapter {
  private client?: TagRuntimeClient; private generation = 0; private publishTimer?: ReturnType<typeof setTimeout>;
  private selection?: RuntimeSelection; private pageId = ''; private allowed = new Set<string>();
  private active = false; private paused = false; private blocked = false; private lastPublication = -Infinity;
  private lastManual = -Infinity; private budget = new OverviewRecoveryBudget(); private connectedAt?: number;
  private failure = '';
  constructor(readonly store = new OverviewRuntimeStore(), private io: TagClientIO = browserTagIO(), private now = () => performance.now()) {}
  activate(pageId: string, selection: RuntimeSelection) {
    this.stop(); this.pageId = pageId; this.selection = selection; this.blocked = false;
    if (selection.error || !selection.sources.length) { this.store.setStatus(selection.error ? 'Error' : 'Disposed', selection.error || 'No eligible SHARED_TAG bindings.', pageId); return; }
    this.allowed = new Set(selection.sources.map(s => s.sourceId)); this.active = true;
    // StrictMode setup/cleanup/setup fences the first scheduled start before it can issue I/O.
    const token = this.generation; queueMicrotask(() => { if (token === this.generation && this.active && !this.paused) this.begin(); });
  }
  private release() {
    ++this.generation; clearTimeout(this.publishTimer); this.publishTimer = undefined; this.store.stopClock();
    const previous = this.client; this.client = undefined;
    if (previous) { previous.unsubscribe(); previous.dispose(); }
    if (this.connectedAt !== undefined) this.budget.resetAfterStableSession(this.now() - this.connectedAt);
    this.connectedAt = undefined;
  }
  stop() { this.active = false; this.paused = false; this.release(); this.store.clear(); this.store.setStatus('Disposed', 'Runtime session disposed.'); }
  pause(offline: boolean) { if (!this.active) return; this.paused = true; this.release(); this.store.setStatus(offline ? 'Offline' : 'Disposed', offline ? 'Browser offline. Cached data is historical.' : 'Tab hidden. Delivery paused; fresh snapshot on return.'); }
  resume() { if (!this.active || !this.paused) return; this.paused = false; if (this.blocked) { this.store.setStatus('Error', 'Automatic recovery stopped. Use Retry.'); return; } this.begin(); }
  retry() {
    if (!this.active || this.paused || this.now() - this.lastManual < L.retryMs) return false;
    this.lastManual = this.now(); this.blocked = false; this.begin(); return true;
  }
  private halt(message: string) { this.blocked = true; this.release(); this.store.setStatus('Error', message); }
  private begin() {
    if (!this.active || this.paused || !this.selection) return;
    this.release(); const token = this.generation, selection = this.selection;
    this.store.clear(); this.lastPublication = -Infinity; this.failure = ''; this.store.startClock();
    let initial = true, recovery = false, freshSnapshot = false;
    const current = () => token === this.generation && this.active && !this.paused;
    const cancelAfterCallback = (message: string) => queueMicrotask(() => { if (current()) this.halt(message); });
    const composed: TagClientIO = {
      snapshot: async (sources, signal) => {
        try { const reply = await this.io.snapshot(sources, signal); if (current()) freshSnapshot = true; return reply; }
        catch (error) {
          if (current()) { const code = error instanceof Error ? error.message : ''; this.failure = /^SNAPSHOT_HTTP_\d{3}$|^SNAPSHOT_TOO_LARGE$/.test(code) ? code : 'Snapshot request failed. Check Server, network and proxy/Origin settings.'; }
          throw error;
        }
      },
      socket: () => {
        if (!current()) throw Error('Disposed Overview session');
        // Approved B2 calls this factory only AFTER validating and applying its snapshot.
        // No second request, decode path, socket, or snapshot cache is created here.
        if (freshSnapshot) {
          freshSnapshot = false; this.store.setStatus('Connecting', 'Snapshot received; subscription not yet established.', this.pageId, 'Snapshot');
          this.publish(token);
        }
        if (!current()) throw Error('Disposed Overview session');
        return this.io.socket();
      },
      scheduleApply: callback => this.io.scheduleApply(() => { if (current()) callback(); }),
    };
    const client = new TagRuntimeClient(selection.sources, composed, () => {
      if (!current()) return;
      if (client.transport === 'CONNECTING') {
        if (!initial && recovery && !this.budget.take(this.now())) {
          // B2 connect() rechecks operation/running immediately after this notification.
          this.halt('Automatic recovery budget exhausted (5 attempts / 60s). Use Retry.'); return;
        }
        initial = false; recovery = false;
        this.store.setStatus(client.appliedCursor ? 'Reconnecting' : 'Connecting', client.appliedCursor ? 'Reconnecting; cached values are not current.' : 'Requesting Snapshot / connecting.', this.pageId);
      } else if (client.transport === 'LIVE') {
        this.connectedAt ??= this.now(); this.failure = '';
        this.store.setStatus('Connected', 'Transport connected. Latest received only; replay catch-up is not confirmed.', this.pageId, 'Latest received');
        this.schedulePublication(token);
      } else if (client.transport === 'RECOVERING') {
        if (this.connectedAt !== undefined) this.budget.resetAfterStableSession(this.now() - this.connectedAt);
        this.connectedAt = undefined; recovery = true;
        if (!client.appliedCursor) this.store.clear();
        const message = this.failure || (client.appliedCursor ? 'Reconnecting. Cached data is historical.' : 'Resynchronizing: requesting a new Snapshot.');
        this.store.setStatus(client.appliedCursor ? 'Reconnecting' : 'Resynchronizing', message, this.pageId);
        if (this.budget.full(this.now())) cancelAfterCallback('Automatic recovery budget exhausted (5 attempts / 60s). Use Retry.');
        if (/SNAPSHOT_HTTP_(400|403|413)|SNAPSHOT_TOO_LARGE/.test(this.failure)) cancelAfterCallback(this.failure + '. Check selection / server policy, then Retry.');
      }
    });
    this.client = client; client.start();
  }
  private schedulePublication(token: number) {
    if (this.publishTimer) return;
    this.publishTimer = setTimeout(() => { this.publishTimer = undefined; if (token === this.generation) this.publish(token); }, Math.max(0, L.publicationMs - (this.now() - this.lastPublication)));
  }
  private publish(token: number) {
    if (token !== this.generation || !this.client || !this.active || this.paused) return;
    try {
      this.store.publish(this.client.items, this.allowed); this.lastPublication = this.now();
    } catch { this.halt('Overview presentation cache limit / identity validation failed. Reduce the Page selection.'); }
  }
}
