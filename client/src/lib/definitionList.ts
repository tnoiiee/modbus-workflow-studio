import { definitionId, type SourceDefinition, type SourceIdentity, type DefinitionWorkflow } from './sourceDefinitions.js';

export type SourceTypeFilter = 'ALL' | SourceDefinition['sourceType'];
export type DefinitionStatusFilter = 'ALL' | 'ENABLED' | 'DISABLED';
export const definitionKey = (source: SourceIdentity): string => source.sourceType === 'SHARED_TAG'
  ? `SHARED_TAG:${source.sourceId}` : `WORKFLOW_VARIABLE:${source.workflowId}:${source.variableId}`;
/** Presentation-only filtering. Never mutates Catalog records or resolves a binding by name. */
export function filterDefinitions(definitions: readonly SourceDefinition[], workflows: readonly DefinitionWorkflow[], query: string, type: SourceTypeFilter, status: DefinitionStatusFilter): SourceDefinition[] {
  const search = query.trim().toLocaleLowerCase();
  const owners = new Map(workflows.map(workflow => [workflow.id, workflow.name]));
  return definitions.filter(definition => {
    if (type !== 'ALL' && definition.sourceType !== type) return false;
    if (status !== 'ALL' && definition.enabled !== (status === 'ENABLED')) return false;
    const workflow = definition.sourceType === 'WORKFLOW_VARIABLE' ? `${definition.workflowId} ${owners.get(definition.workflowId) ?? ''}` : '';
    return !search || [definition.name, definition.description, definitionId(definition), definition.sourceType,
      workflow, definition.dataType, definition.capability, definition.unit].join(' ').toLocaleLowerCase().includes(search);
  });
}
