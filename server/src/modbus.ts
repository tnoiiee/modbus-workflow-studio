import net from 'node:net';
import { EventEmitter } from 'node:events';
import type { DeviceConfig, DeviceRuntime } from './types.js';

export type RequestClass = 'workflow' | 'monitor' | 'write';

export interface Request {
  unitId: number;
  fc: number;
  address: number;
  quantity?: number;
  values?: number[];
  priority?: boolean;
  generation: number;
  requestClass?: RequestClass;
  monitorListId?: string;
  monitorGeneration?: number;
  workflowId?: string;
  nodeId?: string;
}

export class DeviceRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DeviceRequestError';
  }
}

const frame = (tx: number, r: Request) => {
  let p: Buffer;
  if (r.fc <= 4) {
    p = Buffer.alloc(5);
    p[0] = r.fc;
    p.writeUInt16BE(r.address, 1);
    p.writeUInt16BE(r.quantity ?? 1, 3);
  } else if (r.fc === 5 || r.fc === 6) {
    p = Buffer.alloc(5);
    p[0] = r.fc;
    p.writeUInt16BE(r.address, 1);
    p.writeUInt16BE(r.values?.[0] ?? 0, 3);
  } else if (r.fc === 16) {
    const values = r.values ?? [];
    p = Buffer.alloc(6 + values.length * 2);
    p[0] = 16;
    p.writeUInt16BE(r.address, 1);
    p.writeUInt16BE(values.length, 3);
    p[5] = values.length * 2;
    values.forEach((value, index) => p.writeUInt16BE(value, 6 + index * 2));
  } else {
    throw Error('Function code not supported');
  }
  const h = Buffer.alloc(7);
  h.writeUInt16BE(tx, 0);
  h.writeUInt16BE(0, 2);
  h.writeUInt16BE(p.length + 1, 4);
  h[6] = r.unitId;
  return Buffer.concat([h, p]);
};

type QueueItem = {
  r: Request;
  ok: (buffer: Buffer) => void;
  bad: (error: Error) => void;
};

type DeviceConnectionOptions = {
  monitorQueueLimit?: number;
};

export class DeviceConnection extends EventEmitter {
  socket?: net.Socket;
  generation = 0;
  tx = 0;
  queue: QueueItem[] = [];
  active = false;
  activeRequest?: Request;
  private activeAbort?: (error: Error) => void;
  private connectPromise?: Promise<void>;
  private connectReject?: (error: Error) => void;
  manual = false;
  readonly monitorQueueLimit: number;
  runtime: DeviceRuntime;

  constructor(public config: DeviceConfig, options: DeviceConnectionOptions = {}) {
    super();
    this.monitorQueueLimit = Math.max(1, Math.trunc(options.monitorQueueLimit ?? 32));
    this.runtime = {
      desiredState: 'disconnected',
      actualState: 'disconnected',
      queueLength: 0,
      activePollers: 0,
      averageResponseTime: 0,
      timeoutCount: 0,
      monitorQueueLength: 0,
      monitorInFlight: 0,
      monitorQueueLimit: this.monitorQueueLimit,
      monitorDroppedCount: 0,
      monitorCoalescedCount: 0,
      monitorCancelledCount: 0,
    };
  }

  connect() {
    if (this.runtime.actualState === 'connected' && this.socket) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    this.manual = false;
    this.runtime.desiredState = 'connected';
    this.runtime.actualState = 'connecting';
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectReject = reject;
      const socket = net.createConnection({ host: this.config.host, port: this.config.port });
      this.socket = socket;
      const timer = setTimeout(() => socket.destroy(Error('Connect timeout')), this.config.timeout);
      socket.once('connect', () => {
        clearTimeout(timer);
        this.connectPromise = undefined;
        this.connectReject = undefined;
        this.generation += 1;
        this.runtime.actualState = 'connected';
        this.runtime.lastConnected = new Date().toISOString();
        this.emit('state');
        resolve();
      });
      socket.once('error', error => {
        clearTimeout(timer);
        this.connectPromise = undefined;
        this.connectReject = undefined;
        if (this.socket !== socket || this.runtime.actualState === 'connected') return;
        this.runtime.actualState = 'error';
        this.runtime.lastError = error.message;
        this.emit('state');
        reject(error);
      });
      socket.once('close', () => {
        clearTimeout(timer);
        if (this.socket !== socket) return;
        this.socket = undefined;
        this.connectPromise = undefined;
        this.connectReject = undefined;
        this.runtime.actualState = 'disconnected';
        this.runtime.lastDisconnected = new Date().toISOString();
        this.clearQueue(new DeviceRequestError('DISCONNECTED', 'Disconnected'));
        this.emit('state');
      });
    });
    return this.connectPromise;
  }

  disconnect() {
    this.manual = true;
    this.runtime.desiredState = 'disconnected';
    this.generation += 1;
    const error = new DeviceRequestError('MANUAL_DISCONNECT', 'Manual disconnect');
    this.connectReject?.(error);
    this.connectReject = undefined;
    this.connectPromise = undefined;
    this.clearQueue(error);
    this.socket?.destroy();
    this.socket = undefined;
    this.runtime.actualState = 'disconnected';
    this.runtime.lastDisconnected = new Date().toISOString();
    this.emit('state');
  }

  clearQueue(error: Error) {
    for (const item of this.queue) item.bad(error);
    this.queue = [];
    this.activeAbort?.(error);
    this.updateQueueMetrics();
  }

  cancelMonitorRequests(monitorListId?: string, monitorGeneration?: number): number {
    const retained: QueueItem[] = [];
    let cancelled = 0;
    const active = this.activeRequest;
    if (
      active?.requestClass === 'monitor' &&
      (!monitorListId || active.monitorListId === monitorListId) &&
      (monitorGeneration === undefined || active.monitorGeneration === monitorGeneration)
    ) {
      cancelled += 1;
      this.activeAbort?.(new DeviceRequestError('MONITOR_CANCELLED', 'Monitor request cancelled'));
    }
    for (const item of this.queue) {
      const matchesClass = item.r.requestClass === 'monitor';
      const matchesList = !monitorListId || item.r.monitorListId === monitorListId;
      const matchesGeneration = monitorGeneration === undefined || item.r.monitorGeneration === monitorGeneration;
      if (matchesClass && matchesList && matchesGeneration) {
        cancelled += 1;
        item.bad(new DeviceRequestError('MONITOR_CANCELLED', 'Monitor request cancelled'));
      } else {
        retained.push(item);
      }
    }
    this.queue = retained;
    this.runtime.monitorCancelledCount = (this.runtime.monitorCancelledCount ?? 0) + cancelled;
    this.updateQueueMetrics();
    if (!this.active) void this.pump();
    return cancelled;
  }

  request(r: Omit<Request, 'generation'>) {
    return new Promise<Buffer>((resolve, reject) => {
      const requestClass = r.requestClass ?? (r.priority ? 'write' : 'workflow');
      const item: QueueItem = {
        r: { ...r, requestClass, generation: this.generation },
        ok: resolve,
        bad: reject,
      };

      if (requestClass === 'monitor') {
        const duplicate =
          (this.activeRequest?.requestClass === 'monitor' &&
            this.activeRequest.monitorListId === r.monitorListId &&
            r.monitorListId !== undefined) ||
          this.queue.some(
            queued =>
              queued.r.requestClass === 'monitor' &&
              queued.r.monitorListId === r.monitorListId &&
              r.monitorListId !== undefined,
          );
        if (duplicate) {
          this.runtime.monitorCoalescedCount = (this.runtime.monitorCoalescedCount ?? 0) + 1;
          reject(new DeviceRequestError('MONITOR_COALESCED', 'Monitor request coalesced'));
          return;
        }
        if (this.monitorQueueLength() >= this.monitorQueueLimit) {
          this.runtime.monitorDroppedCount = (this.runtime.monitorDroppedCount ?? 0) + 1;
          reject(new DeviceRequestError('MONITOR_QUEUE_FULL', 'Monitor queue is full'));
          return;
        }
      }

      if (requestClass === 'write' && r.priority) {
        this.queue.unshift(item);
      } else if (requestClass === 'workflow') {
        const firstMonitor = this.queue.findIndex(queued => queued.r.requestClass === 'monitor');
        if (firstMonitor < 0) this.queue.push(item);
        else this.queue.splice(firstMonitor, 0, item);
      } else {
        this.queue.push(item);
      }
      this.updateQueueMetrics();
      void this.pump();
    });
  }

  queueMetrics() {
    return {
      queueLength: this.queue.length,
      monitorQueueLength: this.monitorQueueLength(),
      monitorInFlight: this.activeRequest?.requestClass === 'monitor' ? 1 : 0,
      monitorQueueLimit: this.monitorQueueLimit,
      monitorDroppedCount: this.runtime.monitorDroppedCount ?? 0,
      monitorCoalescedCount: this.runtime.monitorCoalescedCount ?? 0,
      monitorCancelledCount: this.runtime.monitorCancelledCount ?? 0,
    };
  }

  private monitorQueueLength() {
    return this.queue.filter(item => item.r.requestClass === 'monitor').length;
  }

  private updateQueueMetrics() {
    const metrics = this.queueMetrics();
    this.runtime.queueLength = metrics.queueLength;
    this.runtime.monitorQueueLength = metrics.monitorQueueLength;
    this.runtime.monitorInFlight = metrics.monitorInFlight;
    this.runtime.monitorQueueLimit = metrics.monitorQueueLimit;
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    const item = this.queue.shift();
    this.updateQueueMetrics();
    if (!item) return;
    if (!this.socket || this.runtime.actualState !== 'connected' || item.r.generation !== this.generation) {
      item.bad(new DeviceRequestError('STALE_REQUEST', 'Device disconnected or stale request'));
      return this.pump();
    }

    this.active = true;
    this.activeRequest = item.r;
    const tx = ++this.tx & 0xffff;
    const started = Date.now();

    try {
      const packet = frame(tx, item.r);
      this.emit('traffic', {
        timestamp: new Date().toISOString(),
        direction: 'TX',
        deviceId: this.config.id,
        workflowId: item.r.workflowId,
        nodeId: item.r.nodeId,
        tx,
        fc: item.r.fc,
        address: item.r.address,
        quantity: item.r.quantity,
        requestClass: item.r.requestClass,
        monitorListId: item.r.monitorListId,
        encodedPayload: item.r.values?.map(value => `0x${value.toString(16).padStart(4, '0').toUpperCase()}`).join(' '),
        payload: packet.toString('hex'),
      });

      const result = await new Promise<Buffer>((resolve, reject) => {
        const socket = this.socket;
        if (!socket) {
          reject(new DeviceRequestError('DISCONNECTED', 'Socket closed'));
          return;
        }
        let settled = false;
        const finish = (callback: (value?: Buffer | Error) => void, value?: Buffer | Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.off('data', onData);
          socket.off('close', onClose);
          socket.off('error', onError);
          if (this.activeAbort === abort) this.activeAbort = undefined;
          callback(value);
        };
        const timer = setTimeout(() => {
          this.runtime.timeoutCount += 1;
          finish(reject, new DeviceRequestError('TIMEOUT', 'Request timeout'));
        }, this.config.timeout);
        const onData = (buffer: Buffer) => {
          if (buffer.length < 9 || buffer.readUInt16BE(0) !== tx) return;
          if (buffer[7]! & 0x80) finish(reject, new DeviceRequestError('MODBUS_EXCEPTION', `Modbus exception ${buffer[8]}`));
          else finish(value => resolve(value as Buffer), buffer);
        };
        const onClose = () => finish(reject, new DeviceRequestError('DISCONNECTED', 'Socket closed'));
        const onError = (error: Error) => finish(reject, error);
        const abort = (error: Error) => finish(reject, error);
        this.activeAbort = abort;
        socket.on('data', onData);
        socket.once('close', onClose);
        socket.once('error', onError);
        socket.write(packet, error => error && finish(reject, error));
      });
      this.runtime.latency = Date.now() - started;
      item.ok(result);
      this.emit('traffic', {
        timestamp: new Date().toISOString(),
        direction: 'RX',
        deviceId: this.config.id,
        workflowId: item.r.workflowId,
        nodeId: item.r.nodeId,
        tx,
        fc: item.r.fc,
        address: item.r.address,
        requestClass: item.r.requestClass,
        monitorListId: item.r.monitorListId,
        duration: this.runtime.latency,
        result: 'success',
        payload: result.toString('hex'),
      });
    } catch (error) {
      item.bad(error as Error);
      this.emit('traffic', {
        timestamp: new Date().toISOString(),
        direction: 'ERROR',
        deviceId: this.config.id,
        workflowId: item.r.workflowId,
        nodeId: item.r.nodeId,
        tx,
        fc: item.r.fc,
        address: item.r.address,
        requestClass: item.r.requestClass,
        monitorListId: item.r.monitorListId,
        result: 'error',
        error: (error as Error).message,
      });
    } finally {
      this.active = false;
      this.activeRequest = undefined;
      this.activeAbort = undefined;
      this.updateQueueMetrics();
      setTimeout(() => void this.pump(), this.config.interRequestDelay);
    }
  }
}

export const parseRead = (buffer: Buffer, functionCode: number) => {
  const count = buffer[8]!;
  const data = buffer.subarray(9, 9 + count);
  if (functionCode === 1 || functionCode === 2) {
    const values: boolean[] = [];
    for (let index = 0; index < count * 8; index += 1) values.push(Boolean(data[Math.floor(index / 8)]! & (1 << (index % 8))));
    return values;
  }
  const values: number[] = [];
  for (let index = 0; index < count; index += 2) values.push(data.readUInt16BE(index));
  return values;
};
