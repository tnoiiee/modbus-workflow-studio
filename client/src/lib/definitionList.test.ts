import { describe, expect, it } from 'vitest';
import { definitionKey, filterDefinitions } from './definitionList.js';
import type { SourceDefinition } from './sourceDefinitions.js';
const shared: SourceDefinition = { sourceType: 'SHARED_TAG', sourceId: 's1', name: 'Temperature', description: 'Kiln outlet', unit: 'C', dataType: 'Number', capability: 'MONITOR_ONLY', enabled: true };
const variable: SourceDefinition = { ...shared, sourceType: 'WORKFLOW_VARIABLE', workflowId: 'w1', variableId: 'v1', name: 'Interlock', description: 'Safety check', dataType: 'Boolean', capability: 'COMMAND_ONLY', enabled: false };
const definitions = [shared, variable], workflows = [{ id: 'w1', name: 'Kiln A' }];
describe('dev.3 presentation-only Source list', () => {
  it('supports both exact source-type filters and All', () => {
    expect(filterDefinitions(definitions, workflows, '', 'ALL', 'ALL')).toEqual(definitions);
    expect(filterDefinitions(definitions, workflows, '', 'SHARED_TAG', 'ALL')).toEqual([shared]);
    expect(filterDefinitions(definitions, workflows, '', 'WORKFLOW_VARIABLE', 'ALL')).toEqual([variable]);
  });
  it('supports Enabled, Disabled and combined filters', () => {
    expect(filterDefinitions(definitions, workflows, '', 'ALL', 'ENABLED')).toEqual([shared]);
    expect(filterDefinitions(definitions, workflows, '', 'ALL', 'DISABLED')).toEqual([variable]);
    expect(filterDefinitions(definitions, workflows, '', 'SHARED_TAG', 'DISABLED')).toEqual([]);
  });
  it.each([' temperature ', 'S1', 'outlet', 'Number', 'MONITOR_ONLY'])('search matches metadata/ID without modifying identities: %s', query => {
    expect(filterDefinitions(definitions, workflows, query, 'ALL', 'ALL')).toEqual([shared]);
  });
  it('searches Workflow names and IDs and reports no match explicitly', () => {
    expect(filterDefinitions(definitions, workflows, 'Kiln A', 'ALL', 'ALL')).toEqual([variable]);
    expect(filterDefinitions(definitions, workflows, 'w1', 'ALL', 'ALL')).toEqual([variable]);
    expect(filterDefinitions(definitions, workflows, 'not found', 'ALL', 'ALL')).toEqual([]);
  });
  it('does not mutate inputs; same variable ID across Workflows has distinct row keys', () => {
    const before = JSON.stringify(definitions); filterDefinitions(definitions, workflows, '', 'ALL', 'ALL');
    expect(JSON.stringify(definitions)).toBe(before);
    expect(definitionKey(variable)).not.toBe(definitionKey({ ...variable, workflowId: 'w2' }));
    expect(definitionKey(shared)).toBe('SHARED_TAG:s1');
  });
});
