import { describe, expect, it } from 'vitest';

import { BLOCK_CATEGORY_ORDER, BLOCK_METADATA, BLOCK_TYPE_COUNT, GATE_SYMBOL_TYPES, LIB, blockMeta } from './blockMetadata.js';

/** The v1.2.11 library index. Metadata must reproduce it exactly. */
const BASELINE_LIB: Record<string, string[]> = {
  Modbus: ['MODBUS_INPUT', 'MODBUS_MULTI_INPUT', 'MODBUS_OUTPUT'],
  'Boolean Logic': ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT', 'SR_LATCH', 'RS_LATCH', 'RISING_EDGE', 'FALLING_EDGE'],
  Compare: ['EQUAL', 'NOT_EQUAL', 'GREATER_THAN', 'GREATER_EQUAL', 'LESS_THAN', 'LESS_EQUAL', 'IN_RANGE', 'OUT_OF_RANGE'],
  Math: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'MINIMUM', 'MAXIMUM', 'AVERAGE', 'ABSOLUTE', 'CLAMP', 'LINEAR_MAPPING', 'SCALE', 'OFFSET'],
  Timer: ['TON', 'TOF', 'PULSE', 'DEBOUNCE', 'MIN_ON_TIME', 'MIN_OFF_TIME'],
  Utility: ['BOOLEAN_CONSTANT', 'NUMERIC_CONSTANT', 'SELECTOR', 'MANUAL_TRIGGER', 'MEMORY', 'DATA_CONVERTER', 'BIT_EXTRACT', 'BIT_COMBINE', 'RATE_LIMITER'],
};

const ALL_TYPES = Object.values(BASELINE_LIB).flat();
const THAI = /[\u0e00-\u0e7f]/;

/** lucide icons are forwardRef objects, plain components are functions. */
function isRenderableIcon(value: unknown): boolean {
  if (typeof value === 'function') return true;
  return typeof value === 'object' && value !== null && '$$typeof' in value;
}

function baselineCategoryOf(type: string): string {
  const category = Object.keys(BASELINE_LIB).find((name) => BASELINE_LIB[name]!.includes(type));
  if (!category) throw new Error(`missing baseline category for ${type}`);
  return category;
}

describe('block metadata', () => {
  it('covers every baseline block type exactly once', () => {
    expect(BLOCK_TYPE_COUNT).toBe(48);
    expect(ALL_TYPES).toHaveLength(48);
    expect(new Set(ALL_TYPES).size).toBe(48);
    expect(Object.keys(BLOCK_METADATA).sort()).toEqual([...ALL_TYPES].sort());
  });

  it('derives the library index with baseline categories, order, and membership', () => {
    expect(BLOCK_CATEGORY_ORDER).toEqual(Object.keys(BASELINE_LIB));
    expect(Object.keys(LIB)).toEqual(Object.keys(BASELINE_LIB));
    expect(LIB).toEqual(BASELINE_LIB);
  });

  it('provides a title, category, icon, and both descriptions for every type', () => {
    for (const type of ALL_TYPES) {
      const meta = BLOCK_METADATA[type]!;
      expect(meta.type, type).toBe(type);
      expect(meta.title.length, type).toBeGreaterThan(0);
      expect(meta.category, type).toBe(baselineCategoryOf(type));
      expect(LIB[meta.category], type).toContain(type);
      expect(isRenderableIcon(meta.icon), `${type} needs a renderable icon`).toBe(true);
      expect(meta.summaryEn.trim().length, type).toBeGreaterThan(8);
      expect(meta.summaryTh.trim().length, type).toBeGreaterThan(8);
      expect(THAI.test(meta.summaryTh), `${type} needs a Thai summary`).toBe(true);
      expect(THAI.test(meta.summaryEn), `${type} English summary must stay English`).toBe(false);
    }
  });

  it('keeps titles identical to the baseline label transform so persisted names do not change', () => {
    for (const type of ALL_TYPES) {
      expect(blockMeta(type).title, type).toBe(type.replaceAll('_', ' '));
    }
  });

  it('keeps gate glyph types equal to the Boolean Logic category', () => {
    expect([...GATE_SYMBOL_TYPES].sort()).toEqual([...BASELINE_LIB['Boolean Logic']!].sort());
    for (const type of GATE_SYMBOL_TYPES) expect(blockMeta(type).category).toBe('Boolean Logic');
  });

  it('badges write capable, read, and manual blocks', () => {
    expect(blockMeta('MODBUS_OUTPUT').badge).toBe('WRITE');
    expect(blockMeta('MODBUS_INPUT').badge).toBe('READ');
    expect(blockMeta('MANUAL_TRIGGER').badge).toBe('MANUAL');
    expect(blockMeta('ADD').badge).toBeUndefined();
  });

  it('falls back safely for an unknown persisted type', () => {
    const meta = blockMeta('LEGACY_CUSTOM_BLOCK');
    expect(meta.title).toBe('LEGACY CUSTOM BLOCK');
    expect(isRenderableIcon(meta.icon)).toBe(true);
    expect(meta.summaryEn.length).toBeGreaterThan(0);
    expect(THAI.test(meta.summaryTh)).toBe(true);
  });
});
