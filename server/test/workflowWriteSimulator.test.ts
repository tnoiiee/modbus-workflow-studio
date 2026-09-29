import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowManager } from '../src/workflowManager.js';
import { WorkflowRuntimeManager } from '../src/runtimeSessions.js';
import { DeviceConnection } from '../src/modbus.js';
import { SharedTagAcquisition } from '../src/sharedTagAcquisition.js';
import { TagRuntimeStore } from '../src/tagRuntime.js';
import { availabilityReader } from '../src/tagDeliveryBroker.js';
import type { Workflow, WorkflowNode, DeviceConfig } from '../src/types.js';
import { device as baseDevice, fixture } from './acquisitionFixtures.js';

function simulator() {
  const coils = new Map<number, boolean>(), registers = new Map<number, number>(), frames: Buffer[] = [], replies: Buffer[] = [];
  const trace: Array<{ direction: 'REQUEST' | 'RESPONSE'; socketId: number; frame: Buffer; at: string }> = [];
  const sockets = new Set<number>(); let nextSocketId = 0;
  const server = net.createServer(socket => {
    const socketId = ++nextSocketId; sockets.add(socketId);
    socket.on('data', packet => {
    const request = Buffer.from(packet); frames.push(request); trace.push({ direction: 'REQUEST', socketId, frame: request, at: new Date().toISOString() }); const fc = request[7]!, address = request.readUInt16BE(8), quantity = request.readUInt16BE(10);
    let reply: Buffer;
    if (fc === 5) { coils.set(address, request.readUInt16BE(10) === 0xff00); reply = Buffer.from(request.subarray(0, 12)); }
    else if (fc === 6) { registers.set(address, request.readUInt16BE(10)); reply = Buffer.from(request.subarray(0, 12)); }
    else if (fc === 16) {
      const count = request.readUInt16BE(10); for (let i = 0; i < count; i++) registers.set(address + i, request.readUInt16BE(13 + i * 2));
      reply = Buffer.alloc(12); request.copy(reply, 0, 0, 7); reply.writeUInt16BE(6, 4); reply[7] = 16; request.copy(reply, 8, 8, 10); reply.writeUInt16BE(count, 10);
    } else if (fc === 1 || fc === 2) {
      const data = Buffer.alloc(Math.ceil(quantity / 8)); for (let i = 0; i < quantity; i++) if (coils.get(address + i)) data[Math.floor(i / 8)]! |= 1 << (i % 8);
      reply = Buffer.alloc(9 + data.length); request.copy(reply, 0, 0, 4); reply.writeUInt16BE(3 + data.length, 4); reply[6] = request[6]!; reply[7] = fc; reply[8] = data.length; data.copy(reply, 9);
    } else if (fc === 3 || fc === 4) {
      const data = Buffer.alloc(quantity * 2); for (let i = 0; i < quantity; i++) data.writeUInt16BE(registers.get(address + i) ?? 0, i * 2);
      reply = Buffer.alloc(9 + data.length); request.copy(reply, 0, 0, 4); reply.writeUInt16BE(3 + data.length, 4); reply[6] = request[6]!; reply[7] = fc; reply[8] = data.length; data.copy(reply, 9);
    } else return;
    replies.push(Buffer.from(reply)); trace.push({ direction: 'RESPONSE', socketId, frame: Buffer.from(reply), at: new Date().toISOString() });
    socket.write(reply);
    });
  });
  return { server, frames, replies, trace, sockets, coils, registers };
}
async function listen(server: net.Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
  if (!address || typeof address === 'string') throw Error('Simulator failed to listen'); return address.port;
}
async function until(test: () => boolean, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw Error('Condition did not become true before test deadline');
}
const n = (id: string, type: string, params: Record<string, unknown>, inputs = 0): WorkflowNode => ({ id, type, name: id, position: { x: 0, y: 0 }, inputCount: inputs, outputCount: type === 'MODBUS_OUTPUT' ? 0 : 1, params });
const legacy: Workflow = { version: 1, mode: 'DESIGN', running: false, nodes: [], edges: [], settings: { maxPasses: 100 } };
const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.useRealTimers(); });

describe('guarded Workflow write Simulator harness', () => {
  it('writes FC05, FC06 and FC16 through WorkflowRuntimeManager and observes an independent SHARED_TAG read-back', async () => {
    const sim = simulator(), port = await listen(sim.server), f = fixture();
    const actualDevice: DeviceConfig = { ...baseDevice, port, enabled: true };
    const store = new TagRuntimeStore(), connection = new DeviceConnection(actualDevice);
    cleanups.push(async () => { connection.disconnect(); await new Promise<void>(resolve => sim.server.close(() => resolve())); f.cleanup(); });
    await connection.connect();
    const readback = f.definition('Boolean'), mapping = f.map(readback.sourceId, { functionCode: 1, dataType: 'Boolean', width: 1, address: 0 }); f.config.put(mapping);
    const falseReadback = f.definition('Boolean'), falseMapping = f.map(falseReadback.sourceId, { functionCode: 1, dataType: 'Boolean', width: 1, address: 4 }); f.config.put(falseMapping);
    const zeroReadback = f.definition('Number'), zeroMapping = f.map(zeroReadback.sourceId, { functionCode: 3, dataType: 'UInt16', width: 1, address: 1 }); f.config.put(zeroMapping);
    const mismatchReadback = f.definition('Boolean'), mismatchMapping = f.map(mismatchReadback.sourceId, { functionCode: 1, dataType: 'Boolean', width: 1, address: 6 }); f.config.put(mismatchMapping);
    const acquisition = new SharedTagAcquisition(f.config, store, id => id === actualDevice.id ? connection : undefined); acquisition.start();
    expect(readback.sourceType).toBe('SHARED_TAG');
    expect(f.catalog.get({ sourceType: 'SHARED_TAG', sourceId: readback.sourceId })).toMatchObject({ enabled: true, dataType: 'Boolean' });
    expect(mapping).toMatchObject({ sourceId: readback.sourceId, deviceId: actualDevice.id, unitId: 1, functionCode: 1, address: 0, width: 1, dataType: 'Boolean', pollIntervalMs: 100, staleAfterMs: 300, enabled: true });
    expect(f.config.availability(mapping)).toBe('READY');
    expect(actualDevice.enabled).toBe(true); expect(connection.runtime.actualState).toBe('connected'); expect(connection.manual).toBe(false);
    await until(() => { const sample = store.get(readback.sourceId); return sample?.quality === 'GOOD' && sample.hasValue; });
    const preCommandSample = store.get(readback.sourceId)!;
    expect(preCommandSample.value).toBe(false);
    const preCommandTraceLength = sim.trace.length;
    const workflows = new WorkflowManager(f.dir, legacy), workflow = workflows.first();
    const nodes = [
      n('coil-source', 'BOOLEAN_CONSTANT', { value: true }),
      n('false-source', 'BOOLEAN_CONSTANT', { value: false }),
      n('register-source', 'NUMERIC_CONSTANT', { value: 0 }),
      n('float-source', 'NUMERIC_CONSTANT', { value: 12.5 }),
      n('mismatch-source', 'BOOLEAN_CONSTANT', { value: true }),
      n('coil-out', 'MODBUS_OUTPUT', { deviceId: actualDevice.id, unitId: 1, functionCode: 5, dataType: 'Boolean', address: 0, quantity: 1, polarity: 'NORMAL', writeOnChange: true, minimumWriteInterval: 0, readBackSourceId: readback.sourceId }, 1),
      n('false-coil-out', 'MODBUS_OUTPUT', { deviceId: actualDevice.id, unitId: 1, functionCode: 5, dataType: 'Boolean', address: 4, quantity: 1, polarity: 'NORMAL', writeOnChange: true, minimumWriteInterval: 0, readBackSourceId: falseReadback.sourceId }, 1),
      n('register-out', 'MODBUS_OUTPUT', { deviceId: actualDevice.id, unitId: 1, functionCode: 6, dataType: 'UInt16', address: 1, quantity: 1, order: 'ABCD', writeOnChange: true, minimumWriteInterval: 0, readBackSourceId: zeroReadback.sourceId }, 1),
      n('float-out', 'MODBUS_OUTPUT', { deviceId: actualDevice.id, unitId: 1, functionCode: 16, dataType: 'Float32', address: 3, quantity: 2, order: 'CDAB', writeOnChange: true, minimumWriteInterval: 0 }, 1),
      n('mismatch-out', 'MODBUS_OUTPUT', { deviceId: actualDevice.id, unitId: 1, functionCode: 5, dataType: 'Boolean', address: 5, quantity: 1, polarity: 'NORMAL', writeOnChange: true, minimumWriteInterval: 0, readBackSourceId: mismatchReadback.sourceId }, 1),
    ];
    const edges = [
      { id: 'e1', source: 'coil-source', sourcePort: 0, target: 'coil-out', targetPort: 0, enabled: true },
      { id: 'e2', source: 'false-source', sourcePort: 0, target: 'false-coil-out', targetPort: 0, enabled: true },
      { id: 'e3', source: 'register-source', sourcePort: 0, target: 'register-out', targetPort: 0, enabled: true },
      { id: 'e4', source: 'float-source', sourcePort: 0, target: 'float-out', targetPort: 0, enabled: true },
      { id: 'e5', source: 'mismatch-source', sourcePort: 0, target: 'mismatch-out', targetPort: 0, enabled: true },
    ];
    workflows.update(workflow.id, { mode: 'LIVE_ARMED', nodes, edges });
    const audit = vi.fn(), broadcast = vi.fn(), traffic: Array<Record<string, unknown>> = [];
    connection.on('traffic', (event: Record<string, unknown>) => traffic.push(event));
    const runtime = new WorkflowRuntimeManager({ workflows, getDevices: () => [actualDevice], getConnection: id => id === actualDevice.id ? connection : undefined,
      allowWrites: true, audit, broadcast, readBack: id => { const item = availabilityReader(f.catalog, f.config, () => [actualDevice], store)({ sourceType: 'SHARED_TAG', sourceId: id }); return { availability: item.availability, sample: item.sample }; }, subscribeTags: listener => store.subscribe(listener) });
    cleanups.push(() => { runtime.stopAll(); acquisition.stop(); });
    runtime.start(workflow.id);
    await until(() => ['coil-out', 'false-coil-out', 'register-out', 'float-out', 'mismatch-out'].every(id => ['WRITTEN', 'VERIFIED', 'MISMATCH'].includes(String(runtime.nodeRuntime(workflow.id, id)?.writeStatus))));
    await until(() => {
      const write = sim.trace.find(event => event.direction === 'REQUEST' && event.frame[6] === 1 && event.frame[7] === 5 && event.frame.readUInt16BE(8) === 0 && event.frame.readUInt16BE(10) === 0xff00);
      const writeIndex = write ? sim.trace.indexOf(write) : -1;
      const echoIndex = write ? sim.trace.findIndex((event, index) => index > writeIndex && event.direction === 'RESPONSE' && event.frame.readUInt16BE(0) === write.frame.readUInt16BE(0)) : -1;
      const readIndex = echoIndex >= 0 ? sim.trace.findIndex((event, index) => index > echoIndex && event.direction === 'REQUEST' && event.frame[6] === 1 && event.frame[7] === 1 && event.frame.readUInt16BE(8) === 0 && event.frame.readUInt16BE(10) === 1) : -1;
      const read = readIndex >= 0 ? sim.trace[readIndex] : undefined;
      const readResponse = read ? sim.trace.find((event, index) => index > readIndex && event.direction === 'RESPONSE' && event.frame.readUInt16BE(0) === read.frame.readUInt16BE(0)) : undefined;
      const sample = store.get(readback.sourceId), result = runtime.nodeRuntime(workflow.id, 'coil-out');
      return Boolean(sample && sample.sampleSequence > preCommandSample.sampleSequence && sample.quality === 'GOOD' && sample.value === true &&
        readResponse?.frame[7] === 1 && readResponse.frame[8] === 1 && (readResponse.frame[9]! & 1) === 1 && result?.writeStatus === 'VERIFIED');
    });
    const postCommandSample = store.get(readback.sourceId)!;
    const writeRequest = sim.trace.find(event => event.direction === 'REQUEST' && event.frame[6] === 1 && event.frame[7] === 5 && event.frame.readUInt16BE(8) === 0 && event.frame.readUInt16BE(10) === 0xff00)!;
    const writeTraceIndex = sim.trace.indexOf(writeRequest);
    expect(sim.trace.slice(0, preCommandTraceLength).some(event => event.direction === 'REQUEST' && event.frame[7] === 1 && event.frame.readUInt16BE(8) === 0)).toBe(true);
    const writeResponse = sim.trace.find((event, index) => index > writeTraceIndex && event.direction === 'RESPONSE' && event.frame.readUInt16BE(0) === writeRequest.frame.readUInt16BE(0))!;
    const writeResponseIndex = sim.trace.indexOf(writeResponse);
    const freshReadRequest = sim.trace.find((event, index) => index > writeResponseIndex && event.direction === 'REQUEST' && event.frame[6] === 1 && event.frame[7] === 1 && event.frame.readUInt16BE(8) === 0 && event.frame.readUInt16BE(10) === 1)!;
    const freshReadRequestIndex = sim.trace.indexOf(freshReadRequest);
    const freshReadResponse = sim.trace.find((event, index) => index > freshReadRequestIndex && event.direction === 'RESPONSE' && event.frame.readUInt16BE(0) === freshReadRequest.frame.readUInt16BE(0))!;
    const coilRuntime = runtime.nodeRuntime(workflow.id, 'coil-out')!;
    expect(postCommandSample.sampleSequence).toBeGreaterThan(preCommandSample.sampleSequence);
    expect(Date.parse(postCommandSample.receiveTimestamp!)).toBeGreaterThan(Date.parse(preCommandSample.receiveTimestamp!));
    expect(writeResponse.frame).toEqual(writeRequest.frame.subarray(0, 12));
    expect(freshReadResponse.frame).toHaveLength(10); expect(freshReadResponse.frame[8]).toBe(1); expect((freshReadResponse.frame[9]! & 1)).toBe(1);
    expect(sim.sockets.size).toBe(1); expect(writeRequest.socketId).toBe(freshReadRequest.socketId);
    expect(connection.generation).toBe(1); expect(connection.manual).toBe(false); expect(runtime.summary(workflow.id)?.pollerCount).toBe(0);
    const emitted = sim.frames.map(frame => ({ fc: frame[7], address: frame.readUInt16BE(8), payload: frame.subarray(7).toString('hex') }));
    expect(emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({ fc: 5, address: 0, payload: '05' + '0000' + 'ff00' }),
      expect.objectContaining({ fc: 5, address: 4, payload: '05' + '0004' + '0000' }),
      expect.objectContaining({ fc: 5, address: 5, payload: '05' + '0005' + 'ff00' }),
      expect.objectContaining({ fc: 6, address: 1, payload: '06' + '0001' + '0000' }),
      expect.objectContaining({ fc: 16, address: 3 }),
    ]));
    expect(sim.coils.get(0)).toBe(true); expect(sim.coils.get(4)).toBe(false); expect(sim.registers.get(1)).toBe(0);
    expect(connection.generation).toBe(1); // One already-connected Device; acquisition did not open another connection.
    expect(sim.frames.filter(frame => [5, 6, 16].includes(frame[7]!))).toHaveLength(5);
    expect(runtime.nodeRuntime(workflow.id, 'coil-out')).toMatchObject({ commandedValue: true, effectiveValue: true, readBackValue: true, readBackHasValue: true, readBackQuality: 'GOOD', readBackMismatch: false, writeStatus: 'VERIFIED' });
    expect(runtime.nodeRuntime(workflow.id, 'false-coil-out')).toMatchObject({ commandedValue: false, effectiveValue: false, readBackValue: false, readBackHasValue: true, readBackQuality: 'GOOD', readBackMismatch: false, writeStatus: 'VERIFIED' });
    expect(runtime.nodeRuntime(workflow.id, 'register-out')).toMatchObject({ commandedValue: 0, effectiveValue: 0, readBackValue: 0, readBackHasValue: true, readBackQuality: 'GOOD', readBackMismatch: false, writeStatus: 'VERIFIED' });
    expect(runtime.nodeRuntime(workflow.id, 'float-out')?.writeStatus).toBe('WRITTEN');
    expect(runtime.nodeRuntime(workflow.id, 'mismatch-out')).toMatchObject({ commandedValue: true, effectiveValue: true, readBackValue: false, readBackHasValue: true, readBackQuality: 'GOOD', readBackMismatch: true, writeStatus: 'MISMATCH' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'WORKFLOW_WRITE_QUEUED', nodeId: 'coil-out', commandId: coilRuntime.commandId, workflowId: workflow.id, deviceId: actualDevice.id }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'WORKFLOW_WRITE_RESULT', nodeId: 'coil-out', commandId: coilRuntime.commandId, result: 'WRITTEN', effectiveValue: true }));
    const tx = traffic.filter(event => event.direction === 'TX' && [5, 6, 16].includes(Number(event.fc)));
    const rx = traffic.filter(event => event.direction === 'RX' && [5, 6, 16].includes(Number(event.fc)));
    expect(tx).toHaveLength(5); expect(rx).toHaveLength(5);
    for (const event of tx) expect(event.commandId).toEqual(expect.any(String));
    expect(rx.map(event => event.commandId).sort()).toEqual(tx.map(event => event.commandId).sort());
    expect(broadcast).toHaveBeenCalledWith('runtime', expect.any(Object), workflow.id);
    expect(connection.runtime.actualState).toBe('connected');
  });

  it('fails closed when writes are disabled, not armed, ownership is conflicted, or no connected Device exists', () => {
    const f = fixture(), workflows = new WorkflowManager(f.dir, legacy), workflow = workflows.first(); cleanups.push(f.cleanup);
    const nodes = [n('source', 'BOOLEAN_CONSTANT', { value: true }), n('out', 'MODBUS_OUTPUT', { deviceId: baseDevice.id, functionCode: 5, dataType: 'Boolean', address: 0 }, 1)];
    const edges = [{ id: 'edge', source: 'source', sourcePort: 0, target: 'out', targetPort: 0, enabled: true }];
    const connection = { runtime: { actualState: 'connected' }, generation: 1, manual: false, request: vi.fn(), cancelWorkflowWrites: vi.fn() } as unknown as DeviceConnection;
    workflows.update(workflow.id, { mode: 'LIVE_LOCKED', nodes, edges });
    const lockedMode = new WorkflowRuntimeManager({ workflows, getDevices: () => [baseDevice], getConnection: () => connection, allowWrites: true, audit: vi.fn(), broadcast: vi.fn() });
    lockedMode.start(workflow.id); expect(connection.request).not.toHaveBeenCalled(); lockedMode.stop(workflow.id);
    workflows.update(workflow.id, { mode: 'LIVE_ARMED', nodes, edges });
    const lockedByDefault = new WorkflowRuntimeManager({ workflows, getDevices: () => [baseDevice], getConnection: () => connection, allowWrites: false, audit: vi.fn(), broadcast: vi.fn() });
    expect(() => lockedByDefault.start(workflow.id)).toThrow('ALLOW_WRITES=false'); expect(connection.request).not.toHaveBeenCalled();
    const rejectedAudit = vi.fn(), noConnection = new WorkflowRuntimeManager({ workflows, getDevices: () => [baseDevice], getConnection: () => undefined, allowWrites: true, audit: rejectedAudit, broadcast: vi.fn() });
    noConnection.start(workflow.id); expect(noConnection.nodeRuntime(workflow.id, 'out')).toMatchObject({ writeStatus: 'REJECTED', rejectionReason: 'DEVICE_NOT_CONNECTED', queueState: 'NOT_QUEUED' });
    expect(noConnection.nodeRuntime(workflow.id, 'out')?.effectiveValue).toBeUndefined();
    expect(rejectedAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'WORKFLOW_WRITE_REJECTED', reason: 'DEVICE_NOT_CONNECTED', decision: 'REJECTED' }));
    const competing = workflows.create('Competing Owner'); workflows.update(competing.id, { mode: 'LIVE_ARMED', nodes, edges });
    expect(() => noConnection.start(competing.id)).toThrow('Output resource conflict');
    expect(connection.request).not.toHaveBeenCalled(); noConnection.stopAll();
  });
});
