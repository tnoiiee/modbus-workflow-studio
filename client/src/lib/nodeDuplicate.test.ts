import { describe, expect, it } from 'vitest';

import {
  DUPLICATE_OFFSET_X,
  DUPLICATE_OFFSET_Y,
  GRID_SIZE,
  buildDuplicateNode,
  duplicateNode,
  isPositionOccupied,
  snapToGrid,
  uniqueNodeName,
  type DuplicateableNode,
} from './nodeDuplicate.js';

function node(overrides: Partial<DuplicateableNode> = {}): DuplicateableNode {
  return {
    id: 'node-1',
    type: 'MODBUS_INPUT',
    name: 'MODBUS INPUT',
    position: { x: 160, y: 96 },
    inputCount: 0,
    outputCount: 1,
    params: { deviceId: 'plc-1', functionCode: 1, address: 0, dataType: 'Boolean', nested: { list: [1, 2] } },
    ...overrides,
  };
}

describe('snapToGrid', () => {
  it('snaps onto the editor grid', () => {
    expect(GRID_SIZE).toBe(16);
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(17)).toBe(16);
    expect(snapToGrid(24)).toBe(32);
    expect(snapToGrid(-17)).toBe(-16);
    expect(snapToGrid(Number.NaN)).toBe(0);
  });
});

describe('uniqueNodeName', () => {
  it('produces the deterministic copy sequence', () => {
    expect(uniqueNodeName('PUMP', [])).toBe('PUMP (copy)');
    expect(uniqueNodeName('PUMP', ['PUMP', 'PUMP (copy)'])).toBe('PUMP (copy 2)');
    expect(uniqueNodeName('PUMP', ['PUMP', 'PUMP (copy)', 'PUMP (copy 2)'])).toBe('PUMP (copy 3)');
  });

  it('compares against every node name in the workflow', () => {
    expect(uniqueNodeName('PUMP', ['OTHER', 'PUMP (copy)', 'unrelated'])).toBe('PUMP (copy 2)');
    expect(uniqueNodeName('  PUMP  ', ['PUMP'])).toBe('PUMP (copy)');
    expect(uniqueNodeName('', [])).toBe('BLOCK (copy)');
  });
});

describe('isPositionOccupied', () => {
  it('detects exact overlaps only', () => {
    const a = node({ id: 'a', position: { x: 208, y: 128 } });
    expect(isPositionOccupied({ x: 208, y: 128 }, [a])).toBe(true);
    expect(isPositionOccupied({ x: 224, y: 128 }, [a])).toBe(false);
    expect(isPositionOccupied({ x: 208, y: 128 }, [a], 'a')).toBe(false);
  });
});

describe('duplicateNode', () => {
  it('offsets the copy by +48 / +32 and keeps it on the grid', () => {
    expect(DUPLICATE_OFFSET_X).toBe(48);
    expect(DUPLICATE_OFFSET_Y).toBe(32);
    const source = node({ position: { x: 160, y: 96 } });
    const copy = buildDuplicateNode(source, [source], 'node-2');
    expect(copy.position).toEqual({ x: 208, y: 128 });
    expect(copy.position.x % GRID_SIZE).toBe(0);
    expect(copy.position.y % GRID_SIZE).toBe(0);
  });

  it('snaps an off-grid source before offsetting', () => {
    const source = node({ position: { x: 167, y: 101 } });
    const copy = buildDuplicateNode(source, [source], 'node-2');
    expect(copy.position).toEqual({ x: snapToGrid(167 + 48), y: snapToGrid(101 + 32) });
  });

  it('nudges deterministically when the target position is occupied', () => {
    const source = node({ id: 'a', position: { x: 160, y: 96 } });
    const blocker = node({ id: 'b', position: { x: 208, y: 128 } });
    const copy = buildDuplicateNode(source, [source, blocker], 'node-3');
    expect(copy.position).toEqual({ x: 256, y: 160 });
    expect(isPositionOccupied(copy.position, [source, blocker])).toBe(false);
    // same input always yields the same placement
    expect(buildDuplicateNode(source, [source, blocker], 'node-9').position).toEqual(copy.position);
  });

  it('deep copies parameters and never mutates the source node', () => {
    const source = node();
    const frozen = JSON.stringify(source);
    const { node: copy, nextNodes } = duplicateNode(source, [source], 'node-2');

    expect(copy.id).toBe('node-2');
    expect(copy.type).toBe(source.type);
    expect(copy.inputCount).toBe(source.inputCount);
    expect(copy.outputCount).toBe(source.outputCount);
    expect(copy.params).toEqual(source.params);
    expect(copy.params).not.toBe(source.params);

    (copy.params as { nested: { list: number[] } }).nested.list.push(3);
    expect((source.params as { nested: { list: number[] } }).nested.list).toEqual([1, 2]);
    expect(JSON.stringify(source)).toBe(frozen);

    expect(nextNodes).toHaveLength(2);
    expect(nextNodes[0]).toBe(source);
    expect(nextNodes[1]).toBe(copy);
  });

  it('gives the copy a unique name and copies no edges', () => {
    const source = node({ name: 'PUMP' });
    const existing = [source, node({ id: 'node-x', name: 'PUMP (copy)' })];
    const { node: copy, nextNodes } = duplicateNode(source, existing, 'node-2');
    expect(copy.name).toBe('PUMP (copy 2)');
    expect(nextNodes.map((item) => item.name)).toEqual(['PUMP', 'PUMP (copy)', 'PUMP (copy 2)']);
    // the helper returns nodes only: callers keep the existing edge list untouched
    expect(Object.keys(copy)).toEqual(['id', 'type', 'name', 'position', 'inputCount', 'outputCount', 'params']);
  });
});
