import { describe, expect, it } from 'vitest';
import { decodeRegisters, type Order } from '../src/codec.js';
import { formatRuntimeNumber, runtimePresentation } from '../../client/src/lib/overviewRuntimePresentation.js';
import { createOverviewElement } from '../../client/src/lib/overviewElements.js';
import { resolveOverviewBinding } from '../../client/src/lib/overviewBinding.js';

const source = { sourceType: 'SHARED_TAG' as const, sourceId: '11111111-1111-4111-8111-111111111111' };
function present(value: number) {
  const element = createOverviewElement('NUMERIC_LABEL', { id: 'number', x: 0, y: 0 });
  element.binding = { ...element.binding, source, status: undefined, dataType: 'Number' };
  const definition = { ...source, name: 'Synthetic measurement', dataType: 'Number' as const, capability: 'MONITOR_ONLY' as const, enabled: true, unit: '', description: '' };
  const resolution = resolveOverviewBinding(element, { definitions: [definition], available: true });
  const timestamp = '2026-09-28T00:00:00.000Z';
  return runtimePresentation(element, resolution, { source, availability: 'AVAILABLE', reason: 'READ_OK', sample: { source, dataType: 'Number', value, hasValue: true, quality: 'GOOD', reason: 'READ_OK', receiveTimestamp: timestamp, sourceTimestamp: null, stateUpdatedAt: timestamp, serverEpoch: source.sourceId, sampleSequence: 1, lastGoodValue: value, lastGoodReceiveTimestamp: timestamp } }, 'Connected');
}
describe('dev.13 existing Acquisition codec → HMI signed/decimal contract', () => {
  it('same -20000 bit pattern is UInt16 45536, never implicitly reinterpreted by presentation', () => {
    const registers = [0xb1e0];
    const unsigned = Number(decodeRegisters(registers, 'UInt16'));
    expect(unsigned).toBe(45536); expect(present(unsigned).text).toBe('45536'); expect(present(unsigned).value).toBe(45536);
    const signed = Number(decodeRegisters(registers, 'Int16'));
    expect(signed).toBe(-20000); expect(present(signed).text).toBe('-20000'); expect(registers).toEqual([0xb1e0]);
  });
  it.each(['UInt16', 'Int16'])('%s preserves zero in HMI', type => { expect(present(Number(decodeRegisters([0], type))).text).toBe('0'); });
  it.each(['Float32', 'Float64'])('%s decodes decimal bytes without Client-side codec correction', type => {
    const bytes = Buffer.alloc(type === 'Float32' ? 4 : 8); type === 'Float32' ? bytes.writeFloatBE(-12.375) : bytes.writeDoubleBE(-12.375);
    const words = Array.from({ length: bytes.length / 2 }, (_, i) => bytes.readUInt16BE(i * 2));
    const value = Number(decodeRegisters(words, type)); expect(value).toBe(-12.375);
    expect(present(value).text).toBe('-12.375'); expect(present(value).fullValue).toBe('-12.375');
  });
  it.each(['ABCD', 'BADC', 'CDAB', 'DCBA'] as Order[])('%s byte/word order remains a Mapping/codec concern, never presentation', order => {
    // Independent wire construction, not an encode/decode round-trip tautology.
    const words = [0x4145, 0x0000]; // IEEE Float32 12.3125
    if (order === 'CDAB' || order === 'DCBA') words.reverse();
    if (order === 'BADC' || order === 'DCBA') for (let i = 0; i < words.length; i++) words[i] = ((words[i]! & 255) << 8) | (words[i]! >> 8);
    const value = Number(decodeRegisters(words, 'Float32', order)); expect(value).toBe(12.3125); expect(present(value).text).toBe('12.3125');
  });
  it('full precision diagnostics are retained while normal HMI uses existing formatting', () => {
    const value = 1.23456789012345; expect(present(value).fullValue).toBe(String(value));
    expect(present(value).text).toBe(formatRuntimeNumber(value)); expect(present(value).text).toBe('1.234568');
  });
});
