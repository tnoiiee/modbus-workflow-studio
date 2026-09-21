import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JsonStore } from './store.js';
import { parseRead, type DeviceConnection } from './modbus.js';
import { decodeRegisters } from './codec.js';
import type { DeviceConfig, Quality } from './types.js';

export interface MonitorItem {
  id: string;
  enabled: boolean;
  tagName: string;
  functionCode: number;
  address: number;
  dataType: string;
  quantity: number;
  order: string;
  scale: number;
  offset: number;
  engineeringUnit: string;
}

export interface MonitorList {
  id: string;
  name: string;
  deviceId: string;
  unitId: number;
  scanInterval: number;
  items: MonitorItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MonitorValue {
  value?: unknown;
  rawValue?: unknown;
  quality: Quality;
  lastUpdate?: string;
  responseTime?: number;
  error?: string;
}

export interface MonitorDiagnostics {
  inFlight: boolean;
  pending: boolean;
  pendingLimit: number;
  generation: number;
  coalesced: number;
  cancelled: number;
  lastError?: string;
}

type Dependencies = {
  dataDir: string;
  getDevices: () => DeviceConfig[];
  getConnection: (id: string) => DeviceConnection | undefined;
  broadcast: (type: string, data: unknown) => void;
  audit: (entry: Record<string, unknown>) => void;
  monitorPendingPerList?: number;
};

type PendingRun = {
  generation: number;
  promise: Promise<Record<string, MonitorValue>>;
  resolve: (value: Record<string, MonitorValue>) => void;
  reject: (error: Error) => void;
};

type RunState = {
  generation: number;
  timer?: NodeJS.Timeout;
  active?: Promise<Record<string, MonitorValue>>;
  pending?: PendingRun;
  coalesced: number;
  cancelled: number;
  lastError?: string;
};

class MonitorCancelledError extends Error {
  constructor() {
    super('Monitor request cancelled');
    this.name = 'MonitorCancelledError';
  }
}

export class ModbusMonitorManager {
  private store: JsonStore<MonitorList[]>;
  private lists: MonitorList[];
  private values = new Map<string, Record<string, MonitorValue>>();
  private states = new Map<string, RunState>();
  private readonly pendingPerList: number;

  constructor(private d: Dependencies) {
    this.store = new JsonStore(path.join(d.dataDir, 'monitor-lists.json'), []);
    this.lists = this.store.load();
    this.pendingPerList = Math.max(1, Math.trunc(d.monitorPendingPerList ?? 1));
  }

  all() {
    return this.lists.map(list => ({
      ...list,
      running: Boolean(this.states.get(list.id)?.timer),
      diagnostics: this.diagnostics(list.id),
      values: this.values.get(list.id) ?? {},
    }));
  }

  create(name = 'Commissioning') {
    const now = new Date().toISOString();
    const list: MonitorList = {
      id: randomUUID(),
      name,
      deviceId: '',
      unitId: 1,
      scanInterval: 1000,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    this.lists.push(list);
    this.save();
    this.audit('MONITOR_LIST_CREATED', list);
    return list;
  }

  update(id: string, patch: Partial<MonitorList>) {
    const index = this.lists.findIndex(item => item.id === id);
    if (index < 0) throw Error('Monitor list not found');
    const state = this.states.get(id);
    const wasRunning = Boolean(state?.timer);
    if (wasRunning || state?.active || state?.pending) this.stop(id);
    const current = this.lists[index]!;
    const items = (patch.items ?? current.items).slice(0, 500).map(item => ({
      ...item,
      id: item.id || randomUUID(),
      functionCode: Number(item.functionCode),
      address: Number(item.address),
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      scale: Number(item.scale ?? 1),
      offset: Number(item.offset ?? 0),
    }));
    const next: MonitorList = {
      ...current,
      ...patch,
      id: current.id,
      items,
      updatedAt: new Date().toISOString(),
    };
    this.lists[index] = next;
    this.save();
    if (wasRunning) this.start(id);
    return next;
  }

  delete(id: string) {
    this.stop(id);
    this.lists = this.lists.filter(item => item.id !== id);
    this.values.delete(id);
    this.states.delete(id);
    this.save();
    this.d.audit({ timestamp: new Date().toISOString(), action: 'MONITOR_LIST_DELETED', monitorListId: id });
  }

  /**
   * Request one scan. A scan already in flight admits exactly one follow-up
   * scan; additional requests are coalesced into that same pending run.
   */
  read(id: string): Promise<Record<string, MonitorValue>> {
    this.require(id);
    const state = this.state(id);
    if (!state.active) return this.beginRun(id, state.generation);
    if (state.pending) {
      state.coalesced += 1;
      // All callers observe the same bounded pending Promise; no additional
      // monitor jobs or per-caller waiter list is created.
      return state.pending.promise;
    }
    let resolvePending!: (value: Record<string, MonitorValue>) => void;
    let rejectPending!: (error: Error) => void;
    const promise = new Promise<Record<string, MonitorValue>>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    state.pending = {
      generation: state.generation,
      promise,
      resolve: resolvePending,
      reject: rejectPending,
    };
    return promise;
  }

  start(id: string) {
    const list = this.require(id);
    const state = this.state(id);
    if (state.timer) return;
    void this.read(id).catch(error => this.recordError(id, error));
    state.timer = setInterval(() => {
      void this.read(id).catch(error => this.recordError(id, error));
    }, Math.max(100, list.scanInterval));
    this.audit('MONITOR_STARTED', list);
  }

  stop(id: string) {
    const list = this.lists.find(item => item.id === id);
    const state = this.states.get(id);
    if (!state) return;
    if (state.timer) clearInterval(state.timer);
    state.timer = undefined;
    state.generation += 1;
    // Invalidate the active promise immediately. The underlying socket request
    // may finish later, but its generation guard prevents publication and a
    // restart is free to admit a fresh scan.
    state.active = undefined;
    if (state.pending) {
      state.cancelled += 1;
      state.pending.reject(new MonitorCancelledError());
      state.pending = undefined;
    }
    const connection = list?.deviceId ? this.d.getConnection(list.deviceId) : undefined;
    connection?.cancelMonitorRequests(id);
    if (list) this.audit('MONITOR_STOPPED', list);
  }

  stopByDevice(deviceId: string) {
    for (const list of this.lists.filter(item => item.deviceId === deviceId)) this.stop(list.id);
  }

  private beginRun(id: string, generation: number): Promise<Record<string, MonitorValue>> {
    const state = this.state(id);
    const active = this.executeRun(id, generation);
    state.active = active;
    void active.then(
      result => this.finishRun(id, generation, undefined, result),
      error => this.finishRun(id, generation, error as Error),
    );
    return active;
  }

  private finishRun(id: string, generation: number, error?: Error, result?: Record<string, MonitorValue>) {
    const state = this.states.get(id);
    if (!state || state.generation !== generation) return;
    state.active = undefined;
    if (error && !(error instanceof MonitorCancelledError)) this.recordError(id, error);
    const pending = state.pending;
    state.pending = undefined;
    if (!pending) return;
    if (pending.generation !== state.generation) {
      state.cancelled += 1;
      pending.reject(new MonitorCancelledError());
      return;
    }
    const next = this.beginRun(id, state.generation);
    void next.then(pending.resolve, pending.reject);
    // The result/error of the completed run is intentionally not forwarded to
    // the pending scan; it represents a distinct generation of observations.
    void result;
  }

  private async executeRun(id: string, generation: number): Promise<Record<string, MonitorValue>> {
    const list = this.require(id);
    const device = this.d.getDevices().find(item => item.id === list.deviceId);
    const connection = device ? this.d.getConnection(device.id) : undefined;
    if (!device || !connection || connection.runtime.actualState !== 'connected') {
      throw Error('Device is not connected');
    }

    const result: Record<string, MonitorValue> = { ...(this.values.get(id) ?? {}) };
    for (const item of list.items.filter(entry => entry.enabled)) {
      this.assertCurrent(id, generation);
      const started = Date.now();
      try {
        const registers = this.registerCount(item);
        const raw = await connection.request({
          unitId: list.unitId || device.defaultUnitId,
          fc: item.functionCode,
          address: item.address,
          quantity: registers,
          requestClass: 'monitor',
          monitorListId: id,
          monitorGeneration: generation,
          workflowId: `monitor:${id}`,
          nodeId: item.id,
        });
        this.assertCurrent(id, generation);
        const parsed = parseRead(raw, item.functionCode);
        const rawValue = item.functionCode <= 2
          ? parsed[0]
          : decodeRegisters(parsed as number[], item.dataType, item.order as never);
        const value = typeof rawValue === 'number' ? rawValue * item.scale + item.offset : rawValue;
        result[item.id] = {
          value,
          rawValue,
          quality: 'GOOD',
          lastUpdate: new Date().toISOString(),
          responseTime: Date.now() - started,
        };
      } catch (error) {
        if (error instanceof MonitorCancelledError || (error as Error).message === 'Monitor request cancelled') throw error;
        result[item.id] = {
          ...result[item.id],
          quality: 'BAD',
          lastUpdate: new Date().toISOString(),
          responseTime: Date.now() - started,
          error: (error as Error).message,
        };
        this.d.audit({
          timestamp: new Date().toISOString(),
          action: 'MONITOR_READ_FAILED',
          monitorListId: id,
          monitorItemId: item.id,
          error: (error as Error).message,
        });
      }
    }
    this.assertCurrent(id, generation);
    this.values.set(id, result);
    this.d.broadcast('monitor', {
      listId: id,
      values: result,
      diagnostics: this.diagnostics(id),
    });
    return result;
  }

  private assertCurrent(id: string, generation: number) {
    const state = this.states.get(id);
    if (!state || state.generation !== generation) throw new MonitorCancelledError();
  }

  private recordError(id: string, error: unknown) {
    const state = this.states.get(id);
    if (!state || error instanceof MonitorCancelledError) return;
    state.lastError = (error as Error).message;
    this.d.audit({ timestamp: new Date().toISOString(), action: 'MONITOR_SCAN_FAILED', monitorListId: id, error: state.lastError });
  }

  private diagnostics(id: string): MonitorDiagnostics {
    const state = this.states.get(id);
    return {
      inFlight: Boolean(state?.active),
      pending: Boolean(state?.pending),
      pendingLimit: this.pendingPerList,
      generation: state?.generation ?? 0,
      coalesced: state?.coalesced ?? 0,
      cancelled: state?.cancelled ?? 0,
      lastError: state?.lastError,
    };
  }

  private state(id: string) {
    let state = this.states.get(id);
    if (!state) {
      state = { generation: 0, coalesced: 0, cancelled: 0 };
      this.states.set(id, state);
    }
    return state;
  }

  private registerCount(item: MonitorItem) {
    if (item.functionCode <= 2) return Math.max(1, item.quantity);
    if (['Int32', 'UInt32', 'Float32'].includes(item.dataType)) return 2;
    if (item.dataType === 'Float64') return 4;
    return 1;
  }

  private require(id: string) {
    const list = this.lists.find(item => item.id === id);
    if (!list) throw Error('Monitor list not found');
    return list;
  }

  private save() {
    this.store.save(this.lists);
  }

  private audit(action: string, list: MonitorList) {
    this.d.audit({
      timestamp: new Date().toISOString(),
      action,
      monitorListId: list.id,
      monitorListName: list.name,
      deviceId: list.deviceId,
    });
  }
}
