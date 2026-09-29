import { describe, expect, it } from 'vitest';
import { operatorRuntimeStatus, runtimePresentation, runtimeDiagnosticValue, runtimeHealthCounts, presentationAge } from './overviewRuntimePresentation.js';
import { configuration, sampleItem, time } from './overviewRuntimeFixtures.js';

describe('dev.12 operator projection, not Runtime semantics', () => {
  it.each([0, -0, -20, 4.25, 1.123456789, 1e20, 1e-9])('GOOD Number %s is clean and preserves canonical precision', value => {
    const f = configuration(), item = sampleItem(1, value), before = JSON.stringify(item);
    const p = runtimePresentation(f.element, f.resolution, item, 'Connected');
    expect(p.value).toBe(value); expect(p.quality).toBe('GOOD'); expect(operatorRuntimeStatus(p, '1s since receive')).toBe('');
    expect(p.unit).toBe('bar'); expect(JSON.stringify(item)).toBe(before);
  });
  it.each([true, false])('Boolean %s remains Boolean, not a Number', value => {
    const f = configuration(1, 'STATUS_LIGHT'), p = runtimePresentation(f.element, f.resolution, sampleItem(1, value), 'Connected');
    expect(p.value).toBe(value); expect(p.text).toBe(value ? 'TRUE' : 'FALSE'); expect(operatorRuntimeStatus(p, '')).toBe('');
  });
  it('no sample and UNCERTAIN without value never fabricate 0/false', () => {
    const f = configuration(1, 'STATUS_LIGHT'), item = sampleItem(1, false, 'UNCERTAIN');
    Object.assign(item.sample!, { value: null, hasValue: false, lastGoodValue: null, lastGoodReceiveTimestamp: null }); item.availability = 'NO_SAMPLE';
    for (const input of [undefined, item]) { const p = runtimePresentation(f.element, f.resolution, input, 'Connected'); expect(p.text).toBe('—'); expect(operatorRuntimeStatus(p, '')).toBe('Awaiting data'); }
  });
  it('UNCERTAIN with a value has explicit indication', () => {
    const f = configuration(), p = runtimePresentation(f.element, f.resolution, sampleItem(1, 0, 'UNCERTAIN'), 'Connected');
    expect(p.text).toBe('0'); expect(operatorRuntimeStatus(p, '')).toBe('UNCERTAIN');
  });
  it('STALE has one status and receive-age context', () => {
    const f = configuration(), p = runtimePresentation(f.element, f.resolution, sampleItem(1, 20, 'STALE'), 'Connected');
    expect(operatorRuntimeStatus(p, '12s since receive')).toBe('STALE · 12s since receive');
    expect(operatorRuntimeStatus(p, 'Age unavailable: clock skew')).toContain('clock skew');
  });
  it('paused stale age is not a false live age or an always-visible full timestamp', () => {
    const f = configuration(), p = runtimePresentation(f.element, f.resolution, sampleItem(1, 20, 'STALE'), 'Offline');
    const text = operatorRuntimeStatus(p, presentationAge(time, Date.parse(time), 'Offline'));
    expect(text).toBe('Cached · STALE · Age paused; see details'); expect(text).not.toContain(time);
  });
  it.each(['BAD', 'DISCONNECTED'] as const)('%s may show only explicitly labeled last-good', quality => {
    const f = configuration(), item = sampleItem(1, 999, quality); item.sample!.lastGoodValue = 20;
    const p = runtimePresentation(f.element, f.resolution, item, 'Connected');
    expect(p.value).toBe(20); expect(p.historical).toBe(true); expect(operatorRuntimeStatus(p, '')).toBe(`Last good · ${quality === 'BAD' ? 'BAD sample' : 'Device disconnected'}`);
  });
  it.each(['BAD', 'DISCONNECTED'] as const)('%s without last-good uses a placeholder', quality => {
    const f = configuration(), item = sampleItem(1, 999, quality); item.sample!.lastGoodValue = null; item.sample!.lastGoodReceiveTimestamp = null;
    const p = runtimePresentation(f.element, f.resolution, item, 'Connected');
    expect(p.value).toBeNull(); expect(p.text).toBe('—'); expect(operatorRuntimeStatus(p, '')).toBe(quality === 'BAD' ? 'BAD sample' : 'Device disconnected');
  });
  it.each(['Reconnecting', 'Resynchronizing', 'Offline', 'Error'] as const)('%s labels cached data without changing Device quality', transport => {
    const f = configuration(), item = sampleItem(1, 20); const before = JSON.stringify(item);
    const p = runtimePresentation(f.element, f.resolution, item, transport); expect(operatorRuntimeStatus(p, '')).toBe('Cached · latest received');
    expect(p.quality).toBe('GOOD'); expect(JSON.stringify(item)).toBe(before);
  });
  it.each(['TEXT_LABEL', 'VALUE_BADGE'] as const)('%s String stays unsupported, not MISSING or caption-as-value', type => {
    const f = configuration(1, type); f.definition.dataType = 'String'; f.element.binding.dataType = 'String'; f.element.style.text = 'Caption, not data';
    const p = runtimePresentation(f.element, { ...f.resolution, definition: f.definition }, undefined, 'Connected');
    expect(p.binding).toBe('BOUND'); expect(p.value).toBeNull(); expect(p.text).toBe('—'); expect(operatorRuntimeStatus(p, '')).toBe('Unsupported producer');
  });
  it.each(['NOT_BOUND', 'DRAFT', 'MISSING', 'INCOMPATIBLE'] as const)('%s has operator wording without altering resolution', status => {
    const f = configuration(), resolution = { ...f.resolution, status }, p = runtimePresentation(f.element, resolution, undefined, 'Disposed');
    expect(operatorRuntimeStatus(p, '')).toMatch(/configured|Configuration|Source unavailable/); expect(resolution.status).toBe(status);
  });
  it('internal reason codes never enter the operator status', () => {
    const f = configuration(), item = sampleItem(1, 1, 'BAD'); item.reason = 'INTERNAL_READ_FAILURE';
    const p = runtimePresentation(f.element, f.resolution, item, 'Connected'); expect(p.reason).toBe('INTERNAL_READ_FAILURE'); expect(operatorRuntimeStatus(p, '')).not.toContain(item.reason);
  });
  it.each([NaN, Infinity, '20', false, null])('diagnostics reject invalid Number %s without coercion', value => { expect(runtimeDiagnosticValue(value, 'Number')).toBe('Unavailable'); });
  it('diagnostics retain full precision, zero and false, with no String decoding', () => {
    expect(runtimeDiagnosticValue(1.123456789, 'Number')).toBe('1.123456789'); expect(runtimeDiagnosticValue(-0, 'Number')).toBe('0');
    expect(runtimeDiagnosticValue(false, 'Boolean')).toBe('FALSE'); expect(runtimeDiagnosticValue('text', 'String')).toBe('Unavailable');
  });
  it('Page counts preserve unavailable classification; BAD is an explicit subset, with no mutation', () => {
    const items = [sampleItem(), sampleItem(2, 1, 'STALE'), sampleItem(3, false, 'UNCERTAIN'), sampleItem(4, 1, 'BAD'), sampleItem(5, 1, 'DISCONNECTED'), undefined];
    const before = JSON.stringify(items); expect(runtimeHealthCounts(items)).toEqual({ stale: 1, uncertain: 1, unavailable: 3, bad: 1 }); expect(JSON.stringify(items)).toBe(before);
  });
});
