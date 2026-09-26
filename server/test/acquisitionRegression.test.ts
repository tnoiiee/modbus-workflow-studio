import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowManager } from '../src/workflowManager.js';
import { WorkflowRuntimeManager } from '../src/runtimeSessions.js';
import { SharedTagAcquisition } from '../src/sharedTagAcquisition.js';
import { TagRuntimeStore } from '../src/tagRuntime.js';
import { ModbusMonitorManager } from '../src/monitor.js';
import type { DeviceConnection } from '../src/modbus.js';
import type { Workflow, WorkflowNode } from '../src/types.js';
import { device, fixture, readResponse } from './acquisitionFixtures.js';
const cleanups: (() => void)[] = [];
afterEach(() => { for (const fn of cleanups.splice(0).reverse()) fn(); vi.useRealTimers(); });
function setup(allowWrites = false) {
  vi.useFakeTimers(); const f = fixture(); cleanups.push(f.cleanup);
  const request = vi.fn(async (r: { fc: number }) => r.fc <= 4 ? readResponse(42, r.fc) : Buffer.alloc(12));
  const connection = { runtime: { actualState: 'connected' }, generation: 1, manual: false, request, cancelMonitorRequests: vi.fn(), cancelAcquisitionRequests: vi.fn() } as unknown as DeviceConnection;
  const legacy: Workflow = { version: 1, mode: 'DESIGN', running: false, nodes: [], edges: [], settings: {} };
  const workflows = new WorkflowManager(f.dir, legacy), broadcast = vi.fn(), audit = vi.fn();
  const runtime = new WorkflowRuntimeManager({ workflows, getDevices: () => [device], getConnection: () => connection, allowWrites, broadcast, audit });
  cleanups.push(() => { runtime.stopAll(); });
  const acquisition = new SharedTagAcquisition(f.config, new TagRuntimeStore(), () => connection, () => Date.now()); cleanups.push(() => acquisition.stop());
  return { ...f, workflows, runtime, connection, request, acquisition, broadcast, audit };
}
const node = (id: string, type: string, params: Record<string, unknown> = {}, inputCount = 0): WorkflowNode => ({ id, name: id, type, position: { x: 0, y: 0 }, inputCount, outputCount: 1, params });
describe('protected owners alongside Shared Tags', () => {
  it('keeps Workflow reads, independent sessions and stop isolation; explicitly does not dedup across owners', async () => {
    const f = setup(), a = f.workflows.first(), b = f.workflows.create('B'), mapping = f.map(); f.config.put(mapping);
    for (const w of [a, b]) f.workflows.update(w.id, { mode: 'LIVE_LOCKED', nodes: [node('same-id', 'MODBUS_INPUT', { deviceId: device.id, functionCode: 3, address: 0, scanInterval: 100 })] });
    f.runtime.start(a.id); f.runtime.start(b.id); f.acquisition.start(); await vi.advanceTimersByTimeAsync(0);
    expect(f.request).toHaveBeenCalledTimes(3); expect(f.runtime.nodeRuntime(a.id, 'same-id')!.value).toBe(42); expect(f.runtime.nodeRuntime(b.id, 'same-id')!.value).toBe(42);
    f.runtime.stop(a.id); const aState = f.runtime.runtime(a.id); await vi.advanceTimersByTimeAsync(250); expect(f.runtime.runtime(a.id)).toEqual(aState); expect(f.runtime.isRunning(b.id)).toBe(true); expect(f.acquisition.diagnostics().running).toBe(true);
    f.connection.runtime.actualState = 'disconnected'; f.connection.generation++; f.runtime.onDeviceDisconnected(device.id); f.acquisition.reconcile();
    expect(f.runtime.nodeRuntime(b.id, 'same-id')!.quality).toBe('DISCONNECTED'); expect(f.acquisition.store.get(mapping.sourceId)!.quality).toBe('DISCONNECTED'); const count = f.request.mock.calls.length; await vi.advanceTimersByTimeAsync(250); expect(f.request).toHaveBeenCalledTimes(count);
  });
  it('Monitor continues independently and its stop cannot stop Tag acquisition', async () => {
    const f = setup(), m = f.map(); f.config.put(m); f.acquisition.start(); await vi.advanceTimersByTimeAsync(0);
    const monitor = new ModbusMonitorManager({ dataDir: f.dir, getDevices: () => [device], getConnection: () => f.connection, broadcast: f.broadcast, audit: f.audit });
    const list = monitor.create('Read only'); monitor.update(list.id, { deviceId: device.id, items: [{ id: 'x', enabled: true, tagName: 'X', functionCode: 3, address: 0, dataType: 'UInt16', quantity: 1, order: 'ABCD', scale: 1, offset: 0, engineeringUnit: '' }] });
    await monitor.read(list.id); expect(f.request).toHaveBeenCalledTimes(2); monitor.stop(list.id); expect(f.connection.cancelMonitorRequests).toHaveBeenCalledWith(list.id); await vi.advanceTimersByTimeAsync(100); expect(f.acquisition.store.get(m.sourceId)!.quality).toBe('GOOD');
  });
  it('preserves LIVE_ARMED global write guard', () => {
    const f = setup(false), w = f.workflows.first(); f.workflows.update(w.id, { mode: 'LIVE_ARMED' }); expect(() => f.runtime.start(w.id)).toThrow('ALLOW_WRITES=false'); expect(f.request).not.toHaveBeenCalled();
  });
  it('retains write ownership, write-on-change, commanded/effective separation and stop suppression', async () => {
    const f = setup(true), a = f.workflows.first(), b = f.workflows.create('Other');
    const nodes = [node('source', 'BOOLEAN_CONSTANT', { value: true }), node('out', 'MODBUS_OUTPUT', { deviceId: device.id, functionCode: 5, address: 0, polarity: 'ACTIVE_LOW', initialWritePolicy: 'WRITE_ON_START', writeOnChange: true }, 1)];
    const edges = [{ id: 'edge', source: 'source', sourcePort: 0, target: 'out', targetPort: 0, enabled: true }];
    for (const w of [a, b]) f.workflows.update(w.id, { mode: 'LIVE_ARMED', nodes, edges });
    f.runtime.start(a.id); await vi.advanceTimersByTimeAsync(0); expect(f.request).toHaveBeenCalledWith(expect.objectContaining({ fc: 5, priority: true, values: [0], workflowId: a.id }));
    expect(f.runtime.nodeRuntime(a.id, 'out')).toMatchObject({ commandedValue: true, effectiveValue: false, writeStatus: 'WRITTEN' });
    expect(() => f.runtime.start(b.id)).toThrow('conflict'); f.runtime.start(a.id); await vi.advanceTimersByTimeAsync(1000); expect(f.request).toHaveBeenCalledTimes(1);
    f.runtime.stop(a.id); await vi.advanceTimersByTimeAsync(500); expect(f.request).toHaveBeenCalledTimes(1);
    f.runtime.start(b.id); await vi.advanceTimersByTimeAsync(0); expect(f.request).toHaveBeenCalledTimes(2);
  });
});
