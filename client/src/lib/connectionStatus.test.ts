import { describe, expect, it } from 'vitest';

import {
  connectionNoticeDetail,
  deriveConnectionState,
  isConnectionNotice,
  resolveConnectionState,
} from './connectionStatus.js';

describe('connection status derivation', () => {
  it('maps the existing live-update notices to a status', () => {
    expect(deriveConnectionState('Live updates: LIVE')).toEqual({ state: 'LIVE', detail: undefined });
    expect(deriveConnectionState('Live updates: CONNECTING')).toEqual({ state: 'CONNECTING', detail: undefined });
    expect(deriveConnectionState('Live updates: RECONNECTING (500 ms)')).toEqual({
      state: 'RECONNECTING',
      detail: '500 ms',
    });
    expect(deriveConnectionState('Live updates: OFFLINE · retrying (30000 ms)')).toEqual({
      state: 'OFFLINE',
      detail: '30000 ms',
    });
    expect(connectionNoticeDetail('Live updates: RECONNECTING (16000 ms)')).toBe('16000 ms');
  });

  it('ignores notices that are not connection status', () => {
    expect(deriveConnectionState('Unable to delete workflow: Device referenced by node X')).toBeUndefined();
    expect(deriveConnectionState('Live resync failed: boom')).toBeUndefined();
    expect(deriveConnectionState(undefined)).toBeUndefined();
    expect(isConnectionNotice('Live updates: LIVE')).toBe(true);
    expect(isConnectionNotice('Validation: node A is invalid')).toBe(false);
  });

  it('keeps the last known state when a non-connection notice arrives', () => {
    expect(resolveConnectionState('Live updates: LIVE', 'CONNECTING')).toBe('LIVE');
    expect(resolveConnectionState('Unable to delete workflow', 'LIVE')).toBe('LIVE');
    expect(resolveConnectionState(undefined, 'RECONNECTING')).toBe('RECONNECTING');
    expect(resolveConnectionState('Live updates: OFFLINE · retrying (30000 ms)', 'RECONNECTING')).toBe('OFFLINE');
  });
});
