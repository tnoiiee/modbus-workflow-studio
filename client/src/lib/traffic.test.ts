import { describe, it, expect, vi } from 'vitest';
import { normalizeTrafficRow, trafficText, TrafficPresentation, TRAFFIC_COLUMNS } from './traffic.js';
const rx = { timestamp: '2026-09-26T12:00:00Z', direction: 'RX', deviceId: 'plc', tx: 0, fc: 3, address: 0, duration: 0, result: 'success', payload: '0001000000050103020000' };
describe('dedicated tolerant Traffic display model', () => {
  it('normalizes both observed UI shapes to the same fields; result and payload are never dropped', () => {
    const a = normalizeTrafficRow({ ...rx, workflowId: 'workflow-id', nodeId: 'node-id', requestClass: 'workflow' });
    const b = normalizeTrafficRow({ ...rx, requestClass: 'acquisition' }); expect(Object.keys(a)).toEqual(Object.keys(b));
    expect(a).toMatchObject({ result: 'success', payload: rx.payload, origin: 'Workflow', phase: 'RX' });
    expect(b).toMatchObject({ result: 'success', payload: rx.payload, origin: 'Shared Tag Acquisition', workflowId: null, nodeId: null });
    expect(TRAFFIC_COLUMNS).toContain('Result'); expect(TRAFFIC_COLUMNS).toContain('Payload / error');
  });
  it.each(['TX','RX','ERROR'])('takes phase only from existing %s direction', direction => { expect(normalizeTrafficRow({ ...rx, direction, result: 'other' }).phase).toBe(direction); });
  it('does not infer phase from result or request class', () => { expect(normalizeTrafficRow({ result: 'error', requestClass: 'acquisition' }).phase).toBe('Unspecified'); });
  it('proves Monitor only from contractual class/list/synthetic context, not display names', () => {
    for (const context of [{ requestClass: 'monitor' }, { monitorListId: 'list' }, { workflowId: 'monitor:list' }]) expect(normalizeTrafficRow({ ...rx, ...context }).origin).toBe('Modbus Monitor');
    expect(normalizeTrafficRow({ ...rx, deviceId: 'monitor:plc', nodeId: 'acquisition', requestClass: 'workflow' }).origin).toBe('Generic / Unspecified');
    expect(normalizeTrafficRow({ ...rx, requestClass: 'acquisition', workflowId: 'unexpected' }).origin).toBe('Shared Tag Acquisition');
  });
  it.each([null, undefined, false, 0, 'bad', [], {}, { direction: {} }, { timestamp: null }])('handles malformed record %j without a crash', raw => {
    const model = normalizeTrafficRow(raw); expect(model.phase).toBe('Unspecified'); expect(model.malformed).toBe(true); expect(trafficText(model.payload)).toBe('—');
  });
  it('never executes arbitrary serializers or getters', () => {
    const getter = vi.fn(() => { throw Error('not safe'); }); const raw = { payload: { toString: getter, toJSON: getter } }; Object.defineProperty(raw, 'error', { get: getter });
    expect(normalizeTrafficRow(raw)).toMatchObject({ payload: null, error: null }); expect(getter).not.toHaveBeenCalled();
  });
  it('preserves meaningful zero and false primitives, rejects nonfinite numeric metadata', () => {
    expect(normalizeTrafficRow({ ...rx, result: false, payload: 0 })).toMatchObject({ tx: 0, address: 0, duration: 0, result: 'false', payload: '0' });
    expect(normalizeTrafficRow({ tx: NaN, fc: Infinity, address: -1, duration: Infinity })).toMatchObject({ tx: null, fc: null, address: null, duration: null });
  });
  it('bounds and escapes control characters while leaving markup for React text escaping', () => {
    expect(trafficText('A'.repeat(1000000))).toHaveLength(97); expect(trafficText('\n\u0000')).toBe('\\u000a\\u0000');
    expect(trafficText('<script>')).toBe('<script>'); expect(trafficText(null)).toBe('—');
  });
  it('keeps received order and repeated tx/context rows without grouping or deduplication', () => {
    const presenter = new TrafficPresentation(), rows = [rx, { ...rx }, { ...rx, direction: 'TX' }, rx];
    const normalized = presenter.normalize(rows); expect(normalized).toHaveLength(4); expect(normalized.map(r => r.phase)).toEqual(['RX','RX','TX','RX']); expect(new Set(normalized.map(r => r.key)).size).toBe(4);
  });
  it('keys survive prepends for retained objects, duplicates have occurrence keys, fresh snapshots are local only', () => {
    const presenter = new TrafficPresentation(), initial = presenter.normalize([rx, rx]);
    const prepended = presenter.normalize([{ ...rx, direction: 'TX' }, rx, rx]); expect(prepended.slice(1).map(r => r.key)).toEqual(initial.map(r => r.key));
    expect(presenter.normalize([{ ...rx }])[0].key).not.toBe(initial[0].key);
  });
  it('bounds retained models/cache to 5000 without changing input', () => {
    const presenter = new TrafficPresentation(), input = Array.from({ length: 5100 }, () => ({ ...rx }));
    expect(presenter.normalize(input)).toHaveLength(5000); expect(presenter.retainedCount).toBe(5000); expect(input).toHaveLength(5100);
    presenter.normalize([]); expect(presenter.retainedCount).toBe(0);
  });
});
