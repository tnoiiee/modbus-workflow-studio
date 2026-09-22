import { describe, expect, it } from 'vitest';
import { BoundedLiveQueue, type LiveQueueEvent } from '../src/liveTransport.js';

const event = (name: string, critical = false, coalesceKey?: string): LiveQueueEvent => {
  const payload = JSON.stringify({ name });
  return { payload, bytes: Buffer.byteLength(payload), critical, coalesceKey };
};
const resync = (): LiveQueueEvent => ({ payload: '{"type":"resync-required"}', bytes: 27, critical: true, resync: true });

const drain = (queue: BoundedLiveQueue) => {
  const names: string[] = [];
  let item: LiveQueueEvent | undefined;
  while ((item = queue.shift())) names.push(item.payload);
  return names;
};

describe('bounded live transport queue', () => {
  it('coalesces telemetry and keeps message and byte bounds', () => {
    const queue = new BoundedLiveQueue({ maxMessages: 3, maxBytes: 100 });
    expect(queue.enqueue(event('state', true), resync())).toBe(true);
    expect(queue.enqueue(event('traffic-1', false, 'traffic'), resync())).toBe(true);
    expect(queue.enqueue(event('traffic-2', false, 'traffic'), resync())).toBe(true);
    expect(queue.length).toBe(2);
    expect(queue.droppedTelemetry).toBe(1);
    expect(queue.bytes).toBeLessThanOrEqual(100);
    expect(drain(queue)).toEqual(['{"name":"state"}', '{"name":"traffic-2"}']);
  });

  it('does not coalesce telemetry outside the configured window', () => {
    const queue = new BoundedLiveQueue({ maxMessages: 4, maxBytes: 200, coalesceWindowMs: 100 });
    queue.enqueue({ ...event('traffic-1', false, 'traffic'), createdAt: 0 }, resync());
    queue.enqueue({ ...event('traffic-2', false, 'traffic'), createdAt: 101 }, resync());
    expect(queue.length).toBe(2);
    expect(queue.droppedTelemetry).toBe(0);
  });

  it('retains a resync signal when control events overflow state capacity', () => {
    const queue = new BoundedLiveQueue({ maxMessages: 2, maxBytes: 200 });
    queue.enqueue(event('state-1', true), resync());
    queue.enqueue(event('state-2', true), resync());
    queue.enqueue(event('state-3', true), resync());
    const messages = drain(queue);
    expect(messages[0]).toContain('resync-required');
    expect(messages[1]).toContain('state-3');
    expect(queue.droppedTelemetry).toBe(0);
  });

  it('drops oversized telemetry but replaces oversized control with resync', () => {
    const queue = new BoundedLiveQueue({ maxMessages: 4, maxBytes: 32 });
    const oversizedTelemetry: LiveQueueEvent = { payload: 'x'.repeat(100), bytes: 100, critical: false };
    expect(queue.enqueue(oversizedTelemetry, resync())).toBe(false);
    expect(queue.droppedTelemetry).toBe(1);
    const oversizedControl: LiveQueueEvent = { payload: 'y'.repeat(100), bytes: 100, critical: true };
    expect(queue.enqueue(oversizedControl, resync())).toBe(false);
    expect(drain(queue)[0]).toContain('resync-required');
  });
});
