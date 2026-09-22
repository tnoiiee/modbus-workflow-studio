import { describe, expect, it } from 'vitest';
import { DEFAULT_RECONNECT_POLICY, reconnectDelay } from './reconnect.js';

describe('reconnect backoff', () => {
  it('uses 250 ms to 30 s exponential ceilings with bounded jitter', () => {
    expect(DEFAULT_RECONNECT_POLICY).toEqual({ baseMs: 250, maxMs: 30_000, jitter: 0.2 });
    expect(reconnectDelay(0, DEFAULT_RECONNECT_POLICY, () => 0.5)).toMatchObject({ delay: 250, ceiling: 250, nextAttempt: 1 });
    expect(reconnectDelay(1, DEFAULT_RECONNECT_POLICY, () => 0.5).delay).toBe(500);
    expect(reconnectDelay(8, DEFAULT_RECONNECT_POLICY, () => 0.5).delay).toBe(30_000);
    expect(reconnectDelay(0, DEFAULT_RECONNECT_POLICY, () => 0).delay).toBe(200);
    expect(reconnectDelay(0, DEFAULT_RECONNECT_POLICY, () => 1).delay).toBe(300);
  });

  it('never exceeds configured bounds or creates a duplicate attempt counter', () => {
    expect(reconnectDelay(99, { baseMs: 500, maxMs: 1_000, jitter: 0 }, () => 0.5)).toEqual({
      delay: 1_000,
      ceiling: 1_000,
      nextAttempt: 8,
    });
    expect(reconnectDelay(-2, { baseMs: 100, maxMs: 100, jitter: 1 }, () => 0)).toEqual({
      delay: 125,
      ceiling: 250,
      nextAttempt: 1,
    });
  });
});
