import { describe, expect, it } from 'vitest';

import { blockZoneGeometry } from './App.js';
import { LOGIC_SYMBOL_TYPES } from './components/workflow/LogicSymbol.js';

/** Header(1) + status(2) + body(3) + footer(5) heights from `styles/tokens.css`. */
const HEAD = 68;
const GATE_HEAD = 94;
const ZONES_BELOW_HEAD = 117; // status 58 + body 32 + footer 27
const FOOTER = 27;
const PITCH = 26;
const MULTI_PITCH = 63;
const HANDLE_HALF = 4;

/** The block types the owner asked to verify, with their default port counts. */
const BLOCKS: Array<[type: string, inputs: number, outputs: number]> = [
  ['MANUAL_TRIGGER', 0, 1],
  ['OR', 2, 1],
  ['AND', 2, 1],
  ['MODBUS_INPUT', 0, 1],
  ['MODBUS_OUTPUT', 1, 0],
  ['MODBUS_MULTI_INPUT', 0, 2],
  ['LINEAR_MAPPING', 1, 1],
  ['TON', 2, 1],
  ['BOOLEAN_CONSTANT', 0, 1],
  ['NUMERIC_CONSTANT', 0, 1],
];

describe('function block zone geometry', () => {
  it.each(BLOCKS)('%s keeps every zone inside the block', (type, inputs, outputs) => {
    const zone = blockZoneGeometry(type, inputs, outputs);
    const head = LOGIC_SYMBOL_TYPES.has(type) ? GATE_HEAD : HEAD;

    expect(zone.head).toBe(head);
    // header + status/value + runtime body + footer all fit
    expect(zone.height).toBeGreaterThanOrEqual(head + ZONES_BELOW_HEAD);

    const ports = Math.max(inputs, outputs);
    expect(zone.ports).toBe(ports);
    if (ports > 0) {
      // ports live below the header, never on top of the title or the badge
      expect(zone.portTop(0)).toBeGreaterThanOrEqual(head);
      // ...and they stop above the footer, which stays fully visible
      expect(zone.portTop(ports - 1) + HANDLE_HALF).toBeLessThanOrEqual(zone.height - FOOTER);
    }
  });

  it.each(BLOCKS)('%s aligns port labels with their handles', (type, inputs, outputs) => {
    const zone = blockZoneGeometry(type, inputs, outputs);
    for (let index = 0; index < Math.max(inputs, outputs); index += 1) {
      expect(zone.labelTop(index) + 9).toBe(zone.portTop(index));
    }
  });

  it('spaces standard ports on one fixed pitch', () => {
    const zone = blockZoneGeometry('AND', 8, 1);
    for (let index = 0; index < 7; index += 1) {
      expect(zone.portTop(index + 1) - zone.portTop(index)).toBe(PITCH);
    }
    // a wide gate grows the block instead of pushing ports over the footer
    expect(zone.height).toBeGreaterThanOrEqual(GATE_HEAD + ZONES_BELOW_HEAD);
    expect(zone.portTop(7) + HANDLE_HALF).toBeLessThanOrEqual(zone.height - FOOTER);
  });

  it('gives MODBUS_MULTI_INPUT one row per output plus a footer', () => {
    for (const outputs of [2, 4, 8]) {
      const zone = blockZoneGeometry('MODBUS_MULTI_INPUT', 0, outputs);
      expect(zone.multi).toBe(true);
      expect(zone.height).toBe(108 + outputs * MULTI_PITCH);
      for (let index = 0; index < outputs; index += 1) {
        // each port is centred on its own 62px value row
        expect(zone.portTop(index)).toBe(zone.head + 6 + index * MULTI_PITCH + 31);
        expect(zone.portTop(index) + HANDLE_HALF).toBeLessThan(zone.height - FOOTER);
      }
      if (outputs > 1) expect(zone.portTop(1) - zone.portTop(0)).toBe(MULTI_PITCH);
      // the rows end before the footer row starts
      expect(zone.head + 6 + outputs * MULTI_PITCH + 6).toBeLessThanOrEqual(zone.height - FOOTER);
    }
  });

  it('does not give every block type the same fixed height', () => {
    const heights = new Set(BLOCKS.map(([type, inputs, outputs]) => blockZoneGeometry(type, inputs, outputs).height));
    expect(heights.size).toBeGreaterThan(1);
  });
});
