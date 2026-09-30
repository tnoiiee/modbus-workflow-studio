import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowManager } from '../src/workflowManager.js';
import type { Workflow, WorkflowNode } from '../src/types.js';
const legacy: Workflow = { version: 1, mode: 'DESIGN', running: false, nodes: [], edges: [], settings: { maxPasses: 100 } };
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const output = (id: string, params: Record<string, unknown>): WorkflowNode => ({ id, type: 'MODBUS_OUTPUT', name: id, position: { x: 0, y: 0 }, inputCount: 1, outputCount: 0, params });
describe('existing Workflow node params preserve MODBUS_OUTPUT authoring across reload', () => {
  it('persists valid FC06/FC16 and does not strip invalid saved configurations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-write-authoring-')); roots.push(root);
    const first = new WorkflowManager(root, legacy), workflow = first.first();
    const nodes = [
      output('fc06', { functionCode: 6, dataType: 'Int16', address: 10, quantity: 1, order: 'ABCD' }),
      output('fc16', { functionCode: 16, dataType: 'Float64', address: 20, quantity: 4, order: 'CDAB', readBackSourceId: '11111111-1111-4111-8111-111111111111' }),
      output('invalid-legacy', { functionCode: 6, dataType: 'Float32', address: 65535, quantity: 2, order: 'INVALID' }),
    ];
    first.update(workflow.id, { nodes });
    const reloaded = new WorkflowManager(root, legacy).get(workflow.id)!;
    expect(reloaded.nodes.map(node => node.params)).toEqual(nodes.map(node => node.params));
    expect(reloaded.nodes[2]?.params).toMatchObject({ functionCode: 6, dataType: 'Float32', address: 65535, quantity: 2, order: 'INVALID' });
  });
});
