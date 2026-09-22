import { describe, expect, it } from 'vitest';

import {
  BLOCK_CATEGORY_ORDER,
  BLOCK_METADATA,
  BLOCK_TYPE_COUNT,
  GATE_SYMBOL_TYPES,
  LIB,
  blockMeta,
  blockPortDocs,
} from './blockMetadata.js';

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

describe('block port documentation', () => {
  /** Default port counts from the workflow editor, keyed by block type. */
  const DEFAULT_COUNTS: Record<string, [inputs: number, outputs: number]> = {
    MODBUS_INPUT: [0, 1],
    MODBUS_MULTI_INPUT: [0, 2],
    MODBUS_OUTPUT: [1, 0],
    AND: [2, 1],
    OR: [2, 1],
    XOR: [2, 1],
    NAND: [2, 1],
    NOR: [2, 1],
    NOT: [1, 1],
    SR_LATCH: [2, 1],
    RS_LATCH: [2, 1],
    RISING_EDGE: [1, 1],
    FALLING_EDGE: [1, 1],
    EQUAL: [2, 1],
    NOT_EQUAL: [2, 1],
    GREATER_THAN: [2, 1],
    GREATER_EQUAL: [2, 1],
    LESS_THAN: [2, 1],
    LESS_EQUAL: [2, 1],
    IN_RANGE: [2, 1],
    OUT_OF_RANGE: [2, 1],
    ADD: [2, 1],
    SUBTRACT: [2, 1],
    MULTIPLY: [2, 1],
    DIVIDE: [2, 1],
    MINIMUM: [2, 1],
    MAXIMUM: [2, 1],
    AVERAGE: [2, 1],
    ABSOLUTE: [1, 1],
    CLAMP: [2, 1],
    LINEAR_MAPPING: [1, 1],
    SCALE: [1, 1],
    OFFSET: [1, 1],
    TON: [2, 1],
    TOF: [2, 1],
    PULSE: [2, 1],
    DEBOUNCE: [2, 1],
    MIN_ON_TIME: [2, 1],
    MIN_OFF_TIME: [2, 1],
    BOOLEAN_CONSTANT: [0, 1],
    NUMERIC_CONSTANT: [0, 1],
    SELECTOR: [2, 1],
    MANUAL_TRIGGER: [0, 1],
    MEMORY: [1, 1],
    DATA_CONVERTER: [1, 1],
    BIT_EXTRACT: [1, 1],
    BIT_COMBINE: [2, 1],
    RATE_LIMITER: [1, 1],
  };

  function assertPort(doc: { labelEn: string; labelTh: string; dataType: string; behaviorEn: string; behaviorTh: string }, where: string): void {
    expect(doc.labelEn.trim().length, where).toBeGreaterThan(1);
    expect(doc.labelTh.trim().length, where).toBeGreaterThan(1);
    expect(THAI.test(doc.labelTh), `${where} needs a Thai label`).toBe(true);
    expect(THAI.test(doc.labelEn), `${where} English label must stay English`).toBe(false);
    expect(doc.dataType.trim().length, where).toBeGreaterThan(1);
    expect(doc.behaviorEn.trim().length, where).toBeGreaterThan(8);
    expect(doc.behaviorTh.trim().length, where).toBeGreaterThan(8);
    expect(THAI.test(doc.behaviorTh), `${where} needs a Thai behavior`).toBe(true);
    expect(THAI.test(doc.behaviorEn), `${where} English behavior must stay English`).toBe(false);
  }

  it('documents every port of all 48 block types', () => {
    expect(Object.keys(DEFAULT_COUNTS)).toHaveLength(48);
    expect(Object.keys(DEFAULT_COUNTS).sort()).toEqual([...ALL_TYPES].sort());

    for (const type of ALL_TYPES) {
      const [inputs, outputs] = DEFAULT_COUNTS[type]!;
      const ports = BLOCK_METADATA[type]!.ports;
      expect(ports.inputs, type).toHaveLength(inputs);
      expect(ports.outputs, type).toHaveLength(outputs);

      ports.inputs.forEach((doc, index) => {
        expect(doc.index, `${type} input ${index}`).toBe(index);
        assertPort(doc, `${type} input ${index}`);
      });
      ports.outputs.forEach((doc, index) => {
        expect(doc.index, `${type} output ${index}`).toBe(index);
        assertPort(doc, `${type} output ${index}`);
      });
    }
  });

  it('resolves documentation to the actual port counts of a node', () => {
    const and = blockPortDocs('AND', 5, 1);
    expect(and.inputs).toHaveLength(5);
    expect(and.inputs.map((doc) => doc.index)).toEqual([0, 1, 2, 3, 4]);
    expect(and.inputs[4]!.labelEn, 'dynamic input uses the repeated pattern').toBe('Input 5');
    expect(and.inputs[4]!.behaviorEn.length).toBeGreaterThan(8);
    expect(and.outputs).toHaveLength(1);

    const multi = blockPortDocs('MODBUS_MULTI_INPUT', 0, 4);
    expect(multi.inputs).toHaveLength(0);
    expect(multi.outputs).toHaveLength(4);
    expect(multi.outputs[3]!.labelEn, 'dynamic output uses the repeated pattern').toBe('Input 4');

    const output = blockPortDocs('MODBUS_OUTPUT', 1, 0);
    expect(output.inputs).toHaveLength(1);
    expect(output.outputs).toHaveLength(0);

    expect(blockPortDocs('TON', 2, 1).inputs[0]!.semanticsEn).toBe('Enable input');
    expect(blockPortDocs('RISING_EDGE', 1, 1).outputs[0]!.semanticsEn).toBe('Rising-edge pulse');
    expect(blockPortDocs('FALLING_EDGE', 1, 1).outputs[0]!.semanticsEn).toBe('Falling-edge pulse');
    expect(blockPortDocs('SR_LATCH', 2, 1).inputs[1]!.semanticsEn).toBe('Reset input');
    expect(blockPortDocs('TON', 2, 1).outputs[0]!.semanticsEn).toBe('Timer done output');
  });

  it('stays empty for an unknown persisted type instead of inventing ports', () => {
    expect(blockPortDocs('LEGACY_CUSTOM_BLOCK', 3, 2)).toEqual({ inputs: [], outputs: [] });
  });
});
