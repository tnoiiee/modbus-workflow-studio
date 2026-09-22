import { describe, expect, it } from 'vitest';

import { isInspectorVisible } from './InspectorHeader.js';

describe('parameters panel visibility', () => {
  it('hides the panel when nothing is selected', () => {
    expect(isInspectorVisible(undefined)).toBe(false);
    expect(isInspectorVisible('')).toBe(false);
    expect(isInspectorVisible('   ')).toBe(false);
  });

  it('shows the panel for a selected block or connection', () => {
    expect(isInspectorVisible('node-1')).toBe(true);
    expect(isInspectorVisible('edge-1')).toBe(true);
  });
});
