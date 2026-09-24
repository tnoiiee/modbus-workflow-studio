import { useState } from 'react';
import { Modal } from '../ui/Modal.js';
import { createSourceDefinition, updateSourceDefinition } from '../../lib/overviewApi.js';
import { SOURCE_CAPABILITIES, SOURCE_DATA_TYPES, definitionId, type DefinitionMetadata, type DefinitionWorkflow, type SourceDefinition } from '../../lib/sourceDefinitions.js';

const defaults = (): DefinitionMetadata => ({ name: '', dataType: 'Boolean', capability: 'MONITOR_ONLY', description: '', unit: '', enabled: true });
export function DefinitionCatalogEditor({ definitions, workflows, available, onClose, onChanged, initialDefinition }: {
  initialDefinition?: SourceDefinition;
  definitions: readonly SourceDefinition[]; workflows: readonly DefinitionWorkflow[]; available: boolean;
  onClose: () => void; onChanged: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<SourceDefinition | undefined>(initialDefinition);
  const [sourceType, setSourceType] = useState<'WORKFLOW_VARIABLE' | 'SHARED_TAG'>(initialDefinition?.sourceType ?? 'SHARED_TAG');
  const [workflowId, setWorkflowId] = useState(initialDefinition?.sourceType === 'WORKFLOW_VARIABLE' ? initialDefinition.workflowId : '');
  const [metadata, setMetadata] = useState<DefinitionMetadata>(() => initialDefinition ? {
    name: initialDefinition.name, dataType: initialDefinition.dataType, capability: initialDefinition.capability,
    description: initialDefinition.description, unit: initialDefinition.unit, enabled: initialDefinition.enabled,
  } : defaults());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const edit = (definition?: SourceDefinition) => {
    setSelected(definition); setError(''); setNotice('');
    setSourceType(definition?.sourceType ?? 'SHARED_TAG');
    setWorkflowId(definition?.sourceType === 'WORKFLOW_VARIABLE' ? definition.workflowId : '');
    setMetadata(definition ? { name: definition.name, dataType: definition.dataType, capability: definition.capability,
      description: definition.description, unit: definition.unit, enabled: definition.enabled } : defaults());
  };
  const save = async () => {
    setPending(true); setError(''); setNotice('');
    try {
      const saved = selected ? await updateSourceDefinition(selected, metadata)
        : await createSourceDefinition(sourceType === 'SHARED_TAG' ? { ...metadata, sourceType } : { ...metadata, sourceType, workflowId });
      setSelected(saved);
      await onChanged();
      setNotice('Definition saved independently of the Overview Page. No Runtime values or commands.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save definition'); }
    finally { setPending(false); }
  };
  return <Modal open title="Source Definition Catalog" size="md" onClose={() => { if (!pending) onClose(); }}
    description="Configuration only. Saving a definition is independent of Page Save/Cancel. Disable is the default removal action; existing bindings are retained."
    footer={<><button type="button" onClick={onClose} disabled={pending}>Close / discard unsaved form</button><button type="button" onClick={() => void save()} disabled={pending || !available || !metadata.name.trim() || (sourceType === 'WORKFLOW_VARIABLE' && !workflowId)}>{pending ? 'Saving…' : selected ? 'Save metadata' : 'Create definition'}</button></>}>
    <div className="source-catalog">
      {!available && <p role="status">Catalog unavailable or refreshing. Definitions cannot be saved until refreshed.</p>}
      {error && <p role="alert">{error}</p>}<p role="status" aria-live="polite">{notice}</p>
      <label>Definition<select disabled={pending} value={selected ? definitions.findIndex(item => item.sourceType === selected.sourceType && definitionId(item) === definitionId(selected) && (item.sourceType !== 'WORKFLOW_VARIABLE' || selected.sourceType !== 'WORKFLOW_VARIABLE' || item.workflowId === selected.workflowId)) : -1}
        onChange={event => edit(definitions[Number(event.target.value)])}><option value={-1}>New definition</option>{definitions.map((item, index) => <option key={`${item.sourceType}:${definitionId(item)}`} value={index}>{item.sourceType} · {item.sourceType === 'WORKFLOW_VARIABLE' ? `${workflows.find(w => w.id === item.workflowId)?.name ?? item.workflowId} · ` : ''}{item.name} · {definitionId(item)}{item.enabled ? '' : ' · DISABLED'}</option>)}</select></label>
      <fieldset disabled={pending}>
        <label>Source Type<select value={sourceType} disabled={Boolean(selected)} onChange={event => setSourceType(event.target.value as typeof sourceType)}><option>SHARED_TAG</option><option>WORKFLOW_VARIABLE</option></select></label>
        {sourceType === 'WORKFLOW_VARIABLE' && <label>Owning Workflow<select value={workflowId} disabled={Boolean(selected)} onChange={event => setWorkflowId(event.target.value)}><option value="">Select Workflow</option>{workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.id}</option>)}</select></label>}
        {selected && <label>Stable ID<input readOnly value={definitionId(selected)} /></label>}
        <label>Name<input maxLength={100} value={metadata.name} onChange={event => setMetadata({ ...metadata, name: event.target.value })} /></label>
        <label>Data type<select value={metadata.dataType} onChange={event => setMetadata({ ...metadata, dataType: event.target.value as DefinitionMetadata['dataType'] })}>{SOURCE_DATA_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Capability<select value={metadata.capability} onChange={event => setMetadata({ ...metadata, capability: event.target.value as DefinitionMetadata['capability'] })}>{SOURCE_CAPABILITIES.map(capability => <option key={capability}>{capability}</option>)}</select></label>
        <label>Description<textarea maxLength={1000} value={metadata.description} onChange={event => setMetadata({ ...metadata, description: event.target.value })} /></label>
        <label>Unit<input maxLength={80} value={metadata.unit} onChange={event => setMetadata({ ...metadata, unit: event.target.value })} /></label>
        <label><input type="checkbox" checked={metadata.enabled} onChange={event => setMetadata({ ...metadata, enabled: event.target.checked })} /> Enabled (uncheck to Disable)</label>
      </fieldset>
    </div>
  </Modal>;
}
