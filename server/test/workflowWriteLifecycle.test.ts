import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowManager } from '../src/workflowManager.js';
import { WorkflowRuntimeManager } from '../src/runtimeSessions.js';
import type { DeviceConnection, Request as ModbusRequest } from '../src/modbus.js';
import type { TagSample } from '../src/tagRuntime.js';
import type { Workflow, WorkflowNode } from '../src/types.js';
import { device, fixture, readResponse } from './acquisitionFixtures.js';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); vi.useRealTimers(); });
const node = (id: string, type: string, params: Record<string, unknown> = {}, inputCount = 0): WorkflowNode => ({ id, type, name: id, position: { x: 0, y: 0 }, inputCount, outputCount: type === 'MODBUS_OUTPUT' ? 0 : 1, params });
const legacy: Workflow = { version: 1, mode: 'DESIGN', running: false, nodes: [], edges: [], settings: {} };
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup(two = false, readBack?: () => { availability: string; sample: TagSample | null }) {
  const f = fixture(), workflows = new WorkflowManager(f.dir, legacy), first = workflows.first();
  const outputParams: Record<string, unknown> = { deviceId: device.id, unitId: 1, functionCode: 5, dataType: 'Boolean', address: 7, quantity: 1, polarity: 'NORMAL', writeOnChange: true, minimumWriteInterval: 0 };
  if (readBack) outputParams.readBackSourceId = '11111111-1111-4111-8111-111111111111';
  const output = node('out', 'MODBUS_OUTPUT', outputParams, 1);
  const source = node('source', 'BOOLEAN_CONSTANT', { value: true });
  const graph = { nodes: [source, output], edges: [{ id: 'edge', source: source.id, sourcePort: 0, target: output.id, targetPort: 0, enabled: true }] };
  workflows.update(first.id, { ...graph, mode: 'LIVE_ARMED' });
  const other = two ? workflows.create('Other Workflow') : undefined;
  if (other) workflows.update(other.id, { ...graph, mode: 'LIVE_ARMED' });
  type PendingTestRequest = { request: Omit<ModbusRequest, 'generation'>; promise: Promise<Buffer>; resolve: (value: Buffer) => void; reject: (error: Error) => void; cancelled: boolean };
  const pending: PendingTestRequest[] = [], executableWrites = new Set<PendingTestRequest>();
  const connection = { runtime: { actualState: 'connected' }, generation: 1, manual: false, activeRequest: undefined,
    request: vi.fn((request: Omit<ModbusRequest, 'generation'>) => {
      const deferredRequest = deferred<Buffer>();
      const entry: PendingTestRequest = { request, promise: deferredRequest.promise, cancelled: false,
        resolve: value => { executableWrites.delete(entry); deferredRequest.resolve(value); },
        reject: error => { executableWrites.delete(entry); deferredRequest.reject(error); } };
      pending.push(entry); if (request.requestClass === 'write') executableWrites.add(entry);
      Object.defineProperty(entry.promise, 'admitted', { value: true }); return entry.promise;
    }),
    cancelWorkflowWrites: vi.fn((workflowId: string, runtimeGeneration?: number) => {
      let cancelled = 0;
      for (const entry of [...executableWrites]) if (entry.request.workflowId === workflowId && (runtimeGeneration === undefined || entry.request.runtimeGeneration === runtimeGeneration)) {
        entry.cancelled = true; entry.reject(Object.assign(new Error('Workflow stopped or disconnected before Device execution'), { code: 'WRITE_CANCELLED' })); cancelled++;
      }
      return cancelled;
    }), } as unknown as DeviceConnection;
  const audit = vi.fn(), broadcast = vi.fn(); let monotonic = 0;
  const runtime = new WorkflowRuntimeManager({ workflows, getDevices: () => [device], getConnection: () => connection, allowWrites: true, audit, broadcast,
    monotonicNow: () => monotonic, ...(readBack ? { readBack, subscribeTags: () => () => {} } : {}) });
  cleanups.push(() => { runtime.stopAll(); f.cleanup(); });
  return { f, workflows, first, other, graph, pending, executableWrites, advanceMonotonic: (ms: number) => { monotonic += ms; }, connection, runtime, audit, broadcast };
}

describe('Workflow write lifecycle fences', () => {
  it('keeps writes independent of optional read-back and represents no sample without a fabricated false/zero', () => {
    const f = setup(false, () => ({ availability: 'NO_SAMPLE', sample: null })); f.runtime.start(f.first.id);
    expect(f.runtime.nodeRuntime(f.first.id, 'out')).toMatchObject({ writeStatus: 'QUEUED', queueState: 'QUEUED', readBackAvailability: 'NO_SAMPLE', readBackHasValue: false });
    expect(f.runtime.nodeRuntime(f.first.id, 'out')?.readBackValue).toBeUndefined();
    f.runtime.stop(f.first.id);
  });

  it('Stop cancels queued work, fences late completions, and a subsequent explicit start gets a fresh command', async () => {
    const f = setup(); f.runtime.start(f.first.id);
    expect(f.runtime.summary(f.first.id)?.pendingWriteCount).toBe(1);
    const oldId = f.runtime.nodeRuntime(f.first.id, 'out')?.commandId;
    f.runtime.stop(f.first.id);
    expect(f.connection.cancelWorkflowWrites).toHaveBeenCalledWith(f.first.id, 1);
    expect(f.runtime.nodeRuntime(f.first.id, 'out')).toMatchObject({ writeStatus: 'REJECTED', queueState: 'CANCELLED', rejectionReason: 'WORKFLOW_STOPPED' });
    f.pending[0]!.resolve(Buffer.alloc(12)); await Promise.resolve(); await Promise.resolve();
    expect(f.runtime.nodeRuntime(f.first.id, 'out')).toMatchObject({ writeStatus: 'REJECTED', commandId: oldId });
    expect(f.runtime.nodeRuntime(f.first.id, 'out')?.effectiveValue).toBeUndefined();
    f.runtime.start(f.first.id);
    expect(f.runtime.nodeRuntime(f.first.id, 'out')?.commandId).not.toBe(oldId);
    expect(f.pending).toHaveLength(2);
  });

  it('Delete fences pending work and releases resource ownership for another Workflow', async () => {
    const f = setup(true), other = f.other!; f.runtime.start(f.first.id);
    f.runtime.delete(f.first.id); f.workflows.delete(f.first.id);
    expect(f.connection.cancelWorkflowWrites).toHaveBeenCalledWith(f.first.id, 1);
    f.runtime.start(other.id);
    expect(f.pending).toHaveLength(2);
    const secondId = f.runtime.nodeRuntime(other.id, 'out')?.commandId;
    f.pending[0]!.resolve(Buffer.alloc(12)); await Promise.resolve(); await Promise.resolve();
    expect(f.runtime.nodeRuntime(other.id, 'out')?.commandId).toBe(secondId);
    expect(f.runtime.nodeRuntime(other.id, 'out')?.effectiveValue).toBeUndefined();
  });

  it('manual disconnect cancels/fences work; reconnect polling does not replay the old command', async () => {
    const f = setup();
    const input = node('input', 'MODBUS_INPUT', { deviceId: device.id, unitId: 1, functionCode: 1, address: 0, dataType: 'Boolean', scanInterval: 1000 });
    const output = f.graph.nodes[1]!;
    f.workflows.update(f.first.id, { mode: 'LIVE_ARMED', nodes: [input, output], edges: [{ id: 'edge', source: 'input', sourcePort: 0, target: 'out', targetPort: 0, enabled: true }] });
    f.runtime.start(f.first.id);
    expect(f.pending[0]!.request.requestClass).not.toBe('write');
    f.pending[0]!.resolve(readResponse(1, 1)); await vi.waitFor(() => expect(f.pending).toHaveLength(2));
    expect(f.pending[1]!.request.requestClass).toBe('write');
    expect(f.runtime.nodeRuntime(f.first.id, 'out')).toMatchObject({ writeStatus: 'QUEUED', queueState: 'QUEUED', admissionResult: 'ACCEPTED' });
    expect(f.executableWrites.size).toBe(1);
    const oldRuntime = f.runtime.nodeRuntime(f.first.id, 'out')!;
    const oldId = oldRuntime.commandId, oldRuntimeGeneration = oldRuntime.runtimeGeneration, oldConnectionGeneration = oldRuntime.connectionGeneration, oldExpiry = oldRuntime.expiresAtMonotonic;
    expect(oldId).toEqual(expect.any(String)); expect(oldConnectionGeneration).toBe(1);
    expect(f.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'WORKFLOW_WRITE_QUEUED', commandId: oldId, workflowId: f.first.id }));
    f.connection.generation = 2; f.connection.runtime.actualState = 'disconnected'; f.connection.manual = true;
    f.runtime.onDeviceDisconnected(device.id);
    expect(f.connection.cancelWorkflowWrites).toHaveBeenCalledWith(f.first.id, 1);
    expect(f.pending[1]!.cancelled).toBe(true); expect(f.executableWrites.size).toBe(0);
    expect(f.pending.filter(item => item.request.requestClass === 'write' && item.cancelled)).toHaveLength(1);
    f.pending[1]!.resolve(Buffer.alloc(12)); await Promise.resolve(); await Promise.resolve();
    expect(f.runtime.nodeRuntime(f.first.id, 'out')).toMatchObject({ commandId: oldId, writeStatus: 'REJECTED', queueState: 'CANCELLED', rejectionReason: 'MANUAL_DISCONNECT', connectionGeneration: oldConnectionGeneration, runtimeGeneration: oldRuntimeGeneration });
    expect(f.runtime.summary(f.first.id)?.pendingWriteCount).toBe(0);
    expect(f.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'WORKFLOW_WRITE_RESULT', commandId: oldId, reason: 'WRITE_CANCELLED', decision: 'CANCELLED' }));
    const rejectedId = f.runtime.nodeRuntime(f.first.id, 'out')?.commandId;
    expect(rejectedId).toBe(oldId);
    f.connection.generation = 3; f.connection.manual = false; f.connection.runtime.actualState = 'connected';
    f.runtime.onDeviceConnected(device.id);
    expect(f.pending).toHaveLength(3); expect(f.pending[2]!.request.requestClass).not.toBe('write');
    f.pending[2]!.resolve(readResponse(1, 1)); await vi.waitFor(() => expect(f.runtime.nodeRuntime(f.first.id, 'input')?.value).toBe(true));
    expect(f.pending).toHaveLength(3); expect(f.executableWrites.size).toBe(0);
    expect(f.runtime.nodeRuntime(f.first.id, 'out')).toMatchObject({ commandId: oldId, writeStatus: 'REJECTED', queueState: 'CANCELLED', rejectionReason: 'MANUAL_DISCONNECT' });
    f.advanceMonotonic(100);
    f.runtime.onDeviceConnected(device.id);
    expect(f.pending).toHaveLength(4); expect(f.pending[3]!.request.requestClass).not.toBe('write');
    f.pending[3]!.resolve(readResponse(0, 1)); await vi.waitFor(() => expect(f.pending).toHaveLength(5));
    const fresh = f.runtime.nodeRuntime(f.first.id, 'out')!;
    expect(f.pending[4]!.request.requestClass).toBe('write');
    expect(f.pending[4]!.request.commandId).not.toBe(oldId);
    expect(f.pending[4]!.request.runtimeGeneration).toBe(fresh.runtimeGeneration);
    expect(f.connection.generation).toBe(3);
    expect(fresh.commandId).toBe(f.pending[4]!.request.commandId);
    expect(fresh.runtimeGeneration).toBe(oldRuntimeGeneration);
    expect(fresh.connectionGeneration).toBe(3);
    expect(fresh.expiresAtMonotonic).toBeGreaterThan(oldExpiry!);
    expect(f.runtime.summary(f.first.id)?.pendingWriteCount).toBe(1);
  });

  it('does not automatically retry a read-back mismatch, even when write-on-change is disabled', async () => {
    const sourceId = '11111111-1111-4111-8111-111111111111';
    const sample: TagSample = { source: { sourceType: 'SHARED_TAG', sourceId }, dataType: 'Boolean', value: false, hasValue: true, quality: 'GOOD', reason: 'READ_OK', sourceTimestamp: null,
      receiveTimestamp: '2026-09-29T00:00:00.000Z', stateUpdatedAt: '2026-09-29T00:00:00.000Z', serverEpoch: 'test', sampleSequence: 1, lastGoodValue: false, lastGoodReceiveTimestamp: '2026-09-29T00:00:00.000Z' };
    const f = setup(false, () => ({ availability: 'AVAILABLE', sample }));
    const trigger = node('trigger', 'MANUAL_TRIGGER', { triggerMode: 'MOMENTARY' });
    const output = node('out', 'MODBUS_OUTPUT', { ...(f.graph.nodes[1]!.params), writeOnChange: false }, 1);
    f.workflows.update(f.first.id, { mode: 'LIVE_ARMED', nodes: [trigger, output], edges: [{ id: 'edge', source: 'trigger', sourcePort: 0, target: 'out', targetPort: 0, enabled: true }] });
    f.runtime.start(f.first.id);
    expect(f.pending[0]!.request.requestClass).toBe('write'); expect(f.pending[0]!.request.values).toEqual([0]);
    f.pending[0]!.resolve(Buffer.alloc(12)); await vi.waitFor(() => expect(f.runtime.nodeRuntime(f.first.id, 'out')?.writeStatus).toBe('VERIFIED'));
    f.runtime.manualTrigger(f.first.id, 'trigger', 'press');
    expect(f.pending).toHaveLength(2); expect(f.pending[1]!.request.values).toEqual([0xff00]);
    f.pending[1]!.resolve(Buffer.alloc(12)); await vi.waitFor(() => expect(f.runtime.nodeRuntime(f.first.id, 'out')?.writeStatus).toBe('MISMATCH'));
    const mismatchedId = f.runtime.nodeRuntime(f.first.id, 'out')?.commandId;
    f.runtime.manualTrigger(f.first.id, 'trigger', 'press');
    expect(f.pending).toHaveLength(2);
    expect(f.runtime.nodeRuntime(f.first.id, 'out')).toMatchObject({ writeStatus: 'MISMATCH', readBackMismatch: true, commandId: mismatchedId });
  });

  it('resets Manual Trigger on Stop and never replays its value on restart', () => {
    const f = setup(), trigger = node('trigger', 'MANUAL_TRIGGER', { triggerMode: 'TOGGLE' });
    f.workflows.update(f.first.id, { mode: 'LIVE_LOCKED', nodes: [trigger], edges: [] });
    f.runtime.start(f.first.id); f.runtime.manualTrigger(f.first.id, 'trigger', 'toggle');
    expect(f.runtime.nodeRuntime(f.first.id, 'trigger')?.value).toBe(true);
    f.runtime.stop(f.first.id); expect(f.runtime.nodeRuntime(f.first.id, 'trigger')?.value).toBe(false);
    f.runtime.start(f.first.id); expect(f.runtime.nodeRuntime(f.first.id, 'trigger')?.value).toBe(false);
    expect(f.connection.request).not.toHaveBeenCalled();
  });
});
