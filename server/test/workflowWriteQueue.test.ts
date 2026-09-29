import net from 'node:net';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceConnection, WORKFLOW_WRITE_QUEUE_LIMIT } from '../src/modbus.js';
import { device, readResponse } from './acquisitionFixtures.js';
class FakeSocket extends EventEmitter {
  sent: Buffer[] = [];
  write(buffer: Buffer, callback?: (error?: Error) => void) { this.sent.push(Buffer.from(buffer)); callback?.(); return true; }
  destroy() { this.emit('close'); return this; }
}
const sockets: FakeSocket[] = [], connections: DeviceConnection[] = [];
afterEach(() => { for (const connection of connections.splice(0)) connection.disconnect(); sockets.length = 0; vi.restoreAllMocks(); vi.useRealTimers(); });
async function connected(nowMonotonic = () => performance.now()) {
  vi.useFakeTimers();
  vi.spyOn(net, 'createConnection').mockImplementation(() => { const socket = new FakeSocket(); sockets.push(socket); return socket as unknown as net.Socket; });
  const connection = new DeviceConnection({ ...device }, { nowMonotonic }); connections.push(connection);
  const connecting = connection.connect(); sockets.at(-1)!.emit('connect'); await connecting;
  return { connection, socket: sockets.at(-1)! };
}
const response = (packet: Buffer) => {
  const fc = packet[7]!;
  if (fc <= 4) { const reply = readResponse(0, fc); reply.writeUInt16BE(packet.readUInt16BE(0), 0); reply[6] = packet[6]!; return reply; }
  if (fc === 5 || fc === 6) { const reply = Buffer.from(packet.subarray(0, 12)); return reply; }
  const reply = Buffer.alloc(12); packet.copy(reply, 0, 0, 7); reply[7] = 16; packet.copy(reply, 8, 8, 10); reply.writeUInt16BE(packet.readUInt16BE(10), 10); return reply;
};
const write = (connection: DeviceConnection, patch: Record<string, unknown> = {}) => connection.request({
  requestClass: 'write', priority: true, unitId: 1, fc: 5, address: 0, quantity: 1, values: [0xff00], workflowId: 'wf', nodeId: 'out',
  commandId: crypto.randomUUID(), resourceKey: 'plc:1:COIL:0', runtimeGeneration: 1, createdAtMonotonic: 0, expiresAtMonotonic: 5000, supersedeQueued: false, isCurrent: () => true, ...patch,
} as never);
describe('bounded Workflow write queue and fencing', () => {
  it('rejects unguarded writes and blocks non-write request classes from write function codes', async () => {
    const { connection } = await connected();
    const unguarded = connection.request({ unitId: 1, fc: 5, address: 0, quantity: 1, values: [0xff00] } as never);
    expect(unguarded.admitted).toBe(false); await expect(unguarded).rejects.toMatchObject({ code: 'WRITE_AUTHORITY_REQUIRED' });
    await expect(connection.request({ unitId: 1, fc: 16, address: 0, quantity: 1, values: [1], priority: true, requestClass: 'write' } as never)).rejects.toMatchObject({ code: 'WRITE_METADATA_REQUIRED' });
    await expect(connection.request({ unitId: 1, fc: 15, address: 0, quantity: 1, values: [0xff00], priority: true, requestClass: 'write', workflowId: 'wf', nodeId: 'out', commandId: 'x', resourceKey: 'r', runtimeGeneration: 1, expiresAtMonotonic: 5000, isCurrent: () => true } as never)).rejects.toMatchObject({ code: 'WRITE_METADATA_REQUIRED' });
  });

  it('bounds pending writes and explicitly rejects the overflow without dropping queued intents', async () => {
    const { connection } = await connected();
    const held = connection.request({ unitId: 1, fc: 3, address: 0, quantity: 1 }).catch(() => undefined);
    expect(connection.active).toBe(true);
    const pending = Array.from({ length: WORKFLOW_WRITE_QUEUE_LIMIT }, (_, index) => write(connection, { nodeId: `out-${index}`, resourceKey: `r-${index}`, commandId: `command-${index}` }).catch(error => (error as { code?: string }).code));
    expect(connection.queue.filter(item => item.r.requestClass === 'write')).toHaveLength(WORKFLOW_WRITE_QUEUE_LIMIT);
    const overflow = write(connection, { nodeId: 'overflow', commandId: 'overflow' });
    expect(overflow.admitted).toBe(false); await expect(overflow).rejects.toMatchObject({ code: 'WRITE_QUEUE_FULL' });
    expect(connection.queue.filter(item => item.r.requestClass === 'write')).toHaveLength(WORKFLOW_WRITE_QUEUE_LIMIT);
    connection.disconnect(); await held; await Promise.all(pending);
  });

  it('supersedes only a not-yet-started command from the same workflow node and cancels queued commands on stop', async () => {
    const { connection, socket } = await connected();
    const held = connection.request({ unitId: 1, fc: 3, address: 0, quantity: 1 });
    const old = write(connection, { commandId: 'old', supersedeQueued: true }).catch(error => (error as { code?: string }).code);
    const current = write(connection, { commandId: 'new', values: [0], supersedeQueued: true }).catch(error => (error as { code?: string }).code);
    expect(await old).toBe('WRITE_SUPERSEDED'); expect(connection.queue.map(item => item.r.commandId)).toEqual(['new']);
    expect(connection.cancelWorkflowWrites('wf', 1)).toBe(1); expect(await current).toBe('WRITE_CANCELLED');
    socket.emit('data', response(socket.sent[0]!)); await held; await vi.advanceTimersByTimeAsync(0);
    expect(socket.sent).toHaveLength(1); expect(connection.activeRequest).toBeUndefined();
  });

  it('checks monotonic expiry immediately before Device execution without extending queue delay', async () => {
    let now = 0; const { connection, socket } = await connected(() => now);
    const held = connection.request({ unitId: 1, fc: 3, address: 0, quantity: 1 });
    const expired = write(connection, { commandId: 'expires', expiresAtMonotonic: 50 }).catch(error => (error as { code?: string }).code);
    now = 51; socket.emit('data', response(socket.sent[0]!)); await held; await vi.advanceTimersByTimeAsync(0);
    expect(await expired).toBe('COMMAND_EXPIRED'); expect(socket.sent).toHaveLength(1);
  });

  it('does not replay a queued old-connection command after manual disconnect and reconnect', async () => {
    const { connection, socket: oldSocket } = await connected();
    const held = connection.request({ unitId: 1, fc: 3, address: 0, quantity: 1 }).catch(() => undefined);
    const stale = write(connection, { commandId: 'stale' }).catch(error => (error as { code?: string }).code);
    connection.disconnect(); expect(await stale).toBe('MANUAL_DISCONNECT'); await held;
    const connecting = connection.connect(); const newSocket = sockets.at(-1)!; newSocket.emit('connect'); await connecting;
    expect(oldSocket.sent).toHaveLength(1); expect(newSocket.sent).toHaveLength(0); connection.disconnect();
  });
});
