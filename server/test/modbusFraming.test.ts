import net from 'node:net';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModbusTcpFramer, MAX_MODBUS_ADU_BYTES } from '../src/modbusFraming.js';
import { DeviceConnection } from '../src/modbus.js';
import { device, readResponse } from './acquisitionFixtures.js';
class Socket extends EventEmitter {
  sent: Buffer[] = [];
  write(b: Buffer, cb?: (error?: Error) => void) { this.sent.push(Buffer.from(b)); cb?.(); return true; }
  destroy() { this.emit('close'); return this; }
}
const sockets: Socket[] = [], connections: DeviceConnection[] = [];
afterEach(() => { for (const c of connections.splice(0)) c.disconnect(); sockets.length = 0; vi.restoreAllMocks(); vi.useRealTimers(); });
async function connected() {
  vi.useFakeTimers();
  vi.spyOn(net, 'createConnection').mockImplementation(() => { const s = new Socket(); sockets.push(s); return s as unknown as net.Socket; });
  const c = new DeviceConnection({ ...device }); connections.push(c);
  const promise = c.connect(), socket = sockets.at(-1)!; socket.emit('connect'); await promise;
  return { c, socket };
}
const request = (c: DeviceConnection, patch = {}) => c.request({ unitId: 1, fc: 3, address: 0, quantity: 1, ...patch });
const reply = (tx: number, value = 42) => { const b = readResponse(value); b.writeUInt16BE(tx); return b; };
describe('bounded deterministic TCP framing', () => {
  it.each([1, 2, 3, 4, 5, 6])('buffers fragmented MBAP at byte %i', split => {
    const parser = new ModbusTcpFramer<number>(), delivered = vi.fn(), b = readResponse();
    parser.push(b.subarray(0, split), () => 1, delivered); expect(delivered).not.toHaveBeenCalled();
    parser.push(b.subarray(split), () => 1, delivered); expect(delivered).toHaveBeenCalledTimes(1); expect(delivered).toHaveBeenCalledWith(b, 1); expect(parser.bufferedBytes).toBe(0);
  });
  it.each([7, 8, 9, 10])('buffers fragmented body at byte %i', split => {
    const parser = new ModbusTcpFramer<number>(), delivered = vi.fn(), b = readResponse();
    parser.push(b.subarray(0, split), () => 1, delivered); expect(delivered).not.toHaveBeenCalled();
    parser.push(b.subarray(split), () => 2, delivered); expect(delivered).toHaveBeenCalledTimes(1); expect(delivered).toHaveBeenCalledWith(b, 1);
  });
  it('drains multiple frames plus a partial next header without accumulating a frame backlog', () => {
    const parser = new ModbusTcpFramer(), delivered = vi.fn(), b = readResponse();
    parser.push(Buffer.concat([b, b, b.subarray(0, 3)]), () => undefined, delivered);
    expect(delivered).toHaveBeenCalledTimes(2); expect(parser.bufferedBytes).toBe(3);
    parser.push(b.subarray(3), () => undefined, delivered); expect(delivered).toHaveBeenCalledTimes(3);
  });
  it.each([0, 1, 255, 65535])('rejects invalid/oversized length %i and clears buffered state', length => {
    const parser = new ModbusTcpFramer(), header = Buffer.alloc(6); header.writeUInt16BE(length, 4);
    expect(() => parser.push(Buffer.concat([header, Buffer.alloc(100000)]), () => undefined, () => {})).toThrow('MBAP');
    expect(parser.bufferedBytes).toBe(0);
  });
  it('rejects non-Modbus protocol identifiers', () => {
    const b = readResponse(); b[3] = 1;
    expect(() => new ModbusTcpFramer().push(b, () => undefined, () => {})).toThrow('protocol');
  });
  it('accepts maximum legal ADU and never retains more than 260 bytes', () => {
    const p = new ModbusTcpFramer(), b = Buffer.alloc(260); b.writeUInt16BE(254, 4); const deliver = vi.fn();
    for (const byte of b) { p.push(Buffer.from([byte]), () => undefined, deliver); expect(p.bufferedBytes).toBeLessThan(MAX_MODBUS_ADU_BYTES); }
    expect(deliver).toHaveBeenCalledOnce();
  });
});
describe('DeviceConnection framing integration and request fences', () => {
  it('completes fragmented responses only once complete', async () => {
    const { c, socket } = await connected(), p = request(c), done = vi.fn(); p.then(done);
    const b = reply(c.tx); socket.emit('data', b.subarray(0, 2)); socket.emit('data', b.subarray(2, 9));
    await Promise.resolve(); expect(done).not.toHaveBeenCalled(); socket.emit('data', b.subarray(9)); await expect(p).resolves.toEqual(b);
  });
  it('correlates transactions and drops unsolicited coalesced future responses', async () => {
    const { c, socket } = await connected(), p = request(c);
    socket.emit('data', Buffer.concat([reply(99), reply(c.tx), reply(c.tx + 1, 999)])); await p;
    const next = request(c), done = vi.fn(); next.then(done); await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    socket.emit('data', reply(c.tx, 7)); expect((await next).readUInt16BE(9)).toBe(7);
  });
  it('a frame starting before the request cannot complete that request', async () => {
    const { c, socket } = await connected(); const early = reply(1, 999); socket.emit('data', early.subarray(0, 5));
    const p = request(c), done = vi.fn(); p.then(done); socket.emit('data', early.subarray(5)); await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    socket.emit('data', reply(c.tx, 7)); expect((await p).readUInt16BE(9)).toBe(7);
  });
  it('preserves timeouts and does not reuse expired transaction IDs after wrap', async () => {
    const { c, socket } = await connected(); const p = request(c), rejected = expect(p).rejects.toMatchObject({ code: 'TIMEOUT' });
    socket.emit('data', reply(c.tx).subarray(0, 8)); await vi.advanceTimersByTimeAsync(500); await rejected;
    expect(c.runtime.timeoutCount).toBe(1); c.tx = 0;
    const next = request(c); expect(c.tx).toBe(2);
    socket.emit('data', Buffer.concat([reply(1).subarray(8), reply(2, 7)])); expect((await next).readUInt16BE(9)).toBe(7);
  });
  it('disconnect clears partial state and old socket/generation cannot complete new work', async () => {
    const { c, socket } = await connected(); const p = request(c); const rejected = expect(p).rejects.toMatchObject({ code: 'MANUAL_DISCONNECT' });
    socket.emit('data', reply(c.tx).subarray(0, 10)); c.disconnect(); await rejected;
    const connect = c.connect(), fresh = sockets.at(-1)!; fresh.emit('connect'); await connect;
    const next = request(c), done = vi.fn(); next.then(done);
    socket.emit('data', reply(c.tx, 999)); await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    fresh.emit('data', reply(c.tx, 3)); expect((await next).readUInt16BE(9)).toBe(3);
  });
  it('rejects a success that crosses disconnect before the promise continuation', async () => {
    const { c, socket } = await connected(); const p = request(c), rejection = expect(p).rejects.toMatchObject({ code: 'STALE_REQUEST' });
    socket.emit('data', reply(c.tx)); c.disconnect(); await rejection;
  });
  it.each(['unit', 'function', 'byte-count'])('rejects mismatched %s response', async kind => {
    const { c, socket } = await connected(); const p = request(c), rejection = expect(p).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const b = reply(c.tx); b[kind === 'unit' ? 6 : kind === 'function' ? 7 : 8] = 9; socket.emit('data', b); await rejection;
  });
  it('invalid MBAP rejects active work and closes the corrupt stream', async () => {
    const { c, socket } = await connected(); const p = request(c), rejection = expect(p).rejects.toMatchObject({ code: 'INVALID_FRAME' });
    const b = reply(c.tx); b.writeUInt16BE(255, 4); socket.emit('data', b); await rejection; expect(c.runtime.actualState).toBe('disconnected');
  });
  it('preserves Modbus exceptions', async () => {
    const { c, socket } = await connected(); const p = request(c), rejection = expect(p).rejects.toMatchObject({ code: 'MODBUS_EXCEPTION' });
    const b = Buffer.from([0, c.tx, 0, 0, 0, 3, 1, 0x83, 2]); socket.emit('data', b); await rejection;
  });
  it('bounds acquisition admission and retains write > workflow > monitor > acquisition priority', async () => {
    const { c } = await connected(); const jobs = [request(c).catch(e => e)];
    for (let i = 0; i < 32; i++) jobs.push(request(c, { requestClass: 'acquisition' }).catch(e => e));
    await expect(request(c, { requestClass: 'acquisition' })).rejects.toMatchObject({ code: 'ACQUISITION_QUEUE_FULL' });
    jobs.push(request(c, { requestClass: 'monitor', monitorListId: 'm' }).catch(e => e));
    jobs.push(request(c).catch(e => e)); jobs.push(request(c, { fc: 6, values: [3], priority: true }).catch(e => e));
    expect(c.queue.slice(0, 4).map(j => j.r.requestClass)).toEqual(['write', 'workflow', 'monitor', 'acquisition']);
    c.disconnect(); await Promise.all(jobs); expect(c.queue).toHaveLength(0);
  });
  it.each([5, 6, 16])('acquisition class cannot enqueue FC%i writes', async fc => {
    const { c, socket } = await connected(); await expect(request(c, { requestClass: 'acquisition', fc })).rejects.toMatchObject({ code: 'READ_ONLY' }); expect(socket.sent).toHaveLength(0);
  });
  it('cancels only acquisition work, retaining the shared socket and workflow queue', async () => {
    const { c, socket } = await connected(); const p = request(c, { requestClass: 'acquisition', acquisitionOwner: 'a' });
    const rejection = expect(p).rejects.toMatchObject({ code: 'ACQUISITION_CANCELLED' }); const next = request(c);
    c.cancelAcquisitionRequests('a'); await rejection; await vi.advanceTimersByTimeAsync(0);
    expect(c.runtime.actualState).toBe('connected'); socket.emit('data', reply(c.tx)); await next;
  });
  it.each([5, 6, 16])('keeps FC%i write framing and zero-based addresses', async fc => {
    const { c, socket } = await connected(); const p = c.request({ unitId: 1, fc, address: 0, values: [7], priority: true });
    const sent = socket.sent[0]!; expect(sent.readUInt16BE(8)).toBe(0); expect(sent[7]).toBe(fc);
    const ack = Buffer.from(sent.subarray(0, 12)); ack.writeUInt16BE(6, 4); if (fc === 16) ack.writeUInt16BE(1, 10);
    socket.emit('data', ack); await expect(p).resolves.toEqual(ack);
  });
});
