import { ACQUISITION_LIMITS, buildPollGroups, type AcquisitionConfig, type AcquisitionMapping, type PollGroup } from './acquisitionConfig.js';
import { decodeRegisters, type Order } from './codec.js';
import { parseRead, type DeviceConnection } from './modbus.js';
import { TagRuntimeStore, type AcquisitionToken } from './tagRuntime.js';
type Tracked = { mapping: AcquisitionMapping; fingerprint: string; token: AcquisitionToken; connection?: DeviceConnection; connectionGeneration: number; connected: boolean; inputSequence: number };
type Scheduled = { group: PollGroup; due: number; active: boolean; epoch: number; owner: string };

/** Sole Shared Tag scheduler. No Browser, Workflow, write, connect or transport delivery dependency. */
export class SharedTagAcquisition {
  private tracked = new Map<string, Tracked>();
  private groups: Scheduled[] = [];
  private epoch = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private unsubscribe?: () => void;
  private running = false;
  private reads = 0;
  private busyDevices = new Map<string, Scheduled>();
  private lastReconcile = -Infinity;
  constructor(private config: AcquisitionConfig, readonly store: TagRuntimeStore,
    private getConnection: (deviceId: string) => DeviceConnection | undefined,
    private now = () => performance.now()) {}
  start() {
    if (this.running) return;
    this.running = true; this.unsubscribe = this.config.subscribe(() => this.reconcile());
    this.reconcile(); this.tick();
  }
  stop() {
    this.running = false; if (this.timer) clearTimeout(this.timer); this.timer = undefined;
    this.unsubscribe?.(); this.unsubscribe = undefined; this.invalidateReads();
    for (const id of this.tracked.keys()) this.store.remove(id, 'ACQUISITION_STOPPED');
    this.tracked.clear(); this.groups = [];
  }
  diagnostics() { return { running: this.running, tags: this.tracked.size, groups: this.groups.length, activeReads: this.reads, maxActiveReads: ACQUISITION_LIMITS.maxConcurrentReads }; }
  /** Called on configuration/device lifecycle mutations; periodic reconciliation is a defensive fallback. */
  reconcile() {
    if (!this.running) return;
    this.lastReconcile = this.now();
    const wanted = new Map(this.config.list().filter(m => this.config.availability(m) === 'READY').map(m => [m.sourceId, m]));
    let changed = false;
    for (const [id, entry] of this.tracked) {
      if (!wanted.has(id) || JSON.stringify(wanted.get(id)) !== entry.fingerprint) {
        entry.connection?.cancelAcquisitionRequests();
        this.store.remove(id, wanted.has(id) ? 'MAPPING_CHANGED' : 'CONFIGURATION_UNAVAILABLE'); this.tracked.delete(id); changed = true;
      }
    }
    for (const [id, m] of wanted) {
      const connection = this.getConnection(m.deviceId);
      const connected = Boolean(connection && !connection.manual && connection.runtime.actualState === 'connected');
      let entry = this.tracked.get(id);
      if (!entry) {
        entry = { mapping: m, fingerprint: JSON.stringify(m), token: this.store.activate(id, m.dataType === 'Boolean' ? 'Boolean' : 'Number'),
          connection, connectionGeneration: connection?.generation ?? -1, connected, inputSequence: 0 };
        this.tracked.set(id, entry);
        if (!connected) entry.token = this.store.fence(entry.token, 'DISCONNECTED', 'DEVICE_DISCONNECTED')!;
        changed = true;
      } else if (connection !== entry.connection || (connection?.generation ?? -1) !== entry.connectionGeneration || connected !== entry.connected) {
        entry.connection?.cancelAcquisitionRequests();
        entry.token = this.store.fence(entry.token, connected ? 'UNCERTAIN' : 'DISCONNECTED', connected ? 'AWAITING_FRESH_READ' : 'DEVICE_DISCONNECTED')!;
        entry.inputSequence = 0; entry.connection = connection; entry.connectionGeneration = connection?.generation ?? -1; entry.connected = connected; changed = true;
      }
    }
    if (changed) {
      this.invalidateReads();
      const counts = new Map<string, number>();
      this.groups = buildPollGroups([...this.tracked.values()].filter(e => e.connected).map(e => e.mapping)).filter(g => {
        const count = (counts.get(g.deviceId) ?? 0) + 1; counts.set(g.deviceId, count);
        if (count <= ACQUISITION_LIMITS.maxGroupsPerDevice) return true;
        for (const m of g.mappings) { const e = this.tracked.get(m.sourceId)!; this.store.bad(e.token, ++e.inputSequence, 'DEVICE_GROUP_LIMIT'); }
        return false;
      }).map((group, index) => ({ group, due: this.now(), active: false, epoch: this.epoch, owner: `shared-tags:${this.epoch}:${index}` }));
    }
  }
  private invalidateReads() {
    this.epoch++;
    for (const e of this.tracked.values()) e.connection?.cancelAcquisitionRequests();
    this.busyDevices.clear();
  }
  private tick = () => {
    if (!this.running) return;
    if (this.now() - this.lastReconcile >= 1000) this.reconcile();
    for (const entry of this.tracked.values()) this.store.expire(entry.token, entry.mapping.staleAfterMs);
    for (const scheduled of [...this.groups].sort((a, b) => a.due - b.due)) {
      if (this.reads >= ACQUISITION_LIMITS.maxConcurrentReads) break;
      if (!scheduled.active && scheduled.due <= this.now() && !this.busyDevices.has(scheduled.group.deviceId)) void this.scan(scheduled);
    }
    this.timer = setTimeout(this.tick, ACQUISITION_LIMITS.tickMs);
    this.timer.unref?.();
  };
  private valid(s: Scheduled, e: Tracked, connection: DeviceConnection): boolean {
    return this.running && s.epoch === this.epoch && this.tracked.get(e.mapping.sourceId) === e &&
      this.getConnection(e.mapping.deviceId) === connection && connection.generation === e.connectionGeneration &&
      connection.runtime.actualState === 'connected' && !connection.manual && this.config.availability(e.mapping) === 'READY' &&
      JSON.stringify(this.config.get(e.mapping.sourceId)) === e.fingerprint;
  }
  private async scan(s: Scheduled) {
    const first = this.tracked.get(s.group.mappings[0]!.sourceId), connection = first?.connection;
    if (!first || !connection || !this.valid(s, first, connection)) { this.reconcile(); return; }
    s.active = true; this.reads++; this.busyDevices.set(s.group.deviceId, s);
    const targets = s.group.mappings.map(m => this.tracked.get(m.sourceId)!).map(e => ({ e, sequence: ++e.inputSequence, token: e.token }));
    try {
      const response = await connection.request({ requestClass: 'acquisition', acquisitionOwner: s.owner,
        unitId: s.group.unitId, fc: s.group.functionCode, address: s.group.address, quantity: s.group.width });
      // Fake/custom connection implementations also must return a complete correctly sized read.
      const expectedBytes = s.group.functionCode <= 2 ? Math.ceil(s.group.width / 8) : s.group.width * 2;
      if (response.length !== 9 + expectedBytes || response[8] !== expectedBytes || response[7] !== s.group.functionCode || response[6] !== s.group.unitId) throw Error('INVALID_READ_FRAME');
      const raw = parseRead(response, s.group.functionCode);
      for (const { e, sequence, token } of targets) {
        if (!this.valid(s, e, connection)) continue;
        try {
          const m = e.mapping, offset = m.address - s.group.address;
          let value: unknown;
          if (m.dataType === 'Boolean') value = raw[offset];
          else {
            const order: Order = m.byteOrder === 'BIG_ENDIAN' ? (m.wordOrder === 'HIGH_FIRST' ? 'ABCD' : 'CDAB') : (m.wordOrder === 'HIGH_FIRST' ? 'BADC' : 'DCBA');
            value = Number(decodeRegisters(raw.slice(offset, offset + m.width) as number[], m.dataType, order)) * m.scale + m.offset;
          }
          this.store.good(token, sequence, value);
        } catch { this.store.bad(token, sequence, 'DECODE_FAILED'); }
      }
    } catch (error) {
      for (const { e, sequence, token } of targets) if (this.valid(s, e, connection)) this.store.bad(token, sequence, (error as Error).message || 'READ_FAILED');
    } finally {
      this.reads--; s.active = false; s.due = this.now() + s.group.pollIntervalMs;
      if (this.busyDevices.get(s.group.deviceId) === s) this.busyDevices.delete(s.group.deviceId);
    }
  }
}
