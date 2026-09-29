import type { OverviewElement } from '../../lib/overviewElements.js';
import type { BindingResolution } from '../../lib/overviewBinding.js';
import { definitionId, definitionIdentity, sameSource, type DefinitionWorkflow, type SourceDefinition } from '../../lib/sourceDefinitions.js';

export function SourceBindingFields({ element, definitions, workflows, resolution, onPatchBinding }: {
  element: OverviewElement; definitions: readonly SourceDefinition[]; workflows: readonly DefinitionWorkflow[];
  resolution: BindingResolution; onPatchBinding: (patch: Partial<OverviewElement['binding']>) => void;
}) {
  const source = element.binding.source;
  const choices = definitions.filter(item => item.sourceType === source?.sourceType
    && (item.sourceType !== 'WORKFLOW_VARIABLE' || source?.sourceType === 'WORKFLOW_VARIABLE' && item.workflowId === source.workflowId));
  const selectedId = source ? definitionId(source) : '';
  const currentExists = Boolean(source && definitions.some(item => sameSource(source, item)));
  const definition = resolution.definition;
  return <div className="source-binding">
    <label>Source Type<select value={source?.sourceType ?? ''} onChange={event => {
      if (!event.target.value) { onPatchBinding({ source: undefined }); return; }
      onPatchBinding({ source: event.target.value === 'SHARED_TAG' ? { sourceType: 'SHARED_TAG', sourceId: '' } : { sourceType: 'WORKFLOW_VARIABLE', workflowId: '', variableId: '' } });
    }}><option value="">Not selected / legacy draft</option><option>WORKFLOW_VARIABLE</option><option>SHARED_TAG</option></select></label>
    {source?.sourceType === 'WORKFLOW_VARIABLE' && <label>Workflow<select value={source.workflowId ?? ''} onChange={event => onPatchBinding({ source: { sourceType: 'WORKFLOW_VARIABLE', workflowId: event.target.value, variableId: '' } })}>
      <option value="">Select Workflow</option>{source.workflowId && !workflows.some(item => item.id === source.workflowId) && <option value={source.workflowId}>Missing Workflow · {source.workflowId}</option>}{workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.id}</option>)}
    </select></label>}
    {source && <><label>Source definition<select value={selectedId} onChange={event => {
      const selected = choices.find(item => definitionId(item) === event.target.value);
      if (selected) onPatchBinding({ source: definitionIdentity(selected), dataType: selected.dataType });
      else onPatchBinding({ source: source.sourceType === 'SHARED_TAG' ? { ...source, sourceId: '' } : { ...source, variableId: '' } });
    }}><option value="">Select definition</option>{selectedId && !currentExists && <option value={selectedId}>Unresolved · {selectedId}</option>}{choices.map(item => <option key={definitionId(item)} value={definitionId(item)}>{item.name} · {definitionId(item)}{item.enabled ? '' : ' · DISABLED'}</option>)}</select></label>
    <label>Stable Source ID<input value={selectedId} readOnly aria-readonly="true" /></label></>}
    {definition && <dl className="source-binding__metadata"><dt>Name</dt><dd>{definition.name}</dd><dt>Data type</dt><dd>{definition.dataType}</dd><dt>Capability</dt><dd>{definition.capability}</dd><dt>Enabled</dt><dd>{definition.enabled ? 'Yes' : 'No'}</dd><dt>Unit</dt><dd>{definition.unit || '—'}</dd><dt>Description</dt><dd>{definition.description || '—'}</dd></dl>}
    <p role="status" aria-live="polite">{resolution.status}: {resolution.reason}</p>
    {resolution.controlRuntimeDisabled && <strong>CONTROL RUNTIME NOT ENABLED</strong>}
    <button type="button" onClick={() => onPatchBinding({ source: undefined, tagId: '', tagName: '', dataType: 'Unknown' })}>Clear binding</button>
  </div>;
}
