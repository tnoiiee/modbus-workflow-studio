import { useId, useRef, useState } from 'react';
import { Modal } from '../ui/Modal.js';
import { createSourceDefinition, updateSourceDefinition } from '../../lib/overviewApi.js';
import { SOURCE_CAPABILITIES, SOURCE_DATA_TYPES, definitionId, type DefinitionMetadata, type DefinitionWorkflow, type SourceDefinition } from '../../lib/sourceDefinitions.js';

const defaults = (): DefinitionMetadata => ({ name: '', dataType: 'Boolean', capability: 'MONITOR_ONLY', description: '', unit: '', enabled: true });
/** Focused single-record form; catalog navigation belongs to the searchable page. */
export function DefinitionCatalogEditor({ workflows, available, onClose, onChanged, initialDefinition, initialSourceType = 'SHARED_TAG' }: {
  initialDefinition?: SourceDefinition;
  initialSourceType?: SourceDefinition['sourceType'];
  definitions: readonly SourceDefinition[]; workflows: readonly DefinitionWorkflow[]; available: boolean;
  onClose: () => void; onChanged: () => Promise<void>;
}) {
  const selected = initialDefinition;
  const [sourceType, setSourceType] = useState<SourceDefinition['sourceType']>(selected?.sourceType ?? initialSourceType);
  const [workflowId, setWorkflowId] = useState(selected?.sourceType === 'WORKFLOW_VARIABLE' ? selected.workflowId : '');
  const [metadata, setMetadata] = useState<DefinitionMetadata>(() => selected ? {
    name: selected.name, dataType: selected.dataType, capability: selected.capability,
    description: selected.description, unit: selected.unit, enabled: selected.enabled,
  } : defaults());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [workflowTouched, setWorkflowTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null), inFlight = useRef(false);
  const formId = useId(), errorId = useId(), nameErrorId = useId(), workflowErrorId = useId();
  const nameError = nameTouched && !metadata.name.trim();
  const workflowError = workflowTouched && sourceType === 'WORKFLOW_VARIABLE' && !workflowId;
  const save = async () => {
    if (inFlight.current || !available || !metadata.name.trim() || (sourceType === 'WORKFLOW_VARIABLE' && !workflowId)) return;
    inFlight.current = true; setPending(true); setError('');
    try {
      if (selected) await updateSourceDefinition(selected, metadata);
      else await createSourceDefinition(sourceType === 'SHARED_TAG' ? { ...metadata, sourceType } : { ...metadata, sourceType, workflowId });
      await onChanged(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save definition'); nameRef.current?.focus(); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <Modal open title="Source Definition Catalog" size="md" initialFocusRef={nameRef} onClose={() => { if (!inFlight.current) onClose(); }}
    description="Configuration only. Saving is independent of Page Save/Cancel. Disable retains existing bindings; no Runtime values or commands."
    footer={<><button type="button" className="btn" onClick={onClose} disabled={pending}>Cancel</button><button className="btn btn--primary" type="submit" form={formId} disabled={pending || !available || !metadata.name.trim() || (sourceType === 'WORKFLOW_VARIABLE' && !workflowId)}>{pending ? 'Saving…' : selected ? 'Save metadata' : 'Create definition'}</button></>}>
    <form id={formId} className="source-catalog source-catalog--focused" aria-label={selected ? 'Edit definition' : 'Create definition'} aria-describedby={error ? errorId : undefined} onSubmit={event => { event.preventDefault(); void save(); }}>
      <h3>{selected ? `Edit ${selected.name}` : 'Create definition'}</h3>
      {!available && <p role="status">Catalog unavailable or refreshing. Definitions cannot be saved until refreshed.</p>}
      {error && <p id={errorId} className="source-catalog-error" role="alert">{error}</p>}
      <fieldset disabled={pending} aria-describedby={error ? errorId : undefined}>
        <legend className="sr-only">Definition metadata</legend>
        <label className="source-catalog-wide">Name<input ref={nameRef} required maxLength={100} value={metadata.name} aria-invalid={nameError || undefined} aria-describedby={[nameError ? nameErrorId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined} onBlur={() => setNameTouched(true)} onChange={event => setMetadata({ ...metadata, name: event.target.value })} />
          {nameError && <small id={nameErrorId} className="source-catalog-error">Enter a name (up to 100 characters).</small>}</label>
        <label>Source Type<select value={sourceType} disabled={Boolean(selected)} onChange={event => setSourceType(event.target.value as typeof sourceType)}><option>SHARED_TAG</option><option>WORKFLOW_VARIABLE</option></select></label>
        {sourceType === 'WORKFLOW_VARIABLE' && <label>Owning Workflow<select value={workflowId} disabled={Boolean(selected)} aria-invalid={workflowError || undefined} aria-describedby={workflowError ? workflowErrorId : undefined} onBlur={() => setWorkflowTouched(true)} onChange={event => setWorkflowId(event.target.value)}><option value="">Select Workflow</option>{workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name} · {workflow.id}</option>)}</select>
          {workflowError && <small id={workflowErrorId} className="source-catalog-error">Select an owning Workflow.</small>}</label>}
        <label>Data type<select value={metadata.dataType} onChange={event => setMetadata({ ...metadata, dataType: event.target.value as DefinitionMetadata['dataType'] })}>{SOURCE_DATA_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Capability<select value={metadata.capability} onChange={event => setMetadata({ ...metadata, capability: event.target.value as DefinitionMetadata['capability'] })}>{SOURCE_CAPABILITIES.map(capability => <option key={capability}>{capability}</option>)}</select></label>
        <label>Unit<input maxLength={80} value={metadata.unit} onChange={event => setMetadata({ ...metadata, unit: event.target.value })} /></label>
        <label className="source-catalog-wide">Description<textarea rows={3} maxLength={1000} value={metadata.description} onChange={event => setMetadata({ ...metadata, description: event.target.value })} /></label>
        <label className="source-catalog-enabled source-catalog-wide"><input type="checkbox" checked={metadata.enabled} onChange={event => setMetadata({ ...metadata, enabled: event.target.checked })} /> Enabled (uncheck to Disable)</label>
        {selected && <details className="definition-identity source-catalog-wide"><summary>Immutable identity</summary><label>Stable ID<input readOnly value={definitionId(selected)} /></label>{selected.sourceType === 'WORKFLOW_VARIABLE' && <label>Workflow ID<input readOnly value={selected.workflowId} /></label>}</details>}
      </fieldset>
    </form>
  </Modal>;
}
