import { createServer, type Server } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DeviceConnection } from '../src/modbus.js';
import { ModbusMonitorManager } from '../src/monitor.js';
import { DEFAULT_RELIABILITY_CONFIG, readReliabilityConfig } from '../src/reliability.js';
import type { DeviceConfig } from '../src/types.js';

const device = (port: number): DeviceConfig => ({
  id: 'plc-1',
  name: 'PLC 1',
  host: '127.0.0.1',
  port,
  defaultUnitId: 1,
  timeout: 500,
  retryCount: 0,
  interRequestDelay: 0,
  reconnectDelay: 100,
  enabled: true,
});

const responseFor = (request: Buffer) => Buffer.from([
  request[0]!, request[1]!, 0, 0, 0, 5, request[6]!, request[7]!, 2, 0, 42,
]);

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Test server did not bind');
  return address.port;
}

async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  throw Error('Timed out waiting for test condition');
}

describe('reliability defaults', () => {
  it('uses approved defaults and clamps invalid environment values', () => {
    expect(readReliabilityConfig({})).toEqual(DEFAULT_RELIABILITY_CONFIG);
    const config = readReliabilityConfig({
      MONITOR_QUEUE_LIMIT: '0',
      WS_CLIENT_MAX_MESSAGES: '999999',
      WS_CLIENT_MAX_BYTES: 'oops',
      WS_RECONNECT_BASE_MS: '-10',
      WS_RECONNECT_MAX_MS: '9999999',
      WS_RECONNECT_JITTER: '1',
    });
    expect(config.monitorQueueLimit).toBe(1);
    expect(config.wsMaxMessages).toBe(10_000);
    expect(config.wsMaxBytes).toBe(DEFAULT_RELIABILITY_CONFIG.wsMaxBytes);
    expect(config.wsReconnectBaseMs).toBe(250);
    expect(config.wsReconnectMaxMs).toBe(300_000);
    expect(config.wsReconnectJitter).toBe(0.5);
  });
});

describe('device monitor queue', () => {
  it('bounds monitor jobs while retaining workflow and write priority', async () => {
    const pending: Array<() => void> = [];
    let holdFirst = true;
    const server = createServer(socket => socket.on('data', request => {
      if (holdFirst) {
        holdFirst = false;
        pending.push(() => socket.write(responseFor(request)));
      } else setTimeout(() => socket.write(responseFor(request)), 1);
    }));
    const port = await listen(server);
    const connection = new DeviceConnection(device(port), { monitorQueueLimit: 2 });
    await connection.connect();

    const first = connection.request({ unitId: 1, fc: 3, address: 0, quantity: 1, requestClass: 'monitor', monitorListId: 'list-a' });
    await waitFor(() => connection.active);
    const second = connection.request({ unitId: 1, fc: 3, address: 1, quantity: 1, requestClass: 'monitor', monitorListId: 'list-b' });
    const third = connection.request({ unitId: 1, fc: 3, address: 2, quantity: 1, requestClass: 'monitor', monitorListId: 'list-c' });
    const dropped = connection.request({ unitId: 1, fc: 3, address: 3, quantity: 1, requestClass: 'monitor', monitorListId: 'list-d' });
    const workflow = connection.request({ unitId: 1, fc: 3, address: 4, quantity: 1 });
    const write = connection.request({ unitId: 1, fc: 6, address: 5, values: [7], priority: true });

    await expect(dropped).rejects.toMatchObject({ code: 'MONITOR_QUEUE_FULL' });
    expect(connection.queue.map(item => item.r.requestClass)).toEqual(['write', 'workflow', 'monitor', 'monitor']);
    expect(connection.runtime.monitorDroppedCount).toBe(1);

    await waitFor(() => pending.length === 1);
    pending.shift()!();
    await Promise.all([first, second, third, workflow, write]);
    expect(connection.runtime.monitorQueueLength).toBe(0);
    connection.disconnect();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('cancels an active monitor request without dropping the device connection', async () => {
    let release: (() => void) | undefined;
    const server = createServer(socket => socket.on('data', () => {
      // Keep the first request in flight until the cancellation is observed.
      release = () => socket.write(Buffer.from([0, 1, 0, 0, 0, 5, 1, 3, 2, 0, 1]));
    }));
    const port = await listen(server);
    const connection = new DeviceConnection(device(port));
    await connection.connect();
    const request = connection.request({ unitId: 1, fc: 3, address: 0, quantity: 1, requestClass: 'monitor', monitorListId: 'list-a' });
    await waitFor(() => connection.active);
    connection.cancelMonitorRequests('list-a');
    await expect(request).rejects.toMatchObject({ code: 'MONITOR_CANCELLED' });
    expect(connection.runtime.actualState).toBe('connected');
    release?.();
    connection.disconnect();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
});

describe('monitor scheduler', () => {
  it('admits one in-flight scan and one pending scan per list', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mws-monitor-'));
    try {
      let releaseFirst: (() => void) | undefined;
      let calls = 0;
      const request = vi.fn(async () => {
        calls += 1;
        if (calls === 1) await new Promise<void>(resolve => { releaseFirst = resolve; });
        return Buffer.from([0, 1, 0, 0, 0, 5, 1, 3, 2, 0, 42]);
      });
      const connection = {
        runtime: { actualState: 'connected' },
        request,
        cancelMonitorRequests: vi.fn(),
      } as unknown as import('../src/modbus.js').DeviceConnection;
      const manager = new ModbusMonitorManager({
        dataDir: root,
        getDevices: () => [device(502)],
        getConnection: () => connection,
        broadcast: vi.fn(),
        audit: vi.fn(),
      });
      const list = manager.create('Test list');
      manager.update(list.id, {
        deviceId: 'plc-1',
        items: [{
          id: 'tag-1', enabled: true, tagName: 'Tag 1', functionCode: 3, address: 0,
          dataType: 'UInt16', quantity: 1, order: 'ABCD', scale: 1, offset: 0, engineeringUnit: '',
        }],
      });

      const first = manager.read(list.id);
      await waitFor(() => calls === 1);
      const pending = manager.read(list.id);
      const coalesced = manager.read(list.id);
      expect(coalesced).toBe(pending);
      expect(manager.all()[0]!.diagnostics).toMatchObject({ inFlight: true, pending: true, pendingLimit: 1, coalesced: 1 });
      releaseFirst!();
      await first;
      await Promise.all([pending, coalesced]);
      expect(calls).toBe(2);
      expect(manager.all()[0]!.values?.['tag-1']?.value).toBe(42);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('invalidates and suppresses a scan after stop', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mws-monitor-stop-'));
    try {
      let release!: () => void;
      const request = vi.fn(async () => {
        await new Promise<void>(resolve => { release = resolve; });
        return Buffer.from([0, 1, 0, 0, 0, 5, 1, 3, 2, 0, 7]);
      });
      const connection = {
        runtime: { actualState: 'connected' },
        request,
        cancelMonitorRequests: vi.fn(),
      } as unknown as import('../src/modbus.js').DeviceConnection;
      const broadcast = vi.fn();
      const manager = new ModbusMonitorManager({
        dataDir: root,
        getDevices: () => [device(502)],
        getConnection: () => connection,
        broadcast,
        audit: vi.fn(),
      });
      const list = manager.create('Stop test');
      manager.update(list.id, {
        deviceId: 'plc-1',
        items: [{
          id: 'tag-1', enabled: true, tagName: 'Tag 1', functionCode: 3, address: 0,
          dataType: 'UInt16', quantity: 1, order: 'ABCD', scale: 1, offset: 0, engineeringUnit: '',
        }],
      });
      const scan = manager.read(list.id);
      await waitFor(() => request.mock.calls.length === 1);
      manager.stop(list.id);
      release();
      await expect(scan).rejects.toMatchObject({ name: 'MonitorCancelledError' });
      expect(broadcast).not.toHaveBeenCalledWith('monitor', expect.anything());
      expect((connection.cancelMonitorRequests as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(list.id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
