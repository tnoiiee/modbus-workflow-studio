/** Configuration contract only — no values, quality, timestamps, sequences or transports. */
export const SOURCE_DATA_TYPES = ['Boolean', 'Number', 'String'] as const;
export type SourceDataType = typeof SOURCE_DATA_TYPES[number];
export const SOURCE_CAPABILITIES = ['MONITOR_ONLY', 'COMMAND_ONLY', 'MONITOR_AND_COMMAND'] as const;
export type SourceCapability = typeof SOURCE_CAPABILITIES[number];
export type SourceIdentity =
  | { sourceType: 'WORKFLOW_VARIABLE'; workflowId: string; variableId: string }
  | { sourceType: 'SHARED_TAG'; sourceId: string };
export type DraftSourceIdentity =
  | { sourceType: 'WORKFLOW_VARIABLE'; workflowId?: string; variableId?: string }
  | { sourceType: 'SHARED_TAG'; sourceId?: string };
export interface DefinitionMetadata {
  name: string;
  dataType: SourceDataType;
  capability: SourceCapability;
  description: string;
  unit: string;
  enabled: boolean;
}
export type SourceDefinition = SourceIdentity & DefinitionMetadata;
export type CreateDefinition = DefinitionMetadata & (
  | { sourceType: 'WORKFLOW_VARIABLE'; workflowId: string }
  | { sourceType: 'SHARED_TAG' }
);
export interface DefinitionWorkflow { id: string; name: string }
export const isStableId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function completeIdentity(source?: DraftSourceIdentity): source is SourceIdentity {
  if (!source || typeof source !== 'object') return false;
  const allowed = source.sourceType === 'SHARED_TAG' ? ['sourceType', 'sourceId'] : ['sourceType', 'workflowId', 'variableId'];
  if (Object.keys(source).some(key => !allowed.includes(key))) return false;
  return source.sourceType === 'SHARED_TAG' ? isStableId(source.sourceId)
    : source.sourceType === 'WORKFLOW_VARIABLE' && isStableId(source.workflowId) && isStableId(source.variableId);
}
export function sameSource(a: DraftSourceIdentity, b: SourceIdentity): boolean {
  return a.sourceType === 'SHARED_TAG' && b.sourceType === 'SHARED_TAG' ? a.sourceId === b.sourceId
    : a.sourceType === 'WORKFLOW_VARIABLE' && b.sourceType === 'WORKFLOW_VARIABLE'
      && a.workflowId === b.workflowId && a.variableId === b.variableId;
}
export function definitionIdentity(definition: SourceDefinition): SourceIdentity {
  return definition.sourceType === 'SHARED_TAG'
    ? { sourceType: definition.sourceType, sourceId: definition.sourceId }
    : { sourceType: definition.sourceType, workflowId: definition.workflowId, variableId: definition.variableId };
}
export function definitionId(source: DraftSourceIdentity): string {
  return (source.sourceType === 'SHARED_TAG' ? source.sourceId : source.variableId) ?? '';
}
